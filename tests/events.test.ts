import { afterEach, describe, expect, it } from "vitest";
import { createDevSeed } from "@/lib/data/seed";
import {
  acceptQuoteAndHold,
  createAndSendQuote,
  createEventEnquiry,
  createStayHold,
  confirmStayFromVerifiedPayment,
  declineQuoteByOrganizer,
  getStore,
  publicAvailability,
  resetMemoryStore,
} from "@/lib/data/store";
import { paymentFromCapture } from "@/lib/payments/razorpay";
import { validateEventEnquiry } from "@/lib/events/validate";
import { BookingValidationError } from "@/lib/inventory/validate";

const guest = { name: "Ravi Menon", email: "ravi@example.com", phone: "9876501234" };
const baseEnquiry = {
  organizer: guest,
  eventType: "Retreat",
  startDate: "2026-12-10",
  endDate: "2026-12-10",
  expectedAttendance: 50,
  preferredTiming: "10:00 – 18:00",
  preferredStartTime: "10:00",
  preferredEndTime: "18:00",
  cateringNotes: "",
  decorationNotes: "",
  vendorNotes: "",
  setupNotes: "",
  accommodationRequested: false,
  additionalNotes: "",
  policyAccepted: true,
  privacyAccepted: true,
};

afterEach(() => {
  resetMemoryStore(createDevSeed());
});

describe("event enquiries", () => {
  it("rejects invalid contact and missing privacy acceptance", () => {
    const settings = createDevSeed().settings;
    expect(() =>
      validateEventEnquiry({
        organizer: { ...guest, email: "bad" },
        eventType: "Wedding",
        startDate: "2026-12-01",
        endDate: "2026-12-01",
        expectedAttendance: 20,
        preferredStartTime: "09:00",
        preferredEndTime: "17:00",
        policyAccepted: true,
        privacyAccepted: true,
        settings,
      }),
    ).toThrow(BookingValidationError);
    expect(() =>
      validateEventEnquiry({
        organizer: guest,
        eventType: "Wedding",
        startDate: "2026-12-01",
        endDate: "2026-12-01",
        expectedAttendance: 20,
        preferredStartTime: "09:00",
        preferredEndTime: "17:00",
        policyAccepted: true,
        privacyAccepted: false,
        settings,
      }),
    ).toThrow(BookingValidationError);
  });

  it("does not block inventory for pending enquiries", async () => {
    await createEventEnquiry(baseEnquiry);
    const open = publicAvailability("2026-12-10", "2026-12-10");
    expect(open.dates[0]?.available).toBe(true);
  });

  it("versions quotes and secures customer access tokens", async () => {
    const enquiry = await createEventEnquiry(baseEnquiry);
    const q1 = await createAndSendQuote({
      enquiryId: enquiry.id,
      overnightRoomsIncluded: false,
      inclusions: ["Estate"],
      exclusions: [],
      lines: [{ label: "Day use", amountPaise: 8000000, inclusion: true }],
      depositPaise: 4000000,
      expiresAt: "2027-01-01T00:00:00.000Z",
      actor: { id: "admin-owner", role: "owner" },
    });
    const q2 = await createAndSendQuote({
      enquiryId: enquiry.id,
      overnightRoomsIncluded: false,
      inclusions: ["Estate"],
      exclusions: [],
      lines: [{ label: "Revised", amountPaise: 9000000, inclusion: true }],
      depositPaise: 4500000,
      expiresAt: "2027-01-02T00:00:00.000Z",
      actor: { id: "admin-owner", role: "owner" },
    });
    expect(q1.version).toBe(1);
    expect(q2.version).toBe(2);
    expect(q1.accessToken).not.toBe(q2.accessToken);
    expect(getStore().quotes.find((q) => q.id === q1.id)?.status).toBe("withdrawn");
  });

  it("accepts quote with fresh hold and declines on conflict", async () => {
    const enquiry = await createEventEnquiry({
      ...baseEnquiry,
      startDate: "2026-11-07",
      endDate: "2026-11-07",
    });
    const stay = await createStayHold({
      checkIn: "2026-11-06",
      checkOut: "2026-11-07",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await confirmStayFromVerifiedPayment({
      stayId: stay.stay.id,
      payment: paymentFromCapture({
        purpose: "stay",
        sourceId: stay.stay.id,
        holdId: stay.hold.id,
        amountPaise: stay.stay.priceSnapshot.amountDueNowPaise,
        orderId: "o1",
        paymentId: "p1",
      }),
    });
    const quote = await createAndSendQuote({
      enquiryId: enquiry.id,
      overnightRoomsIncluded: false,
      inclusions: [],
      exclusions: [],
      lines: [{ label: "Event", amountPaise: 5000000, inclusion: true }],
      depositPaise: 2500000,
      expiresAt: "2027-01-01T00:00:00.000Z",
      actor: { id: "admin-owner", role: "owner" },
    });
    await expect(acceptQuoteAndHold(quote.accessToken)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("allows organizer decline without holding inventory", async () => {
    const enquiry = await createEventEnquiry(baseEnquiry);
    const quote = await createAndSendQuote({
      enquiryId: enquiry.id,
      overnightRoomsIncluded: false,
      inclusions: [],
      exclusions: [],
      lines: [{ label: "Event", amountPaise: 5000000, inclusion: true }],
      depositPaise: 2500000,
      expiresAt: "2027-01-01T00:00:00.000Z",
      actor: { id: "admin-owner", role: "owner" },
    });
    await declineQuoteByOrganizer(quote.accessToken);
    const open = publicAvailability("2026-12-10", "2026-12-10");
    expect(open.dates[0]?.available).toBe(true);
  });

  it("prevents two concurrent event accepts for same night", async () => {
    const e1 = await createEventEnquiry({ ...baseEnquiry, organizer: { ...guest, email: "a@example.com" } });
    const e2 = await createEventEnquiry({ ...baseEnquiry, organizer: { ...guest, email: "b@example.com" } });
    const q1 = await createAndSendQuote({
      enquiryId: e1.id,
      overnightRoomsIncluded: false,
      inclusions: [],
      exclusions: [],
      lines: [{ label: "A", amountPaise: 100, inclusion: true }],
      depositPaise: 50,
      expiresAt: "2027-01-01T00:00:00.000Z",
      actor: { id: "admin-owner", role: "owner" },
    });
    const q2 = await createAndSendQuote({
      enquiryId: e2.id,
      overnightRoomsIncluded: false,
      inclusions: [],
      exclusions: [],
      lines: [{ label: "B", amountPaise: 100, inclusion: true }],
      depositPaise: 50,
      expiresAt: "2027-01-01T00:00:00.000Z",
      actor: { id: "admin-owner", role: "owner" },
    });
    await acceptQuoteAndHold(q1.accessToken);
    await expect(acceptQuoteAndHold(q2.accessToken)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
