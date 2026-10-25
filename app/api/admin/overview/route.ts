import { ListingState, ReportStatus, SubmissionStatus } from "@prisma/client";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireModerator();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [pendingCount, publishedCount, openReportCount, availabilityErrors24h, availabilityErrorGroups, lastAvailabilityCheck] = await Promise.all([
      db.submission.count({ where: { status: SubmissionStatus.PENDING } }),
      db.listing.count({ where: { deletedAt: null, state: { not: ListingState.DELETED } } }),
      db.report.count({ where: { status: ReportStatus.OPEN } }),
      db.availabilityCheck.count({ where: { result: "ERROR", checkedAt: { gte: since } } }),
      db.availabilityCheck.groupBy({
        by: ["errorCode"],
        where: { result: "ERROR", checkedAt: { gte: since } },
        _count: { _all: true },
      }),
      db.availabilityCheck.findFirst({ orderBy: { checkedAt: "desc" }, select: { checkedAt: true } }),
    ]);

    return Response.json(
      {
        pendingCount,
        publishedCount,
        openReportCount,
        availabilityErrors24h,
        availabilityErrorReasons24h: availabilityErrorGroups.map((group) => ({ code: group.errorCode || "UNKNOWN", count: group._count._all })),
        lastAvailabilityCheckAt: lastAvailabilityCheck?.checkedAt ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
