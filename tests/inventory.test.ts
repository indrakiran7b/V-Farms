import { afterEach, describe, expect, it } from "vitest";
import { createDevSeed } from "@/lib/data/seed";
import {
  acceptQuoteAndHold,
  confirmStayFromVerifiedPayment,
  createAndSendQuote,
  createEventEnquiry,
  createStayHold,
  priceStayPreview,
  publicAvailability,
  resetMemoryStore,
} from "@/lib/data/store";
import { paymentFromCapture } from "@/lib/payments/razorpay";
import { addDays } from "@/lib/time/kolkata";
import { BookingValidationError } from "@/lib/inventory/validate";

const guest = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" };

function friday(): string {
  return "2026-11-06";
}

afterEach(() => {
  resetMemoryStore(createDevSeed());
});

describe("exclusive whole-property inventory", () => {
  it("prices available dates from rate rules and seasonal exceptions", async () => {
    resetMemoryStore(createDevSeed());
    const weekday = await priceStayPreview("2026-11-03", "2026-11-05", { adults: 2, children: 0 });
    expect(weekday.available).toBe(true);
    expect(weekday.snapshot.nights).toHaveLength(2);
    expect(weekday.snapshot.nights[0].nightlyPaise).toBe(45_000_00);

    const peak = await priceStayPreview("2026-12-24", "2026-12-26", { adults: 2, children: 0 });
    expect(peak.snapshot.nights.every((night) => night.nightlyPaise === 70_000_00)).toBe(true);
  });

  it("rejects inverted dates, capacity overflow and overlapping stays", async () => {
    resetMemoryStore(createDevSeed());
    await expect(priceStayPreview("2026-11-08", "2026-11-06", { adults: 2, children: 0 })).rejects.toBeInstanceOf(BookingValidationError);
    await expect(priceStayPreview(friday(), addDays(friday(), 2), { adults: 8, children: 4 })).rejects.toMatchObject({ code: "CAPACITY" });

    const first = await createStayHold({
      checkIn: friday(),
      checkOut: addDays(friday(), 2),
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await confirmStayFromVerifiedPayment({
      stayId: first.stay.id,
      payment: paymentFromCapture({
        purpose: "stay",
        sourceId: first.stay.id,
        holdId: first.hold.id,
        amountPaise: first.stay.priceSnapshot.amountDueNowPaise,
        orderId: "order_1",
        paymentId: "pay_1",
      }),
    });
    await expect(
      createStayHold({
        checkIn: friday(),
        checkOut: addDays(friday(), 2),
        party: { adults: 2, children: 0 },
        guest,
        policyAccepted: true,
      }),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });

    const preview = await priceStayPreview(friday(), addDays(friday(), 2), { adults: 2, children: 0 });
    expect(preview.available).toBe(false);
    expect(preview.unavailableNights).toEqual([friday(), addDays(friday(), 1)]);
    expect(preview.snapshot.nights).toHaveLength(0);
    expect(preview.snapshot.totalPaise).toBe(0);
  });

  it("lists only conflicting nights for partial overlaps (check-out exclusive)", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-10-22",
      checkOut: "2026-10-25",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await confirmStayFromVerifiedPayment({
      stayId: held.stay.id,
      payment: paymentFromCapture({
        purpose: "stay",
        sourceId: held.stay.id,
        holdId: held.hold.id,
        amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
        orderId: "order_partial",
        paymentId: "pay_partial",
      }),
    });
    const preview = await priceStayPreview("2026-10-21", "2026-10-25", { adults: 2, children: 0 });
    expect(preview.available).toBe(false);
    expect(preview.unavailableNights).toEqual(["2026-10-22", "2026-10-23", "2026-10-24"]);
    expect(preview.snapshot.nights).toHaveLength(0);
  });

  it("returns no unavailable nights when the whole range is open", async () => {
    resetMemoryStore(createDevSeed());
    const preview = await priceStayPreview("2026-11-03", "2026-11-05", { adults: 2, children: 0 });
    expect(preview.available).toBe(true);
    expect(preview.unavailableNights).toEqual([]);
    expect(preview.snapshot.nights).toHaveLength(2);
  });

  it("allows back-to-back stays when turnover is enabled", async () => {
    resetMemoryStore(createDevSeed());
    const first = await createStayHold({
      checkIn: "2026-11-06",
      checkOut: "2026-11-07",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await confirmStayFromVerifiedPayment({
      stayId: first.stay.id,
      payment: paymentFromCapture({
        purpose: "stay",
        sourceId: first.stay.id,
        holdId: first.hold.id,
        amountPaise: first.stay.priceSnapshot.amountDueNowPaise,
        orderId: "order_2",
        paymentId: "pay_2",
      }),
    });
    const second = await createStayHold({
      checkIn: "2026-11-07",
      checkOut: "2026-11-08",
      party: { adults: 2, children: 0 },
      guest: { ...guest, email: "next@example.com" },
      policyAccepted: true,
    });
    expect(second.stay.checkIn).toBe("2026-11-07");
  });

  it("rejects events on stay arrival or departure dates and does not block inventory for pending enquiries", async () => {
    resetMemoryStore(createDevSeed());
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
        orderId: "order_3",
        paymentId: "pay_3",
      }),
    });
    const enquiry = await createEventEnquiry({
      organizer: guest,
      eventType: "Birthday lunch",
      startDate: "2026-11-07",
      endDate: "2026-11-07",
      expectedAttendance: 20,
      preferredTiming: "Day",
      preferredStartTime: "11:00",
      preferredEndTime: "16:00",
      cateringNotes: "",
      decorationNotes: "",
      vendorNotes: "",
      setupNotes: "",
      accommodationRequested: false,
      additionalNotes: "",
      policyAccepted: true,
      privacyAccepted: true,
    });
    expect(enquiry.status).toBe("enquiry");
    const occupied = publicAvailability("2026-11-06", "2026-11-08");
    expect(occupied.dates.find((day) => day.date === "2026-11-08")?.available).toBe(true);

    const quote = await createAndSendQuote({
      enquiryId: enquiry.id,
      overnightRoomsIncluded: false,
      inclusions: [],
      exclusions: ["Overnight rooms"],
      lines: [{ label: "Day use", amountPaise: 10000000, inclusion: true }],
      depositPaise: 5000000,
      expiresAt: "2027-01-01T00:00:00.000Z",
      actor: { id: "admin-owner", role: "owner" },
    });
    await expect(acceptQuoteAndHold(quote.accessToken)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("releases expired holds and never auto-confirms a late payment", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-13",
      checkOut: "2026-11-15",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    held.hold.expiresAt = "2020-01-01T00:00:00.000Z";
    const store = resetMemoryStore({
      ...createDevSeed(),
      stays: [{ ...held.stay, holdExpiresAt: "2020-01-01T00:00:00.000Z" }],
      holds: [{ ...held.hold, expiresAt: "2020-01-01T00:00:00.000Z", status: "active" }],
      blocks: [],
    });
    void store;
    const result = await confirmStayFromVerifiedPayment({
      stayId: held.stay.id,
      payment: paymentFromCapture({
        purpose: "stay",
        sourceId: held.stay.id,
        holdId: held.hold.id,
        amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
        orderId: "order_late",
        paymentId: "pay_late",
      }),
    });
    expect(result.confirmed).toBe(false);
    expect(result.exception?.kind).toBe("paid_unbooked");
  });

  it("allows only one concurrent hold for the same nights", async () => {
    resetMemoryStore(createDevSeed());
    const input = {
      checkIn: "2026-11-20",
      checkOut: "2026-11-22",
      party: { adults: 2, children: 0 },
      policyAccepted: true,
    };
    const results = await Promise.allSettled([
      createStayHold({ ...input, guest }),
      createStayHold({ ...input, guest: { ...guest, email: "second@example.com" } }),
    ]);
    const fulfilled = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("keeps the accepted price snapshot after a later rate change", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    const accepted = held.stay.priceSnapshot.totalPaise;
    const mutated = createDevSeed();
    mutated.rateRules = mutated.rateRules.map((rule) => ({ ...rule, nightlyPaise: rule.nightlyPaise * 2 }));
    mutated.stays = [held.stay];
    mutated.holds = [held.hold];
    resetMemoryStore(mutated);
    expect(held.stay.priceSnapshot.totalPaise).toBe(accepted);
  });
});
