import { TIMEZONE } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

export function assertIsoDate(value: string, label = "date"): string {
  if (!isIsoDate(value)) throw new Error(`Invalid ${label}: ${value}`);
  return value;
}

export function todayInKolkata(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  assertIsoDate(isoDate);
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

export function diffDays(start: string, end: string): number {
  assertIsoDate(start, "start");
  assertIsoDate(end, "end");
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function compareDates(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

export function eachDate(start: string, endExclusive: string): string[] {
  assertIsoDate(start);
  assertIsoDate(endExclusive);
  const dates: string[] = [];
  let cursor = start;
  while (cursor < endExclusive) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function eachDateInclusive(start: string, end: string): string[] {
  return eachDate(start, addDays(end, 1));
}

export function weekdaySundayZero(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function nowIso(now = new Date()): string {
  return now.toISOString();
}

export function formatDisplayDate(isoDate: string): string {
  assertIsoDate(isoDate);
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 6)));
}

export function formatInr(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(rupees);
}
