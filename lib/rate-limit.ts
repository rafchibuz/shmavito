import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

type RateLimitOptions = {
  namespace: string;
  limit: number;
  windowSeconds: number;
  subject?: string;
};

function requestAddress(request: Request) {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return "untrusted-proxy";
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export async function enforceRateLimit(request: Request, options: RateLimitOptions) {
  const subject = options.subject || requestAddress(request);
  const digest = createHash("sha256").update(subject).digest("hex").slice(0, 32);
  const key = `${options.namespace}:${digest}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + options.windowSeconds * 1000);
  const rows = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `;
  const bucket = rows[0];
  if (!bucket || bucket.count <= options.limit) return;
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt.getTime() - Date.now()) / 1000));
  throw new ApiError(429, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже.", { "Retry-After": String(retryAfter) });
}
