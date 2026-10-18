import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { exchangeTwitchCode, fetchTwitchUser, upsertTwitchUser } from "@/lib/auth/twitch";

const OAUTH_STATE_COOKIE = "shmavito_oauth_state";
const RETURN_TO_COOKIE = "shmavito_return_to";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const returnTo = request.cookies.get(RETURN_TO_COOKIE)?.value || "/";

  if (!state || !code || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth=invalid_state", requestUrl.origin));
  }

  try {
    const token = await exchangeTwitchCode(code);
    const profile = await fetchTwitchUser(token.access_token);
    const user = await upsertTwitchUser(profile);
    const session = await createSessionToken(user.id);
    const response = NextResponse.redirect(new URL(returnTo, requestUrl.origin));
    response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.delete(RETURN_TO_COOKIE);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/?auth=failed", requestUrl.origin));
  }
}
