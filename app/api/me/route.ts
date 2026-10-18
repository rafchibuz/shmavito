import { getSessionUser } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ user: null }, { status: 401 });
    return Response.json({ user });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
