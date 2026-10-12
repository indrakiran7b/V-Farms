import { createHash } from "crypto";
import { findPaymentByOrderId, recordWebhookOnce } from "@/lib/data/store";
import { json } from "@/lib/http";
import { notifyAfterSettle } from "@/lib/payments/notify-settle";
import { settleRazorpayCapture } from "@/lib/payments/settle";
import { verifyWebhookSignature, type RazorpayWebhookBody } from "@/lib/payments/razorpay";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return json({ error: "Invalid webhook signature" }, 400);
  }
  const body = JSON.parse(raw) as RazorpayWebhookBody;
  const eventId = request.headers.get("x-razorpay-event-id") || createHash("sha256").update(raw).digest("hex");
  const recorded = await recordWebhookOnce(eventId, body.event ?? "unknown", createHash("sha256").update(raw).digest("hex"));
  if (recorded.duplicate) {
    return json({ ok: true, duplicate: true });
  }
  const entity = body.payload?.payment?.entity;
  if (!entity?.order_id) {
    return json({ ok: true, ignored: true });
  }
  const pending = findPaymentByOrderId(entity.order_id);
  if (!pending) {
    return json({ ok: true, unmatched: true });
  }
  const gatewayStatus =
    entity.status === "captured" ? "captured" : entity.status === "failed" ? "failed" : "authorized";
  const settled = await settleRazorpayCapture({
    orderId: entity.order_id,
    paymentId: entity.id ?? `unknown_${eventId}`,
    amountPaise: entity.amount ?? pending.amountPaise,
    currency: "INR",
    gatewayStatus,
  });
  if (settled.ok && settled.confirmed) {
    await notifyAfterSettle(settled);
  }
  return json({ ok: true, settled: settled.ok ? settled.confirmed : false });
}
