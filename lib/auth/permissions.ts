import type { AdminRole } from "@/lib/types";

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  owner: ["*"],
  reservations: [
    "calendar.read",
    "calendar.write",
    "bookings.read",
    "bookings.write",
    "events.read",
    "events.write",
    "payments.read",
  ],
  operations: ["calendar.read", "bookings.read", "events.read", "operations.write"],
  content: ["content.read", "content.write"],
};

export function can(role: AdminRole, permission: string): boolean {
  const granted = ROLE_PERMISSIONS[role];
  return granted.includes("*") || granted.includes(permission);
}

export function requirePermission(role: AdminRole, permission: string): void {
  if (!can(role, permission)) {
    const error = new Error("Forbidden");
    error.name = "ForbiddenError";
    throw error;
  }
}

export function canAccessAudit(role: AdminRole): boolean {
  return role === "owner";
}

export function isPrivilegedFinance(role: AdminRole): boolean {
  return role === "owner";
}
