import { requireFounder, requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse, assertSameOrigin, readJsonBody } from "@/lib/http";
import { getSocialLinks } from "@/lib/social-links";
import { SOCIAL_SETTING_KEY, socialLinksSchema } from "@/lib/social-links-config";

export async function GET() {
  try {
    const user = await requireModerator();
    return Response.json({ links: await getSocialLinks(), editable: user.role === "FOUNDER" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const founder = await requireFounder();
    const links = socialLinksSchema.parse(await readJsonBody(request, 800 * 1024));
    const previous = await getSocialLinks();
    await db.$transaction([
      db.setting.upsert({
        where: { key: SOCIAL_SETTING_KEY },
        update: { value: links, updatedBy: founder.id },
        create: { key: SOCIAL_SETTING_KEY, value: links, updatedBy: founder.id },
      }),
      db.auditLog.create({
        data: {
          actorId: founder.id,
          action: "setting.socialLinks.updated",
          targetType: "Setting",
          targetId: SOCIAL_SETTING_KEY,
          beforeJson: { links: previous.map(({ customIcon, ...link }) => ({ ...link, customIcon: customIcon ? "[image]" : undefined })) },
          afterJson: { links: links.map(({ customIcon, ...link }) => ({ ...link, customIcon: customIcon ? "[image]" : undefined })) },
        },
      }),
    ]);
    return Response.json({ links });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
