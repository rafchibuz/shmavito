import { ListingState } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, { namespace: "like:toggle", subject: user.id, limit: 60, windowSeconds: 60 });
    const { id } = await context.params;
    const listing = await db.listing.findUnique({
      where: { id },
      select: { state: true, deletedAt: true, submission: { select: { authorId: true } } },
    });
    if (!listing || listing.deletedAt) throw new ApiError(404, "NOT_FOUND", "Объявление не найдено.");
    if (listing.state !== ListingState.ACTIVE) throw new ApiError(409, "LISTING_UNAVAILABLE", "Объявление снято с публикации.");
    if (listing.submission.authorId === user.id) throw new ApiError(409, "OWN_LISTING", "Нельзя лайкнуть собственное предложение.");

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({ where: { userId_listingId: { userId: user.id, listingId: id } } });
      if (existing) await tx.like.delete({ where: { userId_listingId: { userId: user.id, listingId: id } } });
      else await tx.like.create({ data: { userId: user.id, listingId: id } });
      const count = await tx.like.count({ where: { listingId: id } });
      return { liked: !existing, count };
    });
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
