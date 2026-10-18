import { z } from "zod";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/http";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(60).optional(),
  position: z.number().int().min(0).max(1000).optional(),
  isVisible: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Нет изменений.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const moderator = await requireModerator();
    const input = patchSchema.parse(await request.json());
    const { id } = await context.params;
    const existing = await db.category.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Категория не найдена.");

    const category = await db.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id }, data: input });
      await tx.auditLog.create({
        data: {
          actorId: moderator.id,
          action: "category.updated",
          targetType: "Category",
          targetId: id,
          beforeJson: { name: existing.name, slug: existing.slug, position: existing.position, isVisible: existing.isVisible },
          afterJson: { name: updated.name, slug: updated.slug, position: updated.position, isVisible: updated.isVisible },
        },
      });
      return updated;
    });
    return Response.json({ category });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
