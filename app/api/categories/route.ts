import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    const categories = await db.category.findMany({
      where: { isVisible: true, deletedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    });
    return Response.json({ categories });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
