import { ListingState } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: RouteContext<"/api/listings/[id]/outbound">) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    const { id } = await context.params;
    await enforceRateLimit(request, {
      namespace: `outbound:${id}`,
      subject: user?.id,
      limit: 12,
      windowSeconds: 60 * 60,
    });
    const listing = await db.listing.findUnique({ where: { id }, select: { state: true, deletedAt: true } });
    if (!listing || listing.deletedAt || listing.state !== ListingState.ACTIVE) {
      throw new ApiError(404, "NOT_FOUND", "Объявление недоступно.");
    }
    const updated = await db.listing.update({
      where: { id },
      data: { outboundClicks: { increment: 1 } },
      select: { outboundClicks: true },
    });
    return Response.json({ count: updated.outboundClicks });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
