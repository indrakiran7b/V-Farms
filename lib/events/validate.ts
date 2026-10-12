import type { PropertySettings } from "@/lib/types";
import { BookingValidationError, validateEventDates } from "@/lib/inventory/validate";
import { todayInKolkata, addDays } from "@/lib/time/kolkata";

export function validateEventEnquiry(input: {
  organizer: { name: string; email: string; phone: string };
  eventType: string;
  startDate: string;
  endDate: string;
  expectedAttendance: number;
  preferredStartTime: string;
  preferredEndTime: string;
  policyAccepted: boolean;
  privacyAccepted: boolean;
  settings: PropertySettings;
}): void {
  if (!input.policyAccepted) {
    throw new BookingValidationError("Event policy acceptance is required.", "POLICY", "policyAccepted");
  }
  if (!input.privacyAccepted) {
    throw new BookingValidationError("Privacy acknowledgement is required.", "POLICY", "privacyAccepted");
  }
  const name = input.organizer.name.trim();
  if (name.length < 2) {
    throw new BookingValidationError("Organizer name is required.", "ORGANIZER", "name");
  }
  const email = input.organizer.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BookingValidationError("A valid email address is required.", "ORGANIZER", "email");
  }
  const phone = input.organizer.phone.trim();
  if (phone.length < 8) {
    throw new BookingValidationError("A valid phone number is required.", "ORGANIZER", "phone");
  }
  if (!input.eventType.trim()) {
    throw new BookingValidationError("Event category is required.", "EVENT_TYPE", "eventType");
  }
  validateEventDates(input.startDate, input.endDate);
  const today = todayInKolkata();
  if (input.startDate < today) {
    throw new BookingValidationError("Event dates cannot be in the past.", "DATE_PAST", "startDate");
  }
  const maxStart = addDays(today, input.settings.advanceBookingDays);
  if (input.startDate > maxStart) {
    throw new BookingValidationError("Those dates are beyond the booking window.", "ADVANCE_MAX", "startDate");
  }
  if (input.expectedAttendance < 1) {
    throw new BookingValidationError("Expected attendance must be at least 1.", "ATTENDANCE", "expectedAttendance");
  }
  if (input.expectedAttendance > input.settings.maxEventAttendance) {
    throw new BookingValidationError(
      `Expected attendance cannot exceed ${input.settings.maxEventAttendance} until owner-certified limits are published.`,
      "ATTENDANCE",
      "expectedAttendance",
    );
  }
}
