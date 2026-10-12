import { getAdminSession, requirePermission, type SessionPayload } from "@/lib/auth/session";
import type { AdminRole } from "@/lib/types";

export async function requireAdmin(permission?: string): Promise<SessionPayload> {
  const session = await getAdminSession();
  if (!session) {
    const error = new Error("Unauthorized");
    error.name = "UnauthorizedError";
    throw error;
  }
  if (permission) requirePermission(session.role, permission);
  return session;
}

export function actorFrom(session: SessionPayload): { id: string; role: AdminRole } {
  return { id: session.sub, role: session.role };
}
