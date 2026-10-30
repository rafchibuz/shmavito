import { ZodError } from "zod";
import { siteOrigin } from "@/lib/site-origin";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public headers?: HeadersInit,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new ApiError(403, "INVALID_ORIGIN", "Запрос пришёл с недоверенного источника.");
  }
  if (origin && origin !== siteOrigin(request)) {
    throw new ApiError(403, "INVALID_ORIGIN", "Запрос пришёл с недоверенного источника.");
  }
  if (!origin && process.env.NODE_ENV === "production") {
    throw new ApiError(403, "ORIGIN_REQUIRED", "Для изменяющего запроса требуется заголовок Origin.");
  }
}

export async function readJsonBody(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiError(415, "JSON_REQUIRED", "Ожидается JSON-запрос.");
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) {
    throw new ApiError(413, "BODY_TOO_LARGE", "Запрос слишком большой.");
  }
  if (!request.body) {
    throw new ApiError(400, "INVALID_JSON", "Некорректный JSON.");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, "BODY_TOO_LARGE", "Запрос слишком большой.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Некорректный JSON.");
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status, headers: error.headers });
  }

  if (error instanceof ZodError) {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "Проверьте заполненные поля.", issues: error.issues },
      { status: 400 },
    );
  }

  console.error(error);
  return Response.json(
    { error: "INTERNAL_ERROR", message: "Сервис временно недоступен." },
    { status: 500 },
  );
}
