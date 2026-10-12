import { z } from "zod";
import { attachRazorpayOrder, getStore } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";
import { getCheckoutKeyId, getPaymentSetupStatus, unconfiguredCheckoutMessage } from "@/lib/payments/config";
import { getRazorpay } from "@/lib/payments/razorpay";
import { isActiveHold } from "@/lib/inventory/conflicts";

const schema = z.object({
  purpose: z.enum(["stay", "event"]),
  sourceId: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const store = getStore();
    if (body.purpose === "stay") {
      const stay = store.stays.find((item) => item.id === body.sourceId);
      if (!stay) return json({ error: "Stay not found" }, 404);
      const hold = stay.holdId ? store.holds.find((item) => item.id === stay.holdId) : undefined;
      if (!hold || !isActiveHold(hold, new Date().toISOString())) {
        return json({ error: "The inventory hold has expired. Start a new reservation." }, 409);
      }
      const setup = getPaymentSetupStatus();
      if (!setup.onlineCheckoutEnabled) {
        return json(
          {
            mode: "unconfigured",
            error: setup.configurationError ?? unconfiguredCheckoutMessage(),
            setup: process.env.NODE_ENV === "development" ? setup.setup : undefined,
          },
          503,
        );
      }
      const order = await getRazorpay().orders.create({
        amount: stay.priceSnapshot.amountDueNowPaise,
        currency: "INR",
        receipt: stay.reference,
        notes: { purpose: "stay", sourceId: stay.id, holdId: hold.id },
      });
      await attachRazorpayOrder({
        purpose: "stay",
        sourceId: stay.id,
        amountPaise: stay.priceSnapshot.amountDueNowPaise,
        orderId: String(order.id),
        holdId: hold.id,
      });
      return json({
        mode: "razorpay",
        orderId: order.id,
        amount: order.amount,
        keyId: getCheckoutKeyId(),
      });
    }
    const enquiry = store.enquiries.find((item) => item.id === body.sourceId);
    const quote = enquiry?.quoteId ? store.quotes.find((item) => item.id === enquiry.quoteId) : undefined;
    const hold = enquiry?.holdId ? store.holds.find((item) => item.id === enquiry.holdId) : undefined;
    if (!enquiry || !quote || !hold || !isActiveHold(hold, new Date().toISOString())) {
      return json({ error: "Event deposit is not payable without an accepted quote and active hold." }, 409);
    }
    const eventSetup = getPaymentSetupStatus();
    if (!eventSetup.onlineCheckoutEnabled) {
      return json({ mode: "unconfigured", error: eventSetup.configurationError ?? unconfiguredCheckoutMessage() }, 503);
    }
    const order = await getRazorpay().orders.create({
      amount: quote.depositPaise,
      currency: "INR",
      receipt: enquiry.reference,
      notes: { purpose: "event", sourceId: enquiry.id, holdId: hold.id },
    });
    await attachRazorpayOrder({
      purpose: "event",
      sourceId: enquiry.id,
      amountPaise: quote.depositPaise,
      orderId: String(order.id),
      holdId: hold.id,
    });
    return json({
      mode: "razorpay",
      orderId: order.id,
      amount: order.amount,
      keyId: getCheckoutKeyId(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
