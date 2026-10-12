import crypto from "crypto";
import Razorpay from "razorpay";
import { randomId, safeEqualHex } from "@/lib/crypto";
import type { PaymentRecord } from "@/lib/types";

export function razorpayConfigured(): boolean {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return Boolean(keyId && keySecret);
}

export function getRazorpay() {
  if (!razorpayConfigured()) {
    throw new Error("Razorpay credentials are not configured.");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${input.orderId}|${input.paymentId}`).digest("hex");
  return safeEqualHex(expected, input.signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export function paymentFromCapture(input: {
  purpose: "stay" | "event";
  sourceId: string;
  holdId: string | null;
  amountPaise: number;
  orderId: string | null;
  paymentId: string | null;
  method?: PaymentRecord["method"];
}): PaymentRecord {
  const at = new Date().toISOString();
  return {
    id: randomId("pay"),
    purpose: input.purpose,
    sourceId: input.sourceId,
    holdId: input.holdId,
    status: "captured",
    amountPaise: input.amountPaise,
    currency: "INR",
    method: input.method ?? "razorpay",
    razorpayOrderId: input.orderId,
    razorpayPaymentId: input.paymentId,
    offlineReference: null,
    recordedByActorId: null,
    receivedAt: at,
    internalNotes: null,
    capturedAt: at,
    createdAt: at,
  };
}

export type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        status?: string;
        notes?: Record<string, string>;
      };
    };
    order?: {
      entity?: {
        id?: string;
        notes?: Record<string, string>;
      };
    };
  };
};
