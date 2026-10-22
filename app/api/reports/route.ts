import { ReportStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin, readJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const reportSchema = z.object({
  targetType: z.enum(["listing", "comment"]),
  targetId: z.string().min(1),
  reason: z.string().trim().min(5).max(500),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, { namespace: "report:create", subject: user.id, limit: 10, windowSeconds: 60 * 60 });
    const input = reportSchema.parse(await readJsonBody(request, 8 * 1024));
    const listing = input.targetType === "listing"
      ? await db.listing.findFirst({ where: { id: input.targetId, deletedAt: null }, select: { id: true } })
      : null;
    const comment = input.targetType === "comment"
      ? await db.comment.findFirst({ where: { id: input.targetId, deletedAt: null }, select: { id: true, listingId: true } })
      : null;
    if (!listing && !comment) throw new ApiError(404, "NOT_FOUND", "Объект жалобы не найден.");

    const targetWhere = listing ? { listingId: listing.id } : { commentId: comment!.id };
    const duplicate = await db.report.findFirst({
      where: { reporterId: user.id, status: ReportStatus.OPEN, ...targetWhere },
      select: { id: true },
    });
    if (duplicate) throw new ApiError(409, "DUPLICATE_REPORT", "Вы уже отправили жалобу на этот материал.");

    const report = await db.report.create({
      data: {
        reporterId: user.id,
        listingId: listing?.id,
        commentId: comment?.id,
        reason: input.reason,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return Response.json({ report }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
