import { afterEach, describe, expect, it } from "vitest";
import { getPaymentSetupStatus } from "@/lib/payments/config";
import { settleRazorpayCapture } from "@/lib/payments/settle";
import { createDevSeed } from "@/lib/data/seed";
import {
  attachRazorpayOrder,
  confirmStayFromVerifiedPayment,
  createStayHold,
  getStore,
  recordOfflinePayment,
  resetMemoryStore,
} from "@/lib/data/store";
import { paymentFromCapture } from "@/lib/payments/razorpay";
import { isPrivilegedFinance } from "@/lib/auth/permissions";

const guest = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" };
const owner = { id: "admin-owner", role: "owner" as const };
afterEach(() => {
  resetMemoryStore(createDevSeed());
});

describe("configuration hardening", () => {
  it("requires both secret and public key before enabling checkout", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    expect(getPaymentSetupStatus().onlineCheckoutEnabled).toBe(false);

    process.env.RAZORPAY_KEY_SECRET = "secret";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_abc";
    const status = getPaymentSetupStatus();
    expect(status.onlineCheckoutEnabled).toBe(true);
    expect(status.setup.keysMatch).toBe(true);
    expect(getPaymentSetupStatus().mode).toBe("test");
  });
});

describe("offline payment atomicity and inventory", () => {
  it("records payment but rejects confirmation when hold expired", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    const due = held.stay.priceSnapshot.amountDueNowPaise;
    held.hold.expiresAt = "2020-01-01T00:00:00.000Z";
    resetMemoryStore({
      ...createDevSeed(),
      stays: [{ ...held.stay, holdExpiresAt: held.hold.expiresAt, status: "awaiting_payment" }],
      holds: [{ ...held.hold, expiresAt: held.hold.expiresAt }],
      blocks: [],
      payments: [],
    });
    const result = await recordOfflinePayment({
      purpose: "stay",
      bookingReference: held.stay.reference,
      amountPaise: due,
      method: "offline_bank",
      reference: "NEFT-EXPIRED-1",
      actor: owner,
    });
    expect(result.confirmed).toBe(false);
    expect(result.exception?.kind).toBe("paid_unbooked");
    const store = getStore();
    expect(store.payments.some((p) => p.offlineReference === "NEFT-EXPIRED-1")).toBe(true);
    expect(store.stays.find((s) => s.id === held.stay.id)?.status).not.toBe("confirmed");
  });

  it("is idempotent for duplicate admin retries with the same receipt", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-14",
      checkOut: "2026-11-16",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    const due = held.stay.priceSnapshot.amountDueNowPaise;
    const payload = {
      purpose: "stay" as const,
      bookingReference: held.stay.reference,
      amountPaise: due,
      method: "offline_upi" as const,
      reference: "UPI-IDEM-1",
      actor: owner,
    };
    const first = await recordOfflinePayment(payload);
    const second = await recordOfflinePayment(payload);
    expect(first.confirmed).toBe(true);
    expect(second.confirmed).toBe(true);
    expect(getStore().payments.filter((p) => p.offlineReference === "UPI-IDEM-1")).toHaveLength(1);
  });

  it("rejects overpayment amounts server-side", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-20",
      checkOut: "2026-11-22",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await expect(
      recordOfflinePayment({
        purpose: "stay",
        bookingReference: held.stay.reference,
        amountPaise: held.stay.priceSnapshot.amountDueNowPaise + 100,
        method: "offline_cash",
        reference: "CASH-OVER",
        actor: owner,
      }),
    ).rejects.toMatchObject({ code: "AMOUNT" });
  });
});

describe("authorization expectations", () => {
  it("limits privileged finance actions to owner role", () => {
    expect(isPrivilegedFinance("owner")).toBe(true);
    expect(isPrivilegedFinance("reservations")).toBe(false);
  });
});

describe("razorpay settlement in one inventory lock", () => {
  it("settles capture and confirmation without losing payment on failure", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-24",
      checkOut: "2026-11-26",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await attachRazorpayOrder({
      purpose: "stay",
      sourceId: held.stay.id,
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      orderId: "order_atomic",
      holdId: held.hold.id,
    });
    const settled = await settleRazorpayCapture({
      orderId: "order_atomic",
      paymentId: "pay_atomic",
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      currency: "INR",
      gatewayStatus: "captured",
    });
    expect(settled.ok).toBe(true);
    if (settled.ok) expect(settled.confirmed).toBe(true);

    const duplicate = await settleRazorpayCapture({
      orderId: "order_atomic",
      paymentId: "pay_atomic",
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      currency: "INR",
      gatewayStatus: "captured",
    });
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok) {
      expect(duplicate.duplicate).toBe(true);
      expect(duplicate.confirmed).toBe(true);
    }
  });

  it("retries stay confirmation when Razorpay payment is already captured", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-12-01",
      checkOut: "2026-12-03",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await attachRazorpayOrder({
      purpose: "stay",
      sourceId: held.stay.id,
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      orderId: "order_retry_confirm",
      holdId: held.hold.id,
    });
    const store = getStore();
    const payment = store.payments.find((p) => p.razorpayOrderId === "order_retry_confirm");
    expect(payment).toBeTruthy();
    if (!payment) return;
    payment.status = "captured";
    payment.razorpayPaymentId = "pay_retry_confirm";
    payment.capturedAt = "2026-10-12T10:00:00.000Z";
    const stay = store.stays.find((s) => s.id === held.stay.id);
    expect(stay?.status).toBe("awaiting_payment");
    resetMemoryStore({ ...store });

    const settled = await settleRazorpayCapture({
      orderId: "order_retry_confirm",
      paymentId: "pay_retry_confirm",
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      currency: "INR",
      gatewayStatus: "captured",
    });
    expect(settled.ok).toBe(true);
    if (settled.ok) {
      expect(settled.duplicate).toBe(true);
      expect(settled.confirmed).toBe(true);
    }
    expect(getStore().stays.find((s) => s.id === held.stay.id)?.status).toBe("confirmed");
  });

  it("keeps payment record when confirmation fails on amount mismatch", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-28",
      checkOut: "2026-11-30",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    const payment = paymentFromCapture({
      purpose: "stay",
      sourceId: held.stay.id,
      holdId: held.hold.id,
      amountPaise: 100,
      orderId: "order_bad",
      paymentId: "pay_bad",
    });
    const result = await confirmStayFromVerifiedPayment({ stayId: held.stay.id, payment });
    expect(result.confirmed).toBe(false);
    expect(getStore().payments.some((p) => p.id === payment.id)).toBe(true);
  });
});
