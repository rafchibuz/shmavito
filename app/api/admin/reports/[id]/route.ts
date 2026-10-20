import { ListingState, ReportStatus } from "@prisma/client";
import { z } from "zod";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";

const reportDecisionSchema = z.union([
  z.object({ status: z.enum([ReportStatus.RESOLVED, ReportStatus.DISMISSED]) }),
  z.object({ action: z.literal("REMOVE_CONTENT") }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const moderator = await requireModerator();
    const input = reportDecisionSchema.parse(await request.json());
    const { id } = await context.params;
    const report = await db.report.findUnique({ where: { id }, include: { comment: true, listing: true } });
    if (!report) throw new ApiError(404, "NOT_FOUND", "Жалоба не найдена.");
    if (report.status !== ReportStatus.OPEN) throw new ApiError(409, "ALREADY_REVIEWED", "Жалоба уже обработана.");

    const updated = await db.$transaction(async (tx) => {
      if ("action" in input) {
        if (report.commentId && report.comment && !report.comment.deletedAt) {
          await tx.comment.update({ where: { id: report.commentId }, data: { deletedAt: new Date() } });
          await tx.auditLog.create({
            data: {
              actorId: moderator.id,
              action: "comment.deleted.from_report",
              targetType: "Comment",
              targetId: report.commentId,
              beforeJson: { body: report.comment.body, listingId: report.comment.listingId },
            },
          });
        } else if (report.listingId && report.listing && report.listing.state !== ListingState.DELETED) {
          await tx.listing.update({
            where: { id: report.listingId },
            data: { state: ListingState.UNAVAILABLE, unavailableAt: new Date() },
          });
          await tx.auditLog.create({
            data: {
              actorId: moderator.id,
              action: "listing.unpublished.from_report",
              targetType: "Listing",
              targetId: report.listingId,
              beforeJson: { state: report.listing.state },
              afterJson: { state: ListingState.UNAVAILABLE },
            },
          });
        } else {
          throw new ApiError(409, "CONTENT_ALREADY_REMOVED", "Материал уже удалён или недоступен.");
        }
        await tx.report.updateMany({
          where: {
            status: ReportStatus.OPEN,
            ...(report.commentId ? { commentId: report.commentId } : { listingId: report.listingId }),
          },
          data: { status: ReportStatus.RESOLVED, resolvedBy: moderator.id, resolvedAt: new Date() },
        });
      }
      const nextStatus = "action" in input ? ReportStatus.RESOLVED : input.status;
      const result = await tx.report.update({
        where: { id },
        data: { status: nextStatus, resolvedBy: moderator.id, resolvedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: moderator.id,
          action: nextStatus === ReportStatus.RESOLVED ? "report.resolved" : "report.dismissed",
          targetType: "Report",
          targetId: id,
          beforeJson: { status: report.status },
          afterJson: { status: result.status },
        },
      });
      return result;
    });
    return Response.json({ report: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
