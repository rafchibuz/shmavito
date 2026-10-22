import { runAvailabilityChecks } from "@/lib/availability";
import { requireModerator } from "@/lib/auth/session";
import { apiErrorResponse, assertSameOrigin } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const moderator = await requireModerator();
    await enforceRateLimit(request, { namespace: "availability:manual", subject: moderator.id, limit: 5, windowSeconds: 10 * 60 });
    return Response.json(await runAvailabilityChecks({ limit: 20, force: true, actorId: moderator.id }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
