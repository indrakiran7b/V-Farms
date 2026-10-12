import type { GuestParty, PropertySettings } from "@/lib/types";
import { addDays, assertIsoDate, diffDays, todayInKolkata } from "@/lib/time/kolkata";

export class BookingValidationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "BookingValidationError";
  }
}

export function validateStayRequest(
  checkIn: string,
  checkOut: string,
  party: GuestParty,
  settings: PropertySettings,
  now = new Date(),
): void {
  assertIsoDate(checkIn, "check-in");
  assertIsoDate(checkOut, "check-out");
  if (checkOut <= checkIn) {
    throw new BookingValidationError("Check-out must be after check-in.", "DATE_ORDER", "checkOut");
  }
  const nights = diffDays(checkIn, checkOut);
  if (nights < settings.minNights) {
    throw new BookingValidationError(
      `Minimum stay is ${settings.minNights} night${settings.minNights === 1 ? "" : "s"}.`,
      "MIN_STAY",
      "checkOut",
    );
  }
  if (nights > settings.maxNights) {
    throw new BookingValidationError(
      `Maximum stay is ${settings.maxNights} nights.`,
      "MAX_STAY",
      "checkOut",
    );
  }
  const today = todayInKolkata(now);
  const minStart = addDays(today, settings.minAdvanceDays);
  if (checkIn < minStart) {
    throw new BookingValidationError("Those dates are inside the minimum advance window.", "ADVANCE_MIN", "checkIn");
  }
  const maxStart = addDays(today, settings.advanceBookingDays);
  if (checkIn > maxStart) {
    throw new BookingValidationError("Those dates are beyond the booking window.", "ADVANCE_MAX", "checkIn");
  }
  validateParty(party, settings);
}

export function validateParty(party: GuestParty, settings: PropertySettings): void {
  if (party.adults < 1) {
    throw new BookingValidationError("At least one adult is required.", "ADULTS", "adults");
  }
  if (party.adults > settings.maxAdults) {
    throw new BookingValidationError(`Adults cannot exceed ${settings.maxAdults}.`, "CAPACITY_ADULTS", "adults");
  }
  if (party.children < 0 || party.children > settings.maxChildren) {
    throw new BookingValidationError(`Children cannot exceed ${settings.maxChildren}.`, "CAPACITY_CHILDREN", "children");
  }
  if (party.adults + party.children > settings.maxGuests) {
    throw new BookingValidationError(
      `Guest count cannot exceed the configured property capacity of ${settings.maxGuests}.`,
      "CAPACITY",
      "adults",
    );
  }
}

export function validateEventDates(startDate: string, endDate: string): void {
  assertIsoDate(startDate, "start date");
  assertIsoDate(endDate, "end date");
  if (endDate < startDate) {
    throw new BookingValidationError("Event end date cannot be before the start date.", "DATE_ORDER", "endDate");
  }
}
