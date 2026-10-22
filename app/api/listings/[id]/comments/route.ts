import { ListingState } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ApiError, apiErrorResponse, assertSameOrigin, readJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const commentSchema = z.object({
  body: z.string().trim().min(1).max(500),
  parentId: z.string().min(1).nullable().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const listing = await db.listing.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!listing) throw new ApiError(404, "NOT_FOUND", "Объявление не найдено.");
    const comments = await db.comment.findMany({
      where: { listingId: id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        body: true,
        parentId: true,
        createdAt: true,
        author: { select: { id: true, login: true, displayName: true, avatarUrl: true } },
      },
    });
    return Response.json({ comments });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, { namespace: "comment:create", subject: user.id, limit: 20, windowSeconds: 60 });
    const input = commentSchema.parse(await readJsonBody(request, 8 * 1024));
    const { id } = await context.params;
    const listing = await db.listing.findFirst({ where: { id, deletedAt: null }, select: { state: true } });
    if (!listing) throw new ApiError(404, "NOT_FOUND", "Объявление не найдено.");
    if (listing.state !== ListingState.ACTIVE) throw new ApiError(409, "LISTING_UNAVAILABLE", "Комментарии к снятому объявлению закрыты.");

    const parent = input.parentId ? await db.comment.findFirst({
      where: { id: input.parentId, listingId: id, deletedAt: null },
      select: { id: true, authorId: true },
    }) : null;
    if (input.parentId && !parent) throw new ApiError(400, "INVALID_PARENT", "Комментарий для ответа не найден.");

    const comment = await db.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { listingId: id, authorId: user.id, parentId: parent?.id, body: input.body },
        select: {
          id: true,
          body: true,
          parentId: true,
          createdAt: true,
          author: { select: { id: true, login: true, displayName: true, avatarUrl: true } },
        },
      });
      if (parent && parent.authorId !== user.id) {
        await tx.notification.create({
          data: { userId: parent.authorId, type: "comment.reply", payload: { listingId: id, commentId: created.id } },
        });
      }
      return created;
    });
    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
