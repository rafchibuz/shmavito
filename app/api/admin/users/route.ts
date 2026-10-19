import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireModerator();
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 50);
    const users = await db.user.findMany({
      where: query ? {
        OR: [
          { login: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        login: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { submissions: true, comments: true } },
      },
    });
    return Response.json({ users });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
