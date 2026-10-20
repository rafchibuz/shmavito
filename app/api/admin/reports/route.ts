import { ReportStatus } from "@prisma/client";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireModerator();
    const requestedStatus = new URL(request.url).searchParams.get("status");
    const status = requestedStatus && Object.values(ReportStatus).includes(requestedStatus as ReportStatus)
      ? requestedStatus as ReportStatus
      : undefined;
    const reports = await db.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        reporter: { select: { login: true, displayName: true, avatarUrl: true } },
        listing: { select: { id: true, title: true } },
        comment: { select: { id: true, body: true, listing: { select: { id: true, title: true } } } },
      },
    });
    return Response.json({ reports });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
