import { BookingValidationError } from "@/lib/inventory/validate";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof BookingValidationError) {
    return json({ error: error.message, code: error.code, field: error.field }, 400);
  }
  if (error instanceof Error && error.name === "UnauthorizedError") {
    return json({ error: "Unauthorized" }, 401);
  }
  if (error instanceof Error && error.name === "ForbiddenError") {
    return json({ error: "Forbidden" }, 403);
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return json({ error: message }, 500);
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
