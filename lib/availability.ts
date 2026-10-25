import { ListingState } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeAvitoUrl } from "@/lib/submissions";

const CHECK_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1024 * 1024;
const UNAVAILABLE_PATTERN = /страниц(?:а|ы) не найдена|такой страницы нет|объявление (?:снято|закрыто|удалено)|товар снят с публикации/i;
const BLOCKED_PATTERN = /captcha|доступ ограничен|подозрительн(?:ая|ую) активност/i;

type CheckResult = {
  result: "AVAILABLE" | "UNAVAILABLE" | "ERROR";
  httpStatus: number | null;
  errorCode: string | null;
};

async function readLimitedBody(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function readerFallback(normalizedUrl: string): Promise<CheckResult> {
  const target = new URL(normalizedUrl);
  try {
    const response = await fetch(`https://r.jina.ai/http://www.avito.ru${target.pathname}${target.search}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { Accept: "text/plain" },
    });
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel();
      return { result: "UNAVAILABLE", httpStatus: response.status, errorCode: null };
    }
    if (!response.ok) {
      await response.body?.cancel();
      return { result: "ERROR", httpStatus: response.status, errorCode: "READER_HTTP_ERROR" };
    }
    const body = await readLimitedBody(response);
    if (UNAVAILABLE_PATTERN.test(body)) return { result: "UNAVAILABLE", httpStatus: response.status, errorCode: null };
    if (body.length < 200) return { result: "ERROR", httpStatus: response.status, errorCode: "READER_EMPTY" };
    return { result: "AVAILABLE", httpStatus: response.status, errorCode: null };
  } catch (error) {
    return { result: "ERROR", httpStatus: null, errorCode: error instanceof DOMException && error.name === "TimeoutError" ? "READER_TIMEOUT" : "READER_NETWORK_ERROR" };
  }
}

async function checkAvitoAvailability(sourceUrl: string): Promise<CheckResult> {
  let currentUrl = normalizeAvitoUrl(sourceUrl);
  try {
    for (let redirect = 0; redirect <= 2; redirect += 1) {
      const response = await fetch(currentUrl, {
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ru-RU,ru;q=0.9",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 ShmavitoAvailability/1.0",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirect === 2) return { result: "ERROR", httpStatus: response.status, errorCode: "INVALID_REDIRECT" };
        currentUrl = normalizeAvitoUrl(new URL(location, currentUrl).toString());
        continue;
      }
      if (response.status === 404 || response.status === 410) {
        await response.body?.cancel();
        return { result: "UNAVAILABLE", httpStatus: response.status, errorCode: null };
      }
      if (response.ok) {
        const body = await readLimitedBody(response);
        if (UNAVAILABLE_PATTERN.test(body)) return { result: "UNAVAILABLE", httpStatus: response.status, errorCode: null };
        if (!BLOCKED_PATTERN.test(body)) return { result: "AVAILABLE", httpStatus: response.status, errorCode: null };
        return readerFallback(currentUrl);
      }
      await response.body?.cancel();
      return readerFallback(currentUrl);
    }
  } catch {
    return readerFallback(currentUrl);
  }
  return { result: "ERROR", httpStatus: null, errorCode: "UNKNOWN" };
}

export async function runAvailabilityChecks({ limit = 20, force = false, actorId = null }: { limit?: number; force?: boolean; actorId?: string | null } = {}) {
  const dueBefore = new Date(Date.now() - 23 * 60 * 60 * 1000);
  const listings = await db.listing.findMany({
    where: {
      state: ListingState.ACTIVE,
      deletedAt: null,
      ...(force ? {} : { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: dueBefore } }] }),
    },
    orderBy: [{ lastCheckedAt: "asc" }, { publishedAt: "asc" }],
    take: Math.min(Math.max(limit, 1), 50),
    select: { id: true, submission: { select: { sourceUrl: true } } },
  });

  const results: CheckResult[] = [];
  for (let index = 0; index < listings.length; index += 5) {
    const batch = listings.slice(index, index + 5);
    const checked = await Promise.all(batch.map(async (listing) => {
      const startedAt = Date.now();
      const check = await checkAvitoAvailability(listing.submission.sourceUrl);
      const checkedAt = new Date();
      await db.$transaction(async (tx) => {
        await tx.availabilityCheck.create({
          data: {
            listingId: listing.id,
            result: check.result,
            httpStatus: check.httpStatus,
            errorCode: check.errorCode,
            durationMs: Date.now() - startedAt,
            checkedAt,
          },
        });
        const updated = await tx.listing.updateMany({
          where: { id: listing.id, state: ListingState.ACTIVE, deletedAt: null },
          data: {
            lastCheckedAt: checkedAt,
            ...(check.result === "UNAVAILABLE" ? { state: ListingState.UNAVAILABLE, unavailableAt: checkedAt } : {}),
          },
        });
        if (updated.count && check.result === "UNAVAILABLE") {
          await tx.auditLog.create({
            data: {
              actorId,
              action: "listing.availability.unavailable",
              targetType: "Listing",
              targetId: listing.id,
              afterJson: { httpStatus: check.httpStatus, checkedAt },
            },
          });
        }
      });
      return check;
    }));
    results.push(...checked);
  }

  await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  return {
    checked: results.length,
    available: results.filter((item) => item.result === "AVAILABLE").length,
    unavailable: results.filter((item) => item.result === "UNAVAILABLE").length,
    errors: results.filter((item) => item.result === "ERROR").length,
  };
}
