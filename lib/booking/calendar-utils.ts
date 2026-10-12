export const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const CALENDAR_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function monthMatrix(year: number, month: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month, 1));
  const startPad = first.getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function shiftMonth(cursor: { year: number; month: number }, delta: number) {
  const date = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function cursorFromIso(isoDate: string) {
  const [y, m] = isoDate.split("-").map(Number);
  return { year: y, month: m - 1 };
}

export type DateSelection = { checkIn: string | null; checkOut: string | null };

/** Select check-in / check-out on a property calendar (check-out is exclusive). */
export function selectStayDate(
  current: DateSelection,
  date: string,
  isSelectable: (iso: string) => boolean,
): DateSelection {
  if (!isSelectable(date)) return current;

  const { checkIn, checkOut } = current;
  if (!checkIn || (checkIn && checkOut) || date <= checkIn) {
    return { checkIn: date, checkOut: null };
  }
  return { checkIn, checkOut: date };
}

export function isInRange(date: string, checkIn: string | null, checkOut: string | null): boolean {
  if (!checkIn || !checkOut) return false;
  return date > checkIn && date < checkOut;
}

export function moveCalendarFocus(
  cells: Array<string | null>,
  current: string | null,
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown",
  fallbackDate: string,
): string | null {
  const flat = cells.filter((d): d is string => Boolean(d));
  if (flat.length === 0) return null;
  let index = current ? flat.indexOf(current) : flat.findIndex((d) => d >= fallbackDate);
  if (index < 0) index = 0;
  const delta = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : key === "ArrowUp" ? -7 : 7;
  const next = Math.min(flat.length - 1, Math.max(0, index + delta));
  return flat[next] ?? flat[0];
}
