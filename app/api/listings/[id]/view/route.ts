import { ListingState } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, { namespace: "listing:view", subject: user.id, limit: 180, windowSeconds: 10 * 60 });
    const { id } = await context.params;
    const listing = await db.listing.findFirst({
      where: { id, state: { not: ListingState.DELETED }, deletedAt: null },
      select: { id: true },
    });
    if (!listing) throw new ApiError(404, "NOT_FOUND", "Объявление не найдено.");

    const view = await db.itemView.upsert({
      where: { userId_listingId: { userId: user.id, listingId: id } },
      update: { openCount: { increment: 1 } },
      create: { userId: user.id, listingId: id },
    });
    return Response.json({ viewed: true, openCount: view.openCount });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
