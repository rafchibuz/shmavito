import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth/session";
import { twitchConfig } from "@/lib/auth/twitch";

const OAUTH_STATE_COOKIE = "shmavito_oauth_state";
const RETURN_TO_COOKIE = "shmavito_return_to";

export async function GET(request: Request) {
  const config = twitchConfig();
  if (!config) {
    return Response.json(
      { error: "TWITCH_NOT_CONFIGURED", message: "Добавьте Twitch Client ID и Secret в .env.local." },
      { status: 503 },
    );
  }

  const requestUrl = new URL(request.url);
  const requestedReturnTo = requestUrl.searchParams.get("returnTo") || "/";
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
    ? requestedReturnTo
    : "/";
  const state = crypto.randomUUID().replaceAll("-", "");
  const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "",
    state,
  }).toString();

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, { ...sessionCookieOptions(), maxAge: 10 * 60 });
  response.cookies.set(RETURN_TO_COOKIE, returnTo, { ...sessionCookieOptions(), maxAge: 10 * 60 });
  return response;
}
