import { timingSafeEqual } from "node:crypto";
import { runAvailabilityChecks } from "@/lib/availability";
import { ApiError, apiErrorResponse } from "@/lib/http";

function authorizeCron(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 32) throw new ApiError(503, "CRON_NOT_CONFIGURED", "CRON_SECRET не настроен.");
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new ApiError(401, "UNAUTHORIZED", "Неверный ключ фоновой задачи.");
  }
}

export async function POST(request: Request) {
  try {
    authorizeCron(request);
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit")) || 20;
    return Response.json(await runAvailabilityChecks({ limit: requestedLimit }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
