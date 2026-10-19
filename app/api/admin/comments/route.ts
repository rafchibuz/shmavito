import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireModerator();
    const comments = await db.comment.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: { select: { login: true, displayName: true, avatarUrl: true } },
        listing: { select: { id: true, title: true } },
      },
    });
    return Response.json({ comments });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
