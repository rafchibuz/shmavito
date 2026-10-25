import { ListingState } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: RouteContext<"/api/listings/[id]/bookmark">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, { namespace: "bookmark:toggle", subject: user.id, limit: 60, windowSeconds: 60 });
    const { id } = await context.params;
    const listing = await db.listing.findUnique({ where: { id }, select: { state: true, deletedAt: true } });
    if (!listing || listing.deletedAt || listing.state === ListingState.DELETED) {
      throw new ApiError(404, "NOT_FOUND", "Объявление не найдено.");
    }

    const bookmarked = await db.$transaction(async (tx) => {
      const existing = await tx.bookmark.findUnique({ where: { userId_listingId: { userId: user.id, listingId: id } } });
      if (existing) {
        await tx.bookmark.delete({ where: { userId_listingId: { userId: user.id, listingId: id } } });
        return false;
      }
      await tx.bookmark.create({ data: { userId: user.id, listingId: id } });
      return true;
    });

    return Response.json({ bookmarked });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
