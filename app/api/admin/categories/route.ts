import { z } from "zod";
import { requireModerator } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse, assertSameOrigin, readJsonBody } from "@/lib/http";

const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(60),
  position: z.number().int().min(0).max(1000).default(0),
  isVisible: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireModerator();
    const categories = await db.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    return Response.json({ categories });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const moderator = await requireModerator();
    const input = categorySchema.parse(await readJsonBody(request));
    const category = await db.$transaction(async (tx) => {
      const created = await tx.category.create({ data: input });
      await tx.auditLog.create({
        data: {
          actorId: moderator.id,
          action: "category.created",
          targetType: "Category",
          targetId: created.id,
          afterJson: { name: created.name, slug: created.slug, position: created.position, isVisible: created.isVisible },
        },
      });
      return created;
    });
    return Response.json({ category }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
