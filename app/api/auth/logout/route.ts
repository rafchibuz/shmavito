import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { apiErrorResponse, assertSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
