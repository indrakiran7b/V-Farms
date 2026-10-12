import { afterEach, describe, expect, it } from "vitest";
import { getPaymentSetupStatus, unconfiguredCheckoutMessage } from "@/lib/payments/config";
import { createDevSeed } from "@/lib/data/seed";
import { createStayHold, recordOfflinePayment, resetMemoryStore } from "@/lib/data/store";
import { BookingValidationError } from "@/lib/inventory/validate";

const guest = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" };
const owner = { id: "admin-owner", role: "owner" as const };

afterEach(() => {
  resetMemoryStore(createDevSeed());
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe("payment configuration", () => {
  it("reports a safe public message when Razorpay is missing", () => {
    const status = getPaymentSetupStatus();
    expect(status.onlineCheckoutEnabled).toBe(false);
    expect(status.mode).toBe("unconfigured");
    expect(unconfiguredCheckoutMessage()).not.toMatch(/admin/i);
    expect(unconfiguredCheckoutMessage()).toMatch(/hold/i);
  });
});

describe("offline payment recording", () => {
  it("lets the owner confirm a stay with a full offline payment", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    const result = await recordOfflinePayment({
      purpose: "stay",
      bookingReference: held.stay.reference,
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      method: "offline_upi",
      reference: "UPI-TXN-001",
      receivedAt: "2026-11-01T10:00:00.000Z",
      internalNotes: "Received via owner account",
      actor: owner,
    });
    expect(result.confirmed).toBe(true);
    if ("stay" in result && result.stay) expect(result.stay.status).toBe("confirmed");
  });

  it("records partial payments without confirming", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-14",
      checkOut: "2026-11-16",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    const due = held.stay.priceSnapshot.amountDueNowPaise;
    const result = await recordOfflinePayment({
      purpose: "stay",
      bookingReference: held.stay.reference,
      amountPaise: Math.floor(due / 2),
      method: "offline_bank",
      reference: "NEFT-PARTIAL-1",
      actor: owner,
    });
    expect("partial" in result && result.partial).toBe(true);
    expect(result.confirmed).toBe(false);
    if ("stay" in result && result.stay) expect(result.stay.status).toBe("awaiting_payment");
  });

  it("rejects duplicate transaction references", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-18",
      checkOut: "2026-11-20",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    const due = held.stay.priceSnapshot.amountDueNowPaise;
    await recordOfflinePayment({
      purpose: "stay",
      bookingReference: held.stay.reference,
      amountPaise: due,
      method: "offline_cash",
      reference: "CASH-999",
      actor: owner,
    });
    const held2 = await createStayHold({
      checkIn: "2026-11-22",
      checkOut: "2026-11-24",
      party: { adults: 2, children: 0 },
      guest: { ...guest, email: "other@example.com" },
      policyAccepted: true,
    });
    await expect(
      recordOfflinePayment({
        purpose: "stay",
        bookingReference: held2.stay.reference,
        amountPaise: held2.stay.priceSnapshot.amountDueNowPaise,
        method: "offline_cash",
        reference: "CASH-999",
        actor: owner,
      }),
    ).rejects.toBeInstanceOf(BookingValidationError);
  });
});

describe("online order safety", () => {
  it("keeps checkout disabled without exposing secrets when credentials are absent", () => {
    expect(getPaymentSetupStatus().onlineCheckoutEnabled).toBe(false);
    expect(getPaymentSetupStatus().setup.keySecret).toBe(false);
  });
});
