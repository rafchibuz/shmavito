import { SubmissionStatus } from "@prisma/client";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireModerator();
    const submissions = await db.submission.findMany({
      where: { status: SubmissionStatus.PENDING },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, login: true, displayName: true, avatarUrl: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    return Response.json({ submissions });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
