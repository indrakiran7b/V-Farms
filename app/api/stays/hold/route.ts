import { z } from "zod";
import { createStayHold } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";
import { enqueueNotification } from "@/lib/email/notify";
import { stayPaymentRequestEmail } from "@/lib/email/templates";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { formatDisplayDate } from "@/lib/time/kolkata";

const schema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  adults: z.number().int(),
  children: z.number().int(),
  addOnIds: z.array(z.string()).optional(),
  guest: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(8),
  }),
  policyAccepted: z.boolean(),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "hold"), 10, 60_000).ok) return json({ error: "Too many requests" }, 429);
  try {
    const body = schema.parse(await request.json());
    const result = await createStayHold({
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      party: { adults: body.adults, children: body.children },
      guest: body.guest,
      addOnIds: body.addOnIds,
      policyAccepted: body.policyAccepted,
    });
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const statusUrl = `${site}/booking/confirmation?token=${encodeURIComponent(result.stay.customerAccessToken)}`;
    const mail = stayPaymentRequestEmail({
      reference: result.stay.reference,
      dates: `${formatDisplayDate(result.stay.checkIn)} → ${formatDisplayDate(result.stay.checkOut)}`,
      amountDuePaise: result.stay.priceSnapshot.amountDueNowPaise,
      holdExpiresAt: result.hold.expiresAt,
    });
    await enqueueNotification({
      type: "payment_request",
      toEmail: result.stay.guest.email,
      subject: mail.subject,
      body: `${mail.text}\n\nView status: ${statusUrl}`,
      html: `${mail.html}<p style="margin-top:16px;font-size:14px;"><a href="${statusUrl}">View reservation status</a></p>`,
      idempotencyKey: `payment_request:${result.stay.id}`,
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
