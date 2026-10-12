import { enqueueNotification } from "@/lib/email/notify";
import { eventConfirmedEmail, stayConfirmedEmail } from "@/lib/email/templates";
import { getStore } from "@/lib/data/store";
import { formatDisplayDate } from "@/lib/time/kolkata";
import type { SettleResult } from "@/lib/payments/settle";

export async function notifyAfterSettle(result: Extract<SettleResult, { ok: true }>): Promise<void> {
  if (!result.confirmed) return;
  const store = getStore();
  if (result.purpose === "stay") {
    const stay = store.stays.find((s) => s.reference === result.reference);
    if (!stay) return;
    const mail = stayConfirmedEmail({
      reference: stay.reference,
      dates: `${formatDisplayDate(stay.checkIn)} → ${formatDisplayDate(stay.checkOut)}`,
      paidPaise: result.payment.amountPaise,
      balancePaise: stay.priceSnapshot.balanceDuePaise,
      policySummary: stay.policySnapshot.cancellationSummary,
    });
    await enqueueNotification({
      type: "booking_confirmed",
      toEmail: stay.guest.email,
      subject: mail.subject,
      body: mail.text,
      html: mail.html,
      idempotencyKey: `booking_confirmed:${stay.id}:${result.payment.razorpayPaymentId}`,
    });
    return;
  }
  const enquiry = store.enquiries.find((e) => e.reference === result.reference);
  if (!enquiry) return;
  const mail = eventConfirmedEmail({
    reference: enquiry.reference,
    dates: `${formatDisplayDate(enquiry.startDate)} → ${formatDisplayDate(enquiry.endDate)}`,
    depositPaise: result.payment.amountPaise,
  });
  await enqueueNotification({
    type: "event_confirmed",
    toEmail: enquiry.organizer.email,
    subject: mail.subject,
    body: mail.text,
    html: mail.html,
    idempotencyKey: `event_confirmed:${enquiry.id}:${result.payment.razorpayPaymentId}`,
  });
}
