import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireModerator();
    const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    const actorIds = [...new Set(logs.flatMap((log) => log.actorId ? [log.actorId] : []))];
    const actors = await db.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, login: true, displayName: true },
    });
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    return Response.json({
      logs: logs.map((log) => ({ ...log, actor: log.actorId ? actorById.get(log.actorId) ?? null : null })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
