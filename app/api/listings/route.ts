import { ListingState } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/http";

const fallbackImages: Record<string, string> = {
  cars: "/images/car-lineup.png",
  "other-vehicles": "/images/motorcycle.svg",
  "real-estate": "/images/garage.svg",
  parts: "/images/bmw-wheel.png",
  misc: "/images/racing-suit.png",
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

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    const url = new URL(request.url);
    const category = url.searchParams.get("category")?.trim();
    const query = url.searchParams.get("q")?.trim().slice(0, 100);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 60, 1), 100);

    const listings = await db.listing.findMany({
      where: {
        state: { in: [ListingState.ACTIVE, ListingState.UNAVAILABLE] },
        deletedAt: null,
        ...(category ? { category: { slug: category, deletedAt: null } } : {}),
        ...(query ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: {
        category: { select: { name: true, slug: true } },
        submission: {
          select: {
            sourceUrl: true,
            authorId: true,
            author: { select: { login: true, displayName: true, avatarUrl: true } },
          },
        },
        images: { orderBy: [{ isCover: "desc" }, { position: "asc" }], take: 1 },
        _count: { select: { likes: true, comments: true, views: true } },
      },
    });

    const listingIds = listings.map((listing) => listing.id);
    const [viewerLikes, viewerViews] = user && listingIds.length ? await Promise.all([
      db.like.findMany({ where: { userId: user.id, listingId: { in: listingIds } }, select: { listingId: true } }),
      db.itemView.findMany({ where: { userId: user.id, listingId: { in: listingIds } }, select: { listingId: true } }),
    ]) : [[], []];

    return Response.json({
      listings: listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        price: formatPrice(listing.price),
        location: listing.city || "Город не указан",
        category: listing.category.name,
        categorySlug: listing.category.slug,
        description: listing.description,
        image: listing.images[0]?.storageKey.startsWith("public/")
          ? `/uploads/${listing.images[0].storageKey.slice("public/".length)}`
          : listing.images[0]?.sourceUrl || fallbackImages[listing.category.slug] || "/images/car-lineup.png",
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
      })),
      total: listings.length,
      viewer: user ? {
        id: user.id,
        login: user.login,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        likedIds: viewerLikes.map((like) => like.listingId),
        viewedIds: viewerViews.map((view) => view.listingId),
      } : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
