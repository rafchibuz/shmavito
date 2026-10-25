import nextEnv from "@next/env";
import { PrismaClient, ListingState } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());

const db = new PrismaClient();
const MAX_IMAGES = 40;

function normalizedAvitoUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["avito.ru", "www.avito.ru"].includes(url.hostname.toLowerCase())) return null;
    url.hostname = "www.avito.ru";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function shareImagesFrom(payload) {
  const images = payload?.data?.metadata?.["og:image"];
  return [...new Set((Array.isArray(images) ? images : [images]).filter((value) => {
    if (typeof value !== "string") return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && ["avito.ru", "www.avito.ru"].includes(url.hostname.toLowerCase()) && url.pathname.startsWith("/img/share/");
    } catch {
      return false;
    }
  }))].slice(0, MAX_IMAGES);
}

async function fetchShareImages(sourceUrl) {
  const url = normalizedAvitoUrl(sourceUrl);
  if (!url) return [];
  const targets = [
    `https://m.avito.ru${url.pathname}${url.search}`,
    `http://www.avito.ru${url.pathname}${url.search}`,
    `https://www.avito.ru${url.pathname}${url.search}`,
  ];
  for (const target of targets) {
    try {
      const response = await fetch(`https://r.jina.ai/${target}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        headers: { Accept: "application/json", "X-With-Images-Summary": "true" },
      });
      if (!response.ok) continue;
      const images = shareImagesFrom(await response.json());
      if (images.length) return images;
    } catch {
      // Continue with another canonical host; Avito may block only one representation.
    }
  }
  return [];
}

async function main() {
  const listings = await db.listing.findMany({
    where: { deletedAt: null, state: { in: [ListingState.ACTIVE, ListingState.UNAVAILABLE] } },
    select: {
      id: true,
      title: true,
      submission: { select: { sourceUrl: true } },
      images: { orderBy: { position: "asc" }, select: { sourceUrl: true } },
    },
  });
  let updated = 0;
  for (const listing of listings) {
    const current = listing.images.map((image) => image.sourceUrl).filter(Boolean);
    if (current.length && current.every((url) => url.includes("/img/share/"))) continue;
    const images = await fetchShareImages(listing.submission.sourceUrl);
    if (images.length < Math.min(2, Math.max(1, current.length))) {
      console.log(`Skipped ${listing.title}: no complete higher-quality gallery.`);
      continue;
    }
    await db.$transaction([
      db.listingImage.deleteMany({ where: { listingId: listing.id } }),
      db.listingImage.createMany({
        data: images.map((sourceUrl, position) => ({
          listingId: listing.id,
          sourceUrl,
          storageKey: `external:share:${position}`,
          position,
          isCover: position === 0,
        })),
      }),
    ]);
    updated += 1;
    console.log(`Updated ${listing.title}: ${images.length} higher-quality image(s).`);
  }
  console.log(`Image refresh complete: ${updated} listing(s) updated.`);
}

try {
  await main();
} finally {
  await db.$disconnect();
}
