import type { AppStore } from "@/lib/types";
import { eachDate, eachDateInclusive, isIsoDate } from "@/lib/time/kolkata";
import { isActiveHold } from "@/lib/inventory/conflicts";

export type CalendarEntryKind = "stay" | "event" | "hold" | "maintenance" | "admin";

export type CalendarEntry = {
  id: string;
  kind: CalendarEntryKind;
  status: string;
  startDate: string;
  endDate: string;
  reference: string;
  title: string;
  subtitle: string;
  expiresAt: string | null;
  sourceId: string;
  blockId?: string;
};

export function buildCalendarEntries(store: AppStore, from: string, to: string, at: string): CalendarEntry[] {
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) return [];
  const range = new Set(eachDateInclusive(from, to));
  const inRange = (start: string, end: string) =>
    eachDateInclusive(start, end).some((day) => range.has(day));

  const entries: CalendarEntry[] = [];

  for (const stay of store.stays) {
    const stayNights = eachDate(stay.checkIn, stay.checkOut);
    if (!stayNights.some((day) => range.has(day))) continue;
    entries.push({
      id: `stay-${stay.id}`,
      kind: "stay",
      status: stay.status,
      startDate: stay.checkIn,
      endDate: stay.checkOut,
      reference: stay.reference,
      title: stay.guest.name,
      subtitle: `${stay.party.adults} adults · whole property`,
      expiresAt: stay.holdExpiresAt,
      sourceId: stay.id,
    });
  }

  for (const enquiry of store.enquiries) {
    if (!["confirmed", "awaiting_deposit", "quote_sent", "review"].includes(enquiry.status)) continue;
    if (!inRange(enquiry.startDate, enquiry.endDate)) continue;
    entries.push({
      id: `event-${enquiry.id}`,
      kind: "event",
      status: enquiry.status,
      startDate: enquiry.startDate,
      endDate: enquiry.endDate,
      reference: enquiry.reference,
      title: enquiry.eventType,
      subtitle: enquiry.organizer.name,
      expiresAt: null,
      sourceId: enquiry.id,
    });
  }

  for (const hold of store.holds) {
    if (!isActiveHold(hold, at)) continue;
    if (!inRange(hold.startDate, hold.endDate)) continue;
    entries.push({
      id: `hold-${hold.id}`,
      kind: "hold",
      status: hold.status,
      startDate: hold.startDate,
      endDate: hold.endDate,
      reference: hold.purpose.toUpperCase(),
      title: `${hold.purpose} hold`,
      subtitle: hold.sourceId ?? "—",
      expiresAt: hold.expiresAt,
      sourceId: hold.id,
    });
  }

  for (const block of store.blocks) {
    if (block.kind === "hold") continue;
    if (block.expiresAt && block.expiresAt <= at) continue;
    if (!inRange(block.startDate, block.endDate)) continue;
    if (block.kind === "stay" || block.kind === "event") continue;
    entries.push({
      id: `block-${block.id}`,
      kind: block.kind === "maintenance" ? "maintenance" : block.kind === "admin" ? "admin" : block.kind,
      status: block.status,
      startDate: block.startDate,
      endDate: block.endDate,
      reference: block.kind,
      title: block.reason ?? block.kind,
      subtitle: block.internalNotes ?? "Property closure",
      expiresAt: block.expiresAt,
      sourceId: block.sourceId,
      blockId: block.id,
    });
  }

  return entries.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
