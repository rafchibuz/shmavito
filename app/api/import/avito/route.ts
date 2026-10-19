import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { importAvitoListing } from "@/lib/avito-import";
import { apiErrorResponse, assertSameOrigin } from "@/lib/http";

const importSchema = z.object({ sourceUrl: z.string().trim().min(1).max(2048) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireUser();
    const { sourceUrl } = importSchema.parse(await request.json());
    return Response.json(await importAvitoListing(sourceUrl));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
