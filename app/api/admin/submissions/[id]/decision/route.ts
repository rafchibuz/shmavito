import { ListingState, SubmissionStatus } from "@prisma/client";
import { z } from "zod";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().trim().max(500).optional(),
  categoryId: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  price: z.number().int().nonnegative().max(2_000_000_000).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
}).superRefine((value, context) => {
  if (value.decision === "REJECTED" && !value.rejectionReason) {
    context.addIssue({ code: "custom", path: ["rejectionReason"], message: "Укажите причину отклонения." });
  }
});

function snapshotObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const moderator = await requireModerator();
    const input = decisionSchema.parse(await request.json());
    const { id } = await context.params;

    const result = await db.$transaction(async (tx) => {
      const submission = await tx.submission.findUnique({ where: { id } });
      if (!submission) throw new ApiError(404, "NOT_FOUND", "Заявка не найдена.");
      if (submission.status !== SubmissionStatus.PENDING) {
        throw new ApiError(409, "ALREADY_REVIEWED", "Заявка уже обработана.");
      }

      const categoryId = input.categoryId || submission.categoryId;
      const category = await tx.category.findFirst({ where: { id: categoryId, deletedAt: null } });
      if (!category) throw new ApiError(400, "INVALID_CATEGORY", "Категория не найдена.");

      if (input.decision === "REJECTED") {
        const updated = await tx.submission.update({
          where: { id },
          data: { status: SubmissionStatus.REJECTED, rejectionReason: input.rejectionReason, categoryId },
        });
        await tx.notification.create({
          data: {
            userId: submission.authorId,
            type: "submission.rejected",
            payload: { submissionId: id, reason: input.rejectionReason },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: moderator.id,
            action: "submission.rejected",
            targetType: "Submission",
            targetId: id,
            beforeJson: { status: submission.status, categoryId: submission.categoryId },
            afterJson: { status: updated.status, categoryId, rejectionReason: input.rejectionReason },
          },
        });
        return { submission: updated, listing: null };
      }

      const snapshot = snapshotObject(submission.rawSnapshot);
      const title = input.title || (typeof snapshot.title === "string" ? snapshot.title : "Объявление Avito");
      const description = input.description ?? (typeof snapshot.description === "string" ? snapshot.description : "");
      const price = input.price !== undefined
        ? input.price
        : typeof snapshot.price === "number" ? snapshot.price : null;
      const city = input.city !== undefined
        ? input.city
        : typeof snapshot.city === "string" ? snapshot.city : null;
      const imageUrls = Array.isArray(snapshot.imageUrls)
        ? snapshot.imageUrls.filter((item): item is string => typeof item === "string").slice(0, 5)
        : [];

      const listing = await tx.listing.create({
        data: {
          submissionId: submission.id,
          categoryId,
          title,
          description,
          price,
          city,
          state: ListingState.ACTIVE,
          images: {
            create: imageUrls.map((sourceUrl, position) => ({
              storageKey: `external:${submission.id}:${position}`,
              sourceUrl,
              position,
              isCover: position === 0,
            })),
          },
        },
      });
      const updated = await tx.submission.update({
        where: { id },
        data: { status: SubmissionStatus.APPROVED, rejectionReason: null, categoryId },
      });
      await tx.notification.create({
        data: {
          userId: submission.authorId,
          type: "submission.approved",
          payload: { submissionId: id, listingId: listing.id },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: moderator.id,
          action: "submission.approved",
          targetType: "Submission",
          targetId: id,
          beforeJson: { status: submission.status, categoryId: submission.categoryId },
          afterJson: { status: updated.status, categoryId, listingId: listing.id },
        },
      });
      return { submission: updated, listing };
    });
    return Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
