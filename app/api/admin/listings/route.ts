import { ListingState } from "@prisma/client";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/http";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const user = await requireModerator();
    const params = new URL(request.url).searchParams;
    const deleted = params.get("status") === "deleted";
    const query = (params.get("q") || "").trim().slice(0, 120);
    const requestedPage = Number(params.get("page") || 1);
    const page = Number.isSafeInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), 10_000) : 1;
    const where = {
      state: deleted ? ListingState.DELETED : { in: [ListingState.ACTIVE, ListingState.UNAVAILABLE] },
      deletedAt: deleted ? { not: null } : null,
      ...(query ? { OR: [
        { title: { contains: query, mode: "insensitive" as const } },
        { originalTitle: { contains: query, mode: "insensitive" as const } },
        { city: { contains: query, mode: "insensitive" as const } },
        { submission: { sourceUrl: { contains: query, mode: "insensitive" as const } } },
      ] } : {}),
    };
    const [total, listings] = await Promise.all([
      db.listing.count({ where }),
      db.listing.findMany({
        where,
        orderBy: deleted ? { deletedAt: "desc" } : { publishedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, title: true, originalTitle: true, price: true, city: true,
          state: true, publishedAt: true, deletedAt: true,
          category: { select: { name: true } },
          submission: { select: { sourceUrl: true, author: { select: { login: true, displayName: true } } } },
          images: { orderBy: [{ isCover: "desc" }, { position: "asc" }], take: 1, select: { sourceUrl: true, storageKey: true } },
        },
      }),
    ]);
    return Response.json({
      listings: listings.map(({ images, ...listing }) => ({
        ...listing,
        image: images[0]?.storageKey.startsWith("public/")
          ? `/uploads/${images[0].storageKey.slice("public/".length)}`
          : images[0]?.sourceUrl || null,
      })),
      page,
      pageSize: PAGE_SIZE,
      total,
      canManage: user.role === "FOUNDER",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
