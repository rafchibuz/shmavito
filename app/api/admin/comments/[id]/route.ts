import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const moderator = await requireModerator();
    const { id } = await context.params;
    const comment = await db.comment.findUnique({ where: { id } });
    if (!comment || comment.deletedAt) throw new ApiError(404, "NOT_FOUND", "Комментарий не найден.");
    await db.$transaction([
      db.comment.update({ where: { id }, data: { deletedAt: new Date() } }),
      db.auditLog.create({
        data: {
          actorId: moderator.id,
          action: "comment.deleted",
          targetType: "Comment",
          targetId: id,
          beforeJson: { body: comment.body, authorId: comment.authorId, listingId: comment.listingId },
        },
      }),
    ]);
    return Response.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
