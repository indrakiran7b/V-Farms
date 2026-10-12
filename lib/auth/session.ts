import { cookies } from "next/headers";
import { verifyPassword } from "@/lib/crypto";
import { getStore } from "@/lib/data/store";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE,
  readSession,
  signSession,
  type SessionPayload,
} from "@/lib/auth/token";
import type { AdminUser } from "@/lib/types";

export type { SessionPayload };
export { readSession, signSession };

export async function getAdminSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return readSession(jar.get(ADMIN_COOKIE)?.value);
}

export async function setAdminSession(user: AdminUser): Promise<void> {
  const jar = await cookies();
  const token = await signSession({ sub: user.id, email: user.email, role: user.role });
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export function authenticateAdmin(email: string, password: string): AdminUser | null {
  const store = getStore();
  const user = store.admins.find((item) => item.email === email.trim().toLowerCase());
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export { can, canAccessAudit, isPrivilegedFinance, requirePermission, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
