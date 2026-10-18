import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, "INVALID_ORIGIN", "Запрос пришёл с недоверенного источника.");
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
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
