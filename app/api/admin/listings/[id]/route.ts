import { ListingState, ReportStatus, SubmissionStatus } from "@prisma/client";
import { requireFounder } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const founder = await requireFounder();
    const { id } = await context.params;
    const deleted = await db.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id },
        select: { id: true, title: true, state: true, deletedAt: true, submissionId: true, submission: { select: { authorId: true } } },
      });
      if (!listing) throw new ApiError(404, "NOT_FOUND", "Объявление не найдено.");
      if (listing.deletedAt || listing.state === ListingState.DELETED) throw new ApiError(409, "ALREADY_DELETED", "Объявление уже удалено.");
      const now = new Date();
      const updated = await tx.listing.updateMany({
        where: { id, deletedAt: null, state: { in: [ListingState.ACTIVE, ListingState.UNAVAILABLE] } },
        data: { state: ListingState.DELETED, deletedAt: now },
      });
      if (!updated.count) throw new ApiError(409, "ALREADY_DELETED", "Объявление уже удалено.");
      await tx.submission.update({ where: { id: listing.submissionId }, data: { status: SubmissionStatus.DELETED } });
      await tx.report.updateMany({
        where: { status: ReportStatus.OPEN, OR: [{ listingId: id }, { comment: { listingId: id } }] },
        data: { status: ReportStatus.RESOLVED, resolvedBy: founder.id, resolvedAt: now },
      });
      await tx.notification.create({
        data: { userId: listing.submission.authorId, type: "submission.deleted", payload: { submissionId: listing.submissionId, listingId: id } },
      });
      await tx.auditLog.create({
        data: {
          actorId: founder.id, action: "listing.deleted", targetType: "Listing", targetId: id,
          beforeJson: { title: listing.title, state: listing.state },
          afterJson: { state: ListingState.DELETED, deletedAt: now },
        },
      });
      return { id, deletedAt: now };
    });
    return Response.json({ listing: deleted });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const founder = await requireFounder();
    const { id } = await context.params;
    const restored = await db.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id },
        select: { id: true, title: true, state: true, deletedAt: true, unavailableAt: true, submissionId: true, submission: { select: { authorId: true, normalizedUrl: true } } },
      });
      if (!listing) throw new ApiError(404, "NOT_FOUND", "Объявление не найдено.");
      if (!listing.deletedAt || listing.state !== ListingState.DELETED) throw new ApiError(409, "NOT_DELETED", "Объявление уже опубликовано.");
      const duplicate = await tx.submission.findFirst({
        where: {
          id: { not: listing.submissionId },
          normalizedUrl: listing.submission.normalizedUrl,
          status: { in: [SubmissionStatus.PENDING, SubmissionStatus.APPROVED] },
        },
        select: { id: true },
      });
      if (duplicate) throw new ApiError(409, "DUPLICATE_SUBMISSION", "Эта ссылка уже отправлена повторно. Сначала разберите новую заявку.");
      const state = listing.unavailableAt ? ListingState.UNAVAILABLE : ListingState.ACTIVE;
      const updated = await tx.listing.updateMany({
        where: { id, state: ListingState.DELETED, deletedAt: { not: null } },
        data: { state, deletedAt: null },
      });
      if (!updated.count) throw new ApiError(409, "NOT_DELETED", "Объявление уже опубликовано.");
      await tx.submission.update({ where: { id: listing.submissionId }, data: { status: SubmissionStatus.APPROVED } });
      await tx.notification.create({
        data: { userId: listing.submission.authorId, type: "submission.restored", payload: { submissionId: listing.submissionId, listingId: id } },
      });
      await tx.auditLog.create({
        data: {
          actorId: founder.id, action: "listing.restored", targetType: "Listing", targetId: id,
          beforeJson: { title: listing.title, state: listing.state, deletedAt: listing.deletedAt },
          afterJson: { state, deletedAt: null },
        },
      });
      return { id, state };
    });
    return Response.json({ listing: restored });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
