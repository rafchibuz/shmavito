import { ReportStatus } from "@prisma/client";
import { z } from "zod";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";

const reportDecisionSchema = z.object({ status: z.enum([ReportStatus.RESOLVED, ReportStatus.DISMISSED]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const moderator = await requireModerator();
    const input = reportDecisionSchema.parse(await request.json());
    const { id } = await context.params;
    const report = await db.report.findUnique({ where: { id } });
    if (!report) throw new ApiError(404, "NOT_FOUND", "Жалоба не найдена.");
    if (report.status !== ReportStatus.OPEN) throw new ApiError(409, "ALREADY_REVIEWED", "Жалоба уже обработана.");

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.report.update({
        where: { id },
        data: { status: input.status, resolvedBy: moderator.id, resolvedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: moderator.id,
          action: input.status === ReportStatus.RESOLVED ? "report.resolved" : "report.dismissed",
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
