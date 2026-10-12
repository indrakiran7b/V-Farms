import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(10).toString("hex")}`;
}

export function bookingReference(prefix: string): string {
  const token = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${token}`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, derived] = stored.split(":");
  if (!salt || !derived) return false;
  const next = scryptSync(password, salt, 64).toString("hex");
  return safeEqualHex(derived, next);
}
