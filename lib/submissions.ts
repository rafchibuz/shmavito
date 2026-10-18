import { ApiError } from "@/lib/http";

export function normalizeAvitoUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(400, "INVALID_URL", "Нужна полная ссылка на Avito.");
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (hostname !== "avito.ru" && hostname !== "www.avito.ru")) {
    throw new ApiError(400, "INVALID_URL", "Разрешены только HTTPS-ссылки на avito.ru.");
  }
  url.hostname = "www.avito.ru";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "context" || key === "from") url.searchParams.delete(key);
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString();
}

export function extractExternalItemId(normalizedUrl: string) {
  const matches = new URL(normalizedUrl).pathname.match(/(\d{6,})(?:$|\/)/g);
  return matches?.at(-1)?.replace("/", "") ?? null;
}
