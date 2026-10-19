import { ApiError } from "@/lib/http";
import { normalizeAvitoUrl } from "@/lib/submissions";

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export type AvitoImportResult = {
  mode: "automatic" | "manual";
  normalizedUrl: string;
  title: string;
  description: string;
  price: number | null;
  city: string;
  imageUrls: string[];
  importedFields: string[];
  warning: string | null;
};

type JsonRecord = Record<string, unknown>;

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", laquo: "«", raquo: "»",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return named[key.toLowerCase()] ?? entity;
  });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function safeImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(decodeHtml(value));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parsePrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function walkRecords(value: unknown, records: JsonRecord[], depth = 0) {
  if (depth > 12) return;
  if (Array.isArray(value)) {
    for (const item of value) walkRecords(item, records, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  records.push(value);
  for (const child of Object.values(value)) walkRecords(child, records, depth + 1);
}

function recordType(record: JsonRecord) {
  const value = record["@type"];
  return Array.isArray(value) ? value.join(" ").toLowerCase() : String(value ?? "").toLowerCase();
}

function findNestedString(records: JsonRecord[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = cleanText(record[key], key === "description" ? 4000 : 160);
      if (value) return value;
    }
  }
  return "";
}

function parseAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), decodeHtml(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return attributes;
}

function readMetadata(html: string) {
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.get("property") || attributes.get("name") || attributes.get("itemprop"))?.toLowerCase();
    const content = attributes.get("content");
    if (key && content && !metadata.has(key)) metadata.set(key, content);
  }
  return metadata;
}

function parseJsonLd(html: string) {
  const records: JsonRecord[] = [];
  const pattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      walkRecords(JSON.parse(decodeHtml(match[1].trim())), records);
    } catch {
      // A broken JSON-LD block must not cancel the remaining extraction strategies.
    }
  }
  return records;
}

async function readLimitedText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_HTML_BYTES) throw new ApiError(413, "PAGE_TOO_LARGE", "Страница объявления слишком большая для импорта.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "PAGE_TOO_LARGE", "Страница объявления слишком большая для импорта.");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchAvitoHtml(initialUrl: string) {
  let currentUrl = normalizeAvitoUrl(initialUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(currentUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ru-RU,ru;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 ShmavitoPreview/1.0",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new ApiError(422, "AVITO_REDIRECT", "Avito вернул некорректное перенаправление.");
      currentUrl = normalizeAvitoUrl(new URL(location, currentUrl).toString());
      continue;
    }
    return { response, currentUrl, html: await readLimitedText(response) };
  }
  throw new ApiError(422, "AVITO_REDIRECT", "Слишком много перенаправлений Avito.");
}

function manualResult(normalizedUrl: string, warning: string): AvitoImportResult {
  return { mode: "manual", normalizedUrl, title: "", description: "", price: null, city: "", imageUrls: [], importedFields: [], warning };
}

export async function importAvitoListing(sourceUrl: string): Promise<AvitoImportResult> {
  const normalizedUrl = normalizeAvitoUrl(sourceUrl);
  let fetched: Awaited<ReturnType<typeof fetchAvitoHtml>>;
  try {
    fetched = await fetchAvitoHtml(normalizedUrl);
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) throw error;
    return manualResult(normalizedUrl, "Avito не ответил вовремя. Заполните данные вручную — ссылка уже сохранена в форме.");
  }

  const { response, html, currentUrl } = fetched;
  if ([401, 403, 429].includes(response.status) || /captcha|доступ ограничен|подозрительн(?:ая|ую) активност/i.test(html)) {
    return manualResult(currentUrl, "Avito ограничил автоматический доступ к странице. Заполните поля вручную.");
  }
  if (!response.ok) return manualResult(currentUrl, `Avito вернул статус ${response.status}. Проверьте ссылку и заполните поля вручную.`);
  if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
    return manualResult(currentUrl, "По ссылке получена не страница объявления. Заполните данные вручную.");
  }

  const metadata = readMetadata(html);
  const records = parseJsonLd(html);
  const product = records.find((record) => /product|vehicle|offer/.test(recordType(record))) ?? records[0];
  const productRecords: JsonRecord[] = [];
  if (product) walkRecords(product, productRecords);
  const searchable = productRecords.length ? productRecords : records;

  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title = cleanText(product?.name ?? product?.headline ?? metadata.get("og:title") ?? titleTag, 160)
    .replace(/\s*[—|-]\s*Авито\s*$/i, "")
    .trim();
  const description = cleanText(product?.description ?? metadata.get("og:description") ?? metadata.get("description"), 4000);

  const offer = searchable.find((record) => /offer/.test(recordType(record))) ?? searchable.find((record) => record.price !== undefined);
  const price = parsePrice(offer?.price ?? offer?.lowPrice ?? metadata.get("product:price:amount"));
  const city = findNestedString(searchable, ["addressLocality", "addressRegion"]);

  const imageCandidates: unknown[] = [];
  if (product?.image !== undefined) imageCandidates.push(...(Array.isArray(product.image) ? product.image : [product.image]));
  for (const key of ["og:image", "og:image:url", "twitter:image"]) {
    if (metadata.get(key)) imageCandidates.push(metadata.get(key));
  }
  const imageUrls = [...new Set(imageCandidates.flatMap((value) => {
    if (isRecord(value)) return [safeImageUrl(value.url ?? value.contentUrl)];
    return [safeImageUrl(value)];
  }).filter((value): value is string => Boolean(value)))].slice(0, 5);

  const importedFields = [title && "title", description && "description", price !== null && "price", city && "city", imageUrls.length && "images"].filter((value): value is string => Boolean(value));
  if (!title) return manualResult(currentUrl, "Avito открыл страницу, но не отдал название объявления. Заполните данные вручную.");

  return {
    mode: "automatic",
    normalizedUrl: currentUrl,
    title,
    description,
    price,
    city,
    imageUrls,
    importedFields,
    warning: importedFields.length < 4 ? "Часть данных Avito не отдал. Проверьте и дополните поля перед отправкой." : null,
  };
}
