import { confirmEventInStore, confirmStayInStore } from "@/lib/data/payment-ledger";
import { findPaymentByOrderId, withInventory } from "@/lib/data/store";
import type { PaymentException, PaymentRecord } from "@/lib/types";

export type SettleResult =
  | {
      ok: true;
      duplicate: boolean;
      confirmed: boolean;
      purpose: "stay" | "event";
      reference: string;
      customerAccessToken: string;
      exception: PaymentException | null;
      payment: PaymentRecord;
    }
  | { ok: false; reason: "unknown_order" | "ignored" };

export async function settleRazorpayCapture(input: {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
  gatewayStatus: "captured" | "failed" | "authorized";
}): Promise<SettleResult> {
  const pending = findPaymentByOrderId(input.orderId);
  if (!pending) return { ok: false, reason: "unknown_order" };

  if (input.gatewayStatus === "failed") {
    await withInventory((store) => {
      const record = store.payments.find((item) => item.id === pending.id);
      if (!record || record.status === "captured" || record.status === "refunded") return;
      record.status = "failed";
    });
    return { ok: false, reason: "ignored" };
  }

  if (input.gatewayStatus === "authorized") {
    await withInventory((store) => {
      const record = store.payments.find((item) => item.id === pending.id);
      if (!record || record.status === "captured") return;
      record.status = "authorized";
      record.razorpayPaymentId = input.paymentId;
    });
    return { ok: false, reason: "ignored" };
  }

  if (input.currency !== "INR") {
    return { ok: false, reason: "ignored" };
  }

  return withInventory((store) => {
    const duplicateCapture = store.payments.find(
      (item) => item.razorpayPaymentId === input.paymentId && item.status === "captured",
    );
    const at = new Date().toISOString();

    if (duplicateCapture) {
      const sameOrder =
        duplicateCapture.id === pending.id || duplicateCapture.razorpayOrderId === input.orderId;
      if (sameOrder) {
        const payment = duplicateCapture;
        const outcome =
          payment.purpose === "stay"
            ? confirmStayInStore(store, { stayId: payment.sourceId, payment }, at)
            : confirmEventInStore(store, { enquiryId: payment.sourceId, payment }, at);
        const stay = store.stays.find((s) => s.id === payment.sourceId);
        const enquiry = store.enquiries.find((e) => e.id === payment.sourceId);
        return {
          ok: true as const,
          duplicate: true,
          confirmed: outcome.confirmed,
          purpose: payment.purpose,
          reference: stay?.reference ?? enquiry?.reference ?? payment.sourceId,
          customerAccessToken: stay?.customerAccessToken ?? enquiry?.customerAccessToken ?? "",
          exception: outcome.exception,
          payment,
        };
      }

      const stayRef = store.stays.find((s) => s.id === pending.sourceId);
      const enquiryRef = store.enquiries.find((e) => e.id === pending.sourceId);
      return {
        ok: true as const,
        duplicate: true,
        confirmed: stayRef?.status === "confirmed" || enquiryRef?.status === "confirmed",
        purpose: pending.purpose,
        reference: stayRef?.reference ?? enquiryRef?.reference ?? pending.sourceId,
        customerAccessToken: stayRef?.customerAccessToken ?? enquiryRef?.customerAccessToken ?? "",
        exception: null,
        payment: duplicateCapture,
      };
    }

    const record = store.payments.find((item) => item.id === pending.id);
    if (!record) {
      return { ok: false as const, reason: "unknown_order" as const };
    }

    const amountPaise = input.amountPaise > 0 ? input.amountPaise : record.amountPaise;
    const payment: PaymentRecord = {
      ...record,
      status: "captured",
      razorpayPaymentId: input.paymentId,
      amountPaise,
      currency: "INR",
      capturedAt: new Date().toISOString(),
    };

    const outcome =
      payment.purpose === "stay"
        ? confirmStayInStore(store, { stayId: payment.sourceId, payment }, at)
        : confirmEventInStore(store, { enquiryId: payment.sourceId, payment }, at);

    const stay = store.stays.find((s) => s.id === payment.sourceId);
    const enquiry = store.enquiries.find((e) => e.id === payment.sourceId);

    return {
      ok: true as const,
      duplicate: false,
      confirmed: outcome.confirmed,
      purpose: payment.purpose,
      reference: stay?.reference ?? enquiry?.reference ?? payment.sourceId,
      customerAccessToken: stay?.customerAccessToken ?? enquiry?.customerAccessToken ?? "",
      exception: outcome.exception,
      payment,
    };
  });
}
