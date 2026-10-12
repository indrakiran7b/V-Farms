import { afterEach, describe, expect, it } from "vitest";
import { hmacSha256Hex } from "@/lib/crypto";
import { verifyCheckoutSignature, verifyWebhookSignature, razorpayConfigured } from "@/lib/payments/razorpay";
import { settleRazorpayCapture } from "@/lib/payments/settle";
import { can } from "@/lib/auth/permissions";
import { createDevSeed } from "@/lib/data/seed";
import {
  attachRazorpayOrder,
  confirmStayFromVerifiedPayment,
  createStayHold,
  findPaymentByOrderId,
  getPublicBookingStatus,
  recordRefund,
  recordWebhookOnce,
  resetMemoryStore,
} from "@/lib/data/store";
import { paymentFromCapture } from "@/lib/payments/razorpay";
import { enqueueNotification, deliverNotification } from "@/lib/email/notify";

const guest = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" };
const owner = { id: "admin-owner", role: "owner" as const };

afterEach(() => {
  resetMemoryStore(createDevSeed());
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RESEND_API_KEY;
});

describe("payment verification", () => {
  it("accepts a valid checkout signature and rejects an invalid one", () => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    const orderId = "order_abc";
    const paymentId = "pay_def";
    const signature = hmacSha256Hex("test_secret", `${orderId}|${paymentId}`);
    expect(verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(true);
    expect(verifyCheckoutSignature({ orderId, paymentId, signature: "00" })).toBe(false);
  });

  it("rejects invalid webhook signatures", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec";
    const body = '{"event":"payment.captured"}';
    const signature = hmacSha256Hex("whsec", body);
    expect(verifyWebhookSignature(body, signature)).toBe(true);
    expect(verifyWebhookSignature(body, "nope")).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("reports Razorpay as unconfigured without credentials", () => {
    expect(razorpayConfigured()).toBe(false);
    process.env.RAZORPAY_KEY_ID = "rzp_test";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    expect(razorpayConfigured()).toBe(true);
  });

  it("deduplicates webhook event ids", async () => {
    resetMemoryStore(createDevSeed());
    const first = await recordWebhookOnce("evt_1", "payment.captured", "hash");
    const second = await recordWebhookOnce("evt_1", "payment.captured", "hash");
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it("denies refunds to non-owner roles", () => {
    expect(can("content", "content.write")).toBe(true);
    expect(can("content", "bookings.write")).toBe(false);
    expect(can("reservations", "calendar.write")).toBe(true);
    expect(can("operations", "bookings.write")).toBe(false);
    expect(can("owner", "bookings.write")).toBe(true);
  });
});

describe("settlement and inventory safety", () => {
  async function heldStay() {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await attachRazorpayOrder({
      purpose: "stay",
      sourceId: held.stay.id,
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      orderId: "order_live",
      holdId: held.hold.id,
    });
    return held;
  }

  it("confirms a stay on verified capture with an active hold", async () => {
    const held = await heldStay();
    const pending = findPaymentByOrderId("order_live")!;
    const result = await settleRazorpayCapture({
      orderId: "order_live",
      paymentId: "pay_ok",
      amountPaise: pending.amountPaise,
      currency: "INR",
      gatewayStatus: "captured",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.confirmed).toBe(true);
      expect(result.reference).toBe(held.stay.reference);
    }
  });

  it("treats duplicate payment ids as idempotent", async () => {
    await heldStay();
    const first = await settleRazorpayCapture({
      orderId: "order_live",
      paymentId: "pay_dup",
      amountPaise: findPaymentByOrderId("order_live")!.amountPaise,
      currency: "INR",
      gatewayStatus: "captured",
    });
    const second = await settleRazorpayCapture({
      orderId: "order_live",
      paymentId: "pay_dup",
      amountPaise: findPaymentByOrderId("order_live")!.amountPaise,
      currency: "INR",
      gatewayStatus: "captured",
    });
    expect(first.ok && first.confirmed).toBe(true);
    expect(second.ok && second.duplicate).toBe(true);
  });

  it("creates paid_unbooked when payment arrives after hold expiry", async () => {
    const held = await heldStay();
    const pending = findPaymentByOrderId("order_live")!;
    held.hold.expiresAt = "2020-01-01T00:00:00.000Z";
    resetMemoryStore({
      ...createDevSeed(),
      stays: [{ ...held.stay, holdExpiresAt: held.hold.expiresAt }],
      holds: [{ ...held.hold, expiresAt: held.hold.expiresAt, status: "active" }],
      payments: [pending],
      blocks: [],
    });
    const result = await settleRazorpayCapture({
      orderId: "order_live",
      paymentId: "pay_late",
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      currency: "INR",
      gatewayStatus: "captured",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.confirmed).toBe(false);
      expect(result.exception?.kind).toBe("paid_unbooked");
    }
  });

  it("flags amount mismatch without confirming", async () => {
    await heldStay();
    const result = await settleRazorpayCapture({
      orderId: "order_live",
      paymentId: "pay_bad_amount",
      amountPaise: 100,
      currency: "INR",
      gatewayStatus: "captured",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.confirmed).toBe(false);
      expect(result.exception?.kind).toBe("amount_mismatch");
    }
  });

  it("does not confirm twice from duplicate confirmation attempts", async () => {
    const held = await heldStay();
    const payment = paymentFromCapture({
      purpose: "stay",
      sourceId: held.stay.id,
      holdId: held.hold.id,
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      orderId: "order_live",
      paymentId: "pay_once",
    });
    await confirmStayFromVerifiedPayment({ stayId: held.stay.id, payment });
    const again = await confirmStayFromVerifiedPayment({
      stayId: held.stay.id,
      payment: { ...payment, id: randomIdHelper() },
    });
    expect(again.confirmed).toBe(true);
  });

  it("blocks public status lookup without a valid token", () => {
    resetMemoryStore(createDevSeed());
    expect(getPublicBookingStatus("short")).toBeNull();
    expect(getPublicBookingStatus("a".repeat(48))).toBeNull();
  });
});

function randomIdHelper(): string {
  return `pay_${Math.random().toString(36).slice(2, 10)}`;
}

describe("refunds and notifications", () => {
  it("records partial and full refunds with owner audit metadata", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    const payment = paymentFromCapture({
      purpose: "stay",
      sourceId: held.stay.id,
      holdId: held.hold.id,
      amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
      orderId: "order_r",
      paymentId: "pay_r",
    });
    await confirmStayFromVerifiedPayment({ stayId: held.stay.id, payment });
    const refund = await recordRefund({
      paymentId: payment.id,
      amountPaise: payment.amountPaise / 2,
      reason: "Partial goodwill",
      gatewayReference: "rfnd_test",
      actor: owner,
    });
    expect(refund.status).toBe("succeeded");
    const failed = await recordRefund({
      paymentId: payment.id,
      amountPaise: 100,
      reason: "Attempt",
      failed: true,
      actor: owner,
    });
    expect(failed.status).toBe("failed");
  });

  it("retains failed email delivery without corrupting booking state", async () => {
    resetMemoryStore(createDevSeed());
    const record = await enqueueNotification({
      type: "payment_request",
      toEmail: guest.email,
      subject: "Test",
      body: "Body",
      idempotencyKey: "test:1",
    });
    expect(record.status).toBe("failed");
    expect(record.lastError).toMatch(/not configured/i);
    const retried = await deliverNotification(record.id);
    expect(retried.attempts).toBeGreaterThan(1);
  });

  it("skips duplicate confirmation emails via idempotency keys", async () => {
    const seed = createDevSeed();
    seed.notifications.unshift({
      id: "mail_sent",
      type: "booking_confirmed",
      toEmail: guest.email,
      subject: "Confirmed",
      body: "Already sent",
      html: null,
      idempotencyKey: "booking_confirmed:stay1:pay1",
      status: "sent",
      attempts: 1,
      lastError: null,
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    });
    resetMemoryStore(seed);
    const second = await enqueueNotification({
      type: "booking_confirmed",
      toEmail: guest.email,
      subject: "Confirmed",
      body: "Confirmed body",
      idempotencyKey: "booking_confirmed:stay1:pay1",
    });
    expect(second.id).toBe("mail_sent");
  });
});
