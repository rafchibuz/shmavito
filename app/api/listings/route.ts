import { getSessionUser } from "@/lib/auth/session";
import { getCatalogPayload } from "@/lib/catalog-data";
import { apiErrorResponse } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    const url = new URL(request.url);
    const category = url.searchParams.get("category")?.trim();
    const query = url.searchParams.get("q")?.trim().slice(0, 100);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 60, 1), 100);

    return Response.json(await getCatalogPayload({ user, category, query, limit }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
