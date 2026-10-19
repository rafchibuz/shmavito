import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse, assertSameOrigin } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
    });
    return Response.json({ notifications });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const result = await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return Response.json({ updated: result.count });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
