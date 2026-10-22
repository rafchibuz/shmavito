import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { importAvitoListing } from "@/lib/avito-import";
import { apiErrorResponse, assertSameOrigin, readJsonBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const importSchema = z.object({ sourceUrl: z.string().trim().min(1).max(2048) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await enforceRateLimit(request, { namespace: "avito:import", subject: user.id, limit: 12, windowSeconds: 10 * 60 });
    const { sourceUrl } = importSchema.parse(await readJsonBody(request, 16 * 1024));
    return Response.json(await importAvitoListing(sourceUrl));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
