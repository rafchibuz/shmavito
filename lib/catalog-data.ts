import "server-only";

import { ListingState, SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { CatalogPayload } from "@/lib/types";

const fallbackImages: Record<string, string> = {
  cars: "/images/car-lineup.png",
  "other-vehicles": "/images/motorcycle.svg",
  "real-estate": "/images/garage.svg",
  parts: "/images/bmw-wheel.png",
  misc: "/images/racing-suit.png",
};

type CatalogUser = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
};

type CatalogQuery = {
  user: CatalogUser | null;
  category?: string;
  query?: string;
  limit?: number;
};

function formatPrice(price: number | null) {
  return price === null ? "Цена не указана" : `${price.toLocaleString("ru-RU")} ₽`;
}

function formatPublished(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export async function getCatalogPayload({ user, category, query, limit = 60 }: CatalogQuery): Promise<CatalogPayload> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const [listings, publishedCount, pendingCount, outboundAggregate] = await Promise.all([
    db.listing.findMany({
      where: {
        state: { in: [ListingState.ACTIVE, ListingState.UNAVAILABLE] },
        deletedAt: null,
        ...(category ? { category: { slug: category, deletedAt: null } } : {}),
        ...(query ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { originalTitle: { contains: query, mode: "insensitive" as const } },
            { submitterComment: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
            { city: { contains: query, mode: "insensitive" as const } },
          ],
        } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: safeLimit,
      include: {
        category: { select: { name: true, slug: true } },
        submission: {
          select: {
            sourceUrl: true,
            authorId: true,
            author: { select: { login: true, displayName: true, avatarUrl: true } },
          },
        },
        images: { orderBy: [{ isCover: "desc" }, { position: "asc" }] },
        _count: { select: { likes: true, comments: true, views: true } },
      },
    }),
    db.listing.count({ where: { state: { in: [ListingState.ACTIVE, ListingState.UNAVAILABLE] }, deletedAt: null } }),
    db.submission.count({ where: { status: SubmissionStatus.PENDING } }),
    db.listing.aggregate({
      where: { state: { in: [ListingState.ACTIVE, ListingState.UNAVAILABLE] }, deletedAt: null },
      _sum: { outboundClicks: true },
    }),
  ]);

  const listingIds = listings.map((listing) => listing.id);
  const [viewerLikes, viewerViews, viewerBookmarks] = user && listingIds.length ? await Promise.all([
    db.like.findMany({ where: { userId: user.id, listingId: { in: listingIds } }, select: { listingId: true } }),
    db.itemView.findMany({ where: { userId: user.id, listingId: { in: listingIds } }, select: { listingId: true } }),
    db.bookmark.findMany({ where: { userId: user.id, listingId: { in: listingIds } }, select: { listingId: true } }),
  ]) : [[], [], []];

  return {
    listings: listings.map((listing) => {
      const images = listing.images.length
        ? listing.images.map((image) => image.storageKey.startsWith("public/")
          ? `/uploads/${image.storageKey.slice("public/".length)}`
          : image.sourceUrl).filter((image): image is string => Boolean(image))
        : [fallbackImages[listing.category.slug] || "/images/car-lineup.png"];

      return {
        id: listing.id,
        title: listing.title,
        originalTitle: listing.originalTitle || listing.title,
        submitterComment: listing.submitterComment || "",
        price: formatPrice(listing.price),
        location: listing.city || "Город не указан",
        category: listing.category.name,
        description: listing.description,
        image: images[0] || fallbackImages[listing.category.slug] || "/images/car-lineup.png",
        images,
        author: {
          id: listing.submission.authorId,
          name: listing.submission.author.displayName || listing.submission.author.login,
          avatar: listing.submission.author.avatarUrl || "/images/avatar-blackline.svg",
        },
        published: formatPublished(listing.publishedAt),
        likes: listing._count.likes,
        comments: listing._count.comments,
        views: listing._count.views,
        year: listing.year ?? undefined,
        mileage: listing.mileage === null ? undefined : `${listing.mileage.toLocaleString("ru-RU")} км`,
        unavailable: listing.state === ListingState.UNAVAILABLE,
        sourceUrl: listing.submission.sourceUrl,
      };
    }),
    total: listings.length,
    stats: {
      findings: publishedCount,
      pending: pendingCount,
      outboundClicks: outboundAggregate._sum.outboundClicks ?? 0,
    },
    viewer: user ? {
      id: user.id,
      login: user.login,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      likedIds: viewerLikes.map((like) => like.listingId),
      viewedIds: viewerViews.map((view) => view.listingId),
      bookmarkIds: viewerBookmarks.map((bookmark) => bookmark.listingId),
    } : null,
  };
}

export async function getVisibleCategoryNames() {
  const categories = await db.category.findMany({
    where: { isVisible: true, deletedAt: null },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  return categories.map((category) => category.name);
}
