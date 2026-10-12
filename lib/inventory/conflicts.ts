import type { HoldPurpose, InventoryBlock, InventoryHold } from "@/lib/types";
import { addDays, compareDates } from "@/lib/time/kolkata";

/**
 * V-Farms is one property-wide booking inventory for both stays and events.
 *
 * Stay occupancy uses half-open nights [checkIn, checkOut).
 * Events use inclusive calendar dates [start, end] and, under INV-04, cannot
 * share a stay's arrival or departure date.
 */

export function stayNightsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function inclusiveOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return compareDates(aStart, bEnd) <= 0 && compareDates(bStart, aEnd) <= 0;
}

function eventRangeAgainstStay(stayStart: string, stayEnd: string): { start: string; end: string } {
  return { start: stayStart, end: stayEnd };
}

export function stayConflictsWithStay(
  checkIn: string,
  checkOut: string,
  otherCheckIn: string,
  otherCheckOut: string,
  turnoverSameDayAllowed: boolean,
): boolean {
  if (turnoverSameDayAllowed) {
    return stayNightsOverlap(checkIn, checkOut, otherCheckIn, otherCheckOut);
  }
  return inclusiveOverlap(checkIn, addDays(checkOut, -1), otherCheckIn, addDays(otherCheckOut, -1)) ||
    checkIn === otherCheckOut ||
    checkOut === otherCheckIn;
}

export function eventConflictsWithEvent(
  start: string,
  end: string,
  otherStart: string,
  otherEnd: string,
): boolean {
  return inclusiveOverlap(start, end, otherStart, otherEnd);
}

export function eventConflictsWithStay(
  eventStart: string,
  eventEnd: string,
  stayCheckIn: string,
  stayCheckOut: string,
): boolean {
  const blocked = eventRangeAgainstStay(stayCheckIn, stayCheckOut);
  return inclusiveOverlap(eventStart, eventEnd, blocked.start, blocked.end);
}

export function stayConflictsWithMaintenance(
  checkIn: string,
  checkOut: string,
  blockStart: string,
  blockEnd: string,
): boolean {
  return stayNightsOverlap(checkIn, checkOut, blockStart, addDays(blockEnd, 1));
}

export function eventConflictsWithMaintenance(
  eventStart: string,
  eventEnd: string,
  blockStart: string,
  blockEnd: string,
): boolean {
  return inclusiveOverlap(eventStart, eventEnd, blockStart, blockEnd);
}

export interface ProposedOccupation {
  purpose: HoldPurpose;
  startDate: string;
  endDate: string;
}

export function isActiveBlock(block: InventoryBlock, nowIso: string): boolean {
  if (block.expiresAt && block.expiresAt <= nowIso) return false;
  return block.status === "active" || block.status === "confirmed" || block.status === "held";
}

export function isActiveHold(hold: InventoryHold, nowIso: string): boolean {
  return hold.status === "active" && hold.expiresAt > nowIso;
}

/** Nights in [checkIn, checkOut) that cannot be booked as part of a whole-estate stay. */
export function conflictingStayNights(
  checkIn: string,
  checkOut: string,
  blocks: InventoryBlock[],
  nowIso: string,
  turnoverSameDayAllowed: boolean,
): string[] {
  const unavailable: string[] = [];
  let cursor = checkIn;
  while (cursor < checkOut) {
    const nightEnd = addDays(cursor, 1);
    const nightConflicts = findConflicts(
      { purpose: "stay", startDate: cursor, endDate: nightEnd },
      blocks,
      nowIso,
      turnoverSameDayAllowed,
    );
    if (nightConflicts.length > 0) unavailable.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return unavailable;
}

export function findConflicts(
  proposed: ProposedOccupation,
  blocks: InventoryBlock[],
  nowIso: string,
  turnoverSameDayAllowed: boolean,
): InventoryBlock[] {
  return blocks.filter((block) => {
    if (!isActiveBlock(block, nowIso)) return false;

    if (proposed.purpose === "stay") {
      if (block.kind === "event" || (block.kind === "hold" && block.holdPurpose === "event")) {
        return eventConflictsWithStay(block.startDate, block.endDate, proposed.startDate, proposed.endDate);
      }
      if (block.kind === "maintenance" || block.kind === "admin") {
        return stayConflictsWithMaintenance(proposed.startDate, proposed.endDate, block.startDate, block.endDate);
      }
      return stayConflictsWithStay(
        proposed.startDate,
        proposed.endDate,
        block.startDate,
        block.endDate,
        turnoverSameDayAllowed,
      );
    }

    if (block.kind === "event" || (block.kind === "hold" && block.holdPurpose === "event")) {
      return eventConflictsWithEvent(proposed.startDate, proposed.endDate, block.startDate, block.endDate);
    }
    if (block.kind === "maintenance" || block.kind === "admin") {
      return eventConflictsWithMaintenance(proposed.startDate, proposed.endDate, block.startDate, block.endDate);
    }
    return eventConflictsWithStay(proposed.startDate, proposed.endDate, block.startDate, block.endDate);
  });
}

export function occupiedDatesForStay(blocks: InventoryBlock[], nowIso: string): Set<string> {
  const nights = new Set<string>();
  for (const block of blocks) {
    if (!isActiveBlock(block, nowIso)) continue;
    if (block.kind === "event" || (block.kind === "hold" && block.holdPurpose === "event")) {
      let cursor = block.startDate;
      while (cursor <= block.endDate) {
        nights.add(cursor);
        cursor = addDays(cursor, 1);
      }
      continue;
    }
    const endExclusive =
      block.stayHalfOpen || block.kind === "stay" || block.holdPurpose === "stay"
        ? block.endDate
        : addDays(block.endDate, 1);
    let cursor = block.startDate;
    while (cursor < endExclusive) {
      nights.add(cursor);
      cursor = addDays(cursor, 1);
    }
  }
  return nights;
}
