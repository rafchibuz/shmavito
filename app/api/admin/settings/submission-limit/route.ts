import { z } from "zod";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse, assertSameOrigin } from "@/lib/http";

const settingSchema = z.object({ limit: z.number().int().min(1).max(100) });

export async function GET() {
  try {
    await requireModerator();
    const setting = await db.setting.findUnique({ where: { key: "submissions.activeLimit" } });
    return Response.json({ limit: typeof setting?.value === "number" ? setting.value : 3 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const moderator = await requireModerator();
    const { limit } = settingSchema.parse(await request.json());
    const previous = await db.setting.findUnique({ where: { key: "submissions.activeLimit" } });
    await db.$transaction([
      db.setting.upsert({
        where: { key: "submissions.activeLimit" },
        update: { value: limit, updatedBy: moderator.id },
        create: { key: "submissions.activeLimit", value: limit, updatedBy: moderator.id },
      }),
      db.auditLog.create({
        data: {
          actorId: moderator.id,
          action: "setting.submissionLimit.updated",
          targetType: "Setting",
          targetId: "submissions.activeLimit",
          beforeJson: { value: previous?.value ?? 3 },
          afterJson: { value: limit },
        },
      }),
    ]);
    return Response.json({ limit });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
