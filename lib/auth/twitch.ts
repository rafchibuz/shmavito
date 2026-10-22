import { UserRole } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string[];
  token_type: string;
};

type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string(),
  scope: z.array(z.string()),
  token_type: z.string().min(1),
});

const twitchUserSchema = z.object({
  id: z.string().min(1),
  login: z.string().min(1),
  display_name: z.string().min(1),
  profile_image_url: z.url().or(z.literal("")),
});

export function twitchConfig() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const redirectUri = process.env.TWITCH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export async function exchangeTwitchCode(code: string) {
  const config = twitchConfig();
  if (!config) throw new Error("Twitch OAuth is not configured.");

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Twitch token exchange failed (${response.status}).`);
  return tokenResponseSchema.parse(await response.json()) as TwitchTokenResponse;
}

export async function fetchTwitchUser(accessToken: string) {
  const config = twitchConfig();
  if (!config) throw new Error("Twitch OAuth is not configured.");
  const response = await fetch("https://api.twitch.tv/helix/users", {
    headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": config.clientId },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Twitch user request failed (${response.status}).`);
  const payload = z.object({ data: z.array(twitchUserSchema).max(1) }).parse(await response.json());
  if (!payload.data[0]) throw new Error("Twitch did not return a user profile.");
  return payload.data[0] as TwitchUser;
}

export async function upsertTwitchUser(profile: TwitchUser) {
  const founderLogin = (process.env.FOUNDER_TWITCH_LOGIN || "rafchibiskus").toLowerCase();
  const configuredFounderId = process.env.FOUNDER_TWITCH_ID;

  return db.$transaction(async (tx) => {
    const founderSetting = await tx.setting.findUnique({ where: { key: "auth.founderTwitchId" } });
    let founderId = configuredFounderId || (typeof founderSetting?.value === "string" ? founderSetting.value : null);

    if (!founderId && profile.login.toLowerCase() === founderLogin) {
      founderId = profile.id;
      await tx.setting.upsert({
        where: { key: "auth.founderTwitchId" },
        update: { value: profile.id },
        create: { key: "auth.founderTwitchId", value: profile.id },
      });
    }

    const isFounder = founderId === profile.id;
    return tx.user.upsert({
      where: { twitchId: profile.id },
      update: {
        login: profile.login.toLowerCase(),
        displayName: profile.display_name,
        avatarUrl: profile.profile_image_url || null,
        ...(isFounder ? { role: UserRole.FOUNDER } : {}),
      },
      create: {
        twitchId: profile.id,
        login: profile.login.toLowerCase(),
        displayName: profile.display_name,
        avatarUrl: profile.profile_image_url || null,
        role: isFounder ? UserRole.FOUNDER : UserRole.USER,
      },
    });
  });
}
