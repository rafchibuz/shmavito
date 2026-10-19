import { SubmissionStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";
import { extractExternalItemId, normalizeAvitoUrl } from "@/lib/submissions";

const submissionSchema = z.object({
  sourceUrl: z.string().min(1).max(2048),
  categoryId: z.string().min(1),
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  price: z.number().int().nonnegative().max(2_000_000_000).nullable().optional(),
  city: z.string().trim().max(100).optional(),
  imageUrls: z.array(z.url()).max(5).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const submissions = await db.submission.findMany({
      where: { authorId: user.id, status: { not: SubmissionStatus.DELETED } },
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        listing: {
          select: {
            id: true,
            state: true,
            publishedAt: true,
            _count: { select: { likes: true, views: true } },
          },
        },
      },
    });
    return Response.json({ submissions });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = submissionSchema.parse(await request.json());
    const normalizedUrl = normalizeAvitoUrl(input.sourceUrl);

    const [category, limitSetting, pendingCount, duplicate] = await Promise.all([
      db.category.findFirst({ where: { id: input.categoryId, isVisible: true, deletedAt: null } }),
      db.setting.findUnique({ where: { key: "submissions.activeLimit" } }),
      db.submission.count({ where: { authorId: user.id, status: SubmissionStatus.PENDING } }),
      db.submission.findFirst({
        where: { normalizedUrl, status: { in: [SubmissionStatus.PENDING, SubmissionStatus.APPROVED] } },
        select: { id: true },
      }),
    ]);
    if (!category) throw new ApiError(400, "INVALID_CATEGORY", "Выберите существующую категорию.");
    const limit = typeof limitSetting?.value === "number" ? limitSetting.value : 3;
    if (pendingCount >= limit) {
      throw new ApiError(429, "SUBMISSION_LIMIT", `Можно иметь не больше ${limit} заявок на проверке.`);
    }
    if (duplicate) throw new ApiError(409, "DUPLICATE_SUBMISSION", "Это объявление уже отправлено.");

    const rawSnapshot = {
      title: input.title ?? null,
      description: input.description ?? null,
      price: input.price ?? null,
      city: input.city ?? null,
      imageUrls: input.imageUrls ?? [],
      importMode: input.title ? "manual" : "pending",
    };
    const submission = await db.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: {
          authorId: user.id,
          categoryId: category.id,
          sourceUrl: input.sourceUrl,
          normalizedUrl,
          externalItemId: extractExternalItemId(normalizedUrl),
          rawSnapshot,
        },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "submission.created",
          targetType: "Submission",
          targetId: created.id,
          afterJson: { status: created.status, categoryId: created.categoryId, normalizedUrl },
        },
      });
      return created;
    });
    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
