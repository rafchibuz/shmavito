import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireFounder } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin, readJsonBody } from "@/lib/http";

const roleSchema = z.object({
  login: z.string().trim().min(2).max(25).transform((value) => value.toLowerCase()),
  role: z.enum([UserRole.USER, UserRole.MODERATOR]),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const founder = await requireFounder();
    const input = roleSchema.parse(await readJsonBody(request));
    const target = await db.user.findFirst({ where: { login: input.login }, orderBy: { updatedAt: "desc" } });
    if (!target) {
      throw new ApiError(404, "USER_NOT_FOUND", "Пользователь должен хотя бы один раз войти через Twitch.");
    }
    if (target.role === UserRole.FOUNDER) {
      throw new ApiError(409, "FOUNDER_ROLE_LOCKED", "Роль основателя нельзя изменить.");
    }

    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: target.id }, data: { role: input.role } });
      await tx.auditLog.create({
        data: {
          actorId: founder.id,
          action: "user.role.updated",
          targetType: "User",
          targetId: target.id,
          beforeJson: { role: target.role, login: target.login, twitchId: target.twitchId },
          afterJson: { role: updated.role, login: updated.login, twitchId: updated.twitchId },
        },
      });
      return updated;
    });
    return Response.json({ user: { id: user.id, login: user.login, displayName: user.displayName, role: user.role } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
