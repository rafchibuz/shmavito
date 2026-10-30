import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth/session";
import { twitchConfig } from "@/lib/auth/twitch";
import { apiErrorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { safeReturnTo } from "@/lib/auth/return-to";

const OAUTH_STATE_COOKIE = "shmavito_oauth_state";
const RETURN_TO_COOKIE = "shmavito_return_to";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, { namespace: "auth:start", limit: 20, windowSeconds: 10 * 60 });
    const config = twitchConfig();
    if (!config) {
      return Response.json(
        { error: "TWITCH_NOT_CONFIGURED", message: "Добавьте Twitch Client ID и Secret в .env.local." },
        { status: 503 },
      );
    }

    const requestUrl = new URL(request.url);
    const returnTo = safeReturnTo(requestUrl.searchParams.get("returnTo"));
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
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(OAUTH_STATE_COOKIE, state, { ...sessionCookieOptions(), maxAge: 10 * 60 });
    response.cookies.set(RETURN_TO_COOKIE, returnTo, { ...sessionCookieOptions(), maxAge: 10 * 60 });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
