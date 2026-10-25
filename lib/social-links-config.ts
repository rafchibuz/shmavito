import { z } from "zod";

export const SOCIAL_SETTING_KEY = "site.socialLinks";

export const socialIconPaths = {
  telegram: "/images/social/telegram.png",
  twitch: "/images/social/twitch.png",
  youtube: "/images/social/youtube.png",
} as const;

export const socialIconNames: Record<keyof typeof socialIconPaths, string> = {
  telegram: "Telegram",
  twitch: "Twitch",
  youtube: "YouTube",
};

const customImageSchema = z.string().max(120_000).refine((value) => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  let decoded: string;
  try { decoded = atob(match[2]); } catch { return false; }
  const image = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  if (!image.length || image.length > 80 * 1024) return false;
  if (match[1] === "png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => image[index] === byte);
  if (match[1] === "jpeg") return image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  return String.fromCharCode(...image.subarray(0, 4)) === "RIFF" && String.fromCharCode(...image.subarray(8, 12)) === "WEBP";
}, "Загрузите PNG, JPEG или WebP до 80 КБ.");

export const socialLinkSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  label: z.string().trim().min(1).max(40),
  url: z.string().trim().max(500).refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }, "Укажите ссылку HTTPS."),
  icon: z.enum(["telegram", "twitch", "youtube", "custom"]),
  customIcon: customImageSchema.optional(),
}).refine((link) => link.icon !== "custom" || Boolean(link.customIcon), "Загрузите свою иконку.");

export const socialLinksSchema = z.array(socialLinkSchema).max(8).refine((links) =>
  new Set(links.map((link) => link.id)).size === links.length,
"Повторяющиеся ссылки.");

export type SocialLink = z.infer<typeof socialLinkSchema>;

export const defaultSocialLinks: SocialLink[] = [
  { id: "telegram", label: "Telegram STEEL", url: "https://t.me/steelstaya", icon: "telegram" },
  { id: "twitch", label: "Twitch STEEL", url: "https://www.twitch.tv/steel", icon: "twitch" },
  { id: "youtube", label: "YouTube STEEL", url: "https://www.youtube.com/channel/UC-o_cRtKA9IIkYBpceKU8ZA", icon: "youtube" },
];

export function socialIconSource(link: SocialLink) {
  return link.icon === "custom" ? link.customIcon || socialIconPaths.telegram : socialIconPaths[link.icon];
}
