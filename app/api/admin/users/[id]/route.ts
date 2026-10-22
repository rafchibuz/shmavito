import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin, readJsonBody } from "@/lib/http";

const userPatchSchema = z.object({
  role: z.enum([UserRole.USER, UserRole.MODERATOR]).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.BLOCKED]).optional(),
}).refine((value) => Object.keys(value).length > 0, "Нет изменений.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireModerator();
    const input = userPatchSchema.parse(await readJsonBody(request));
    const { id } = await context.params;
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, "NOT_FOUND", "Пользователь не найден.");
    if (target.role === UserRole.FOUNDER) {
      throw new ApiError(409, "FOUNDER_LOCKED", "Основателя нельзя изменить или заблокировать.");
    }
    if (input.role && actor.role !== UserRole.FOUNDER) {
      throw new ApiError(403, "FOUNDER_REQUIRED", "Роли может менять только основатель.");
    }
    if (input.status === UserStatus.BLOCKED && target.id === actor.id) {
      throw new ApiError(409, "SELF_BLOCK", "Нельзя заблокировать себя.");
    }

    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: input });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "user.updated",
          targetType: "User",
          targetId: id,
          beforeJson: { role: target.role, status: target.status, login: target.login },
          afterJson: { role: updated.role, status: updated.status, login: updated.login },
        },
      });
      return updated;
    });
    return Response.json({ user: { id: user.id, role: user.role, status: user.status } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
