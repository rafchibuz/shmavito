import "server-only";
import { db } from "@/lib/db";
import { defaultSocialLinks, SOCIAL_SETTING_KEY, socialLinksSchema } from "@/lib/social-links-config";

export async function getSocialLinks() {
  const setting = await db.setting.findUnique({ where: { key: SOCIAL_SETTING_KEY } });
  const parsed = socialLinksSchema.safeParse(setting?.value);
  return parsed.success ? parsed.data : defaultSocialLinks;
}
