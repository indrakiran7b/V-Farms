import { z } from "zod";
import { errorResponse, json } from "@/lib/http";
import { notifyAfterSettle } from "@/lib/payments/notify-settle";
import { settleRazorpayCapture } from "@/lib/payments/settle";
import { verifyCheckoutSignature } from "@/lib/payments/razorpay";

const schema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const valid = verifyCheckoutSignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    if (!valid) {
      return json({ error: "Invalid payment signature. Booking was not confirmed.", status: "invalid" }, 400);
    }
    const settled = await settleRazorpayCapture({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      amountPaise: 0,
      currency: "INR",
      gatewayStatus: "captured",
    });
    if (!settled.ok) {
      return json({ error: "Unknown payment order", status: "unknown" }, 404);
    }
    if (settled.confirmed) {
      await notifyAfterSettle(settled);
    }
    return json({
      status: settled.confirmed ? "confirmed" : settled.exception ? "exception" : "pending",
      reference: settled.reference,
      token: settled.customerAccessToken,
      exception: settled.exception,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
