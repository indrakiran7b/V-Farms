import { z } from "zod";
import { actorFrom, requireAdmin } from "@/lib/auth/guard";
import { isPrivilegedFinance } from "@/lib/auth/session";
import {
  addAdminBlock,
  cancelStayReservation,
  createAndSendQuote,
  removeAdminBlock,
  updateEnquiryReview,
  recordOfflinePayment,
  recordRefund,
  updateContent,
  updateRoom,
  updateSettings,
  upsertRateRule,
} from "@/lib/data/store";
import { deliverNotification, enqueueNotification } from "@/lib/email/notify";
import { errorResponse, json } from "@/lib/http";
import { randomId } from "@/lib/crypto";

const schema = z.object({
  action: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const { action, payload } = body;
    if (action === "quote.send") {
      const session = await requireAdmin("events.write");
      const quote = await createAndSendQuote({
        enquiryId: String(payload.enquiryId),
        overnightRoomsIncluded: Boolean(payload.overnightRoomsIncluded),
        inclusions: Array.isArray(payload.inclusions) ? payload.inclusions.map(String) : [],
        exclusions: Array.isArray(payload.exclusions) ? payload.exclusions.map(String) : [],
        lines: Array.isArray(payload.lines)
          ? (payload.lines as Array<{ label: string; amountPaise: number; inclusion?: boolean }>).map((line) => ({
              label: line.label,
              amountPaise: Number(line.amountPaise),
              inclusion: Boolean(line.inclusion),
            }))
          : [],
        depositPaise: Number(payload.depositPaise),
        securityDepositPaise: Number(payload.securityDepositPaise ?? 0),
        cancellationTerms: payload.cancellationTerms ? String(payload.cancellationTerms) : undefined,
        expiresAt: String(payload.expiresAt),
        actor: actorFrom(session),
      });
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const { getStore } = await import("@/lib/data/store");
      const enquiry = getStore().enquiries.find((e) => e.id === quote.enquiryId);
      if (enquiry) {
        await enqueueNotification({
          type: "quotation",
          toEmail: enquiry.organizer.email,
          subject: `V-Farms quotation ${enquiry.reference} (v${quote.version})`,
          body: `Your event quotation for ${enquiry.eventType} is ready.\n\nView and respond securely:\n${site}/events/quote/${quote.accessToken}\n\nThis link is private. Accepting rechecks availability and places a short hold before deposit payment.`,
        });
      }
      return json({ quote });
    }
    if (action === "enquiry.review") {
      const session = await requireAdmin("events.write");
      const enquiry = await updateEnquiryReview({
        enquiryId: String(payload.enquiryId),
        status: payload.status === "declined" ? "declined" : "review",
        internalNotes: payload.internalNotes ? String(payload.internalNotes) : undefined,
        declineReason: payload.declineReason ? String(payload.declineReason) : undefined,
        actor: actorFrom(session),
      });
      return json({ enquiry });
    }
    if (action === "calendar.block") {
      const session = await requireAdmin("calendar.write");
      const block = await addAdminBlock({
        kind: payload.kind === "maintenance" ? "maintenance" : "admin",
        startDate: String(payload.startDate),
        endDate: String(payload.endDate),
        reason: String(payload.reason ?? "Closure"),
        internalNotes: payload.internalNotes ? String(payload.internalNotes) : undefined,
        actor: actorFrom(session),
      });
      return json({ block });
    }
    if (action === "calendar.block.remove") {
      const session = await requireAdmin("calendar.write");
      const block = await removeAdminBlock({
        blockId: String(payload.blockId),
        actor: actorFrom(session),
      });
      return json({ block });
    }
    if (action === "stay.cancel") {
      const session = await requireAdmin("bookings.write");
      const stay = await cancelStayReservation({
        stayId: String(payload.stayId),
        reason: String(payload.reason ?? "Cancelled by staff"),
        actor: actorFrom(session),
      });
      return json({ stay });
    }
    if (action === "payment.offline") {
      const session = await requireAdmin();
      if (!isPrivilegedFinance(session.role)) {
        return json({ error: "Only the owner may record offline payments." }, 403);
      }
      const methodRaw = String(payload.method ?? "offline_other");
      const allowed = ["offline_upi", "offline_bank", "offline_cash", "offline_other"] as const;
      const method = allowed.includes(methodRaw as (typeof allowed)[number])
        ? (methodRaw as (typeof allowed)[number])
        : "offline_other";
      const result = await recordOfflinePayment({
        purpose: payload.purpose === "event" ? "event" : "stay",
        sourceId: payload.sourceId ? String(payload.sourceId) : undefined,
        bookingReference: payload.bookingReference ? String(payload.bookingReference) : undefined,
        amountPaise: Number(payload.amountPaise),
        method,
        reference: String(payload.reference),
        receivedAt: payload.receivedAt ? String(payload.receivedAt) : undefined,
        internalNotes: payload.internalNotes ? String(payload.internalNotes) : undefined,
        actor: actorFrom(session),
      });
      if ("confirmed" in result && result.confirmed && "stay" in result && result.stay) {
        const { stayConfirmedEmail } = await import("@/lib/email/templates");
        const { formatDisplayDate } = await import("@/lib/time/kolkata");
        const mail = stayConfirmedEmail({
          reference: result.stay.reference,
          dates: `${formatDisplayDate(result.stay.checkIn)} → ${formatDisplayDate(result.stay.checkOut)}`,
          paidPaise: result.stay.priceSnapshot.amountDueNowPaise,
          balancePaise: result.stay.priceSnapshot.balanceDuePaise,
          policySummary: result.stay.policySnapshot.cancellationSummary,
        });
        await enqueueNotification({
          type: "booking_confirmed",
          toEmail: result.stay.guest.email,
          subject: mail.subject,
          body: mail.text,
          html: mail.html,
          idempotencyKey: `booking_confirmed:${result.stay.id}:${result.payment?.id ?? "offline"}`,
        });
      }
      return json(result);
    }
    if (action === "payment.refund") {
      const session = await requireAdmin();
      if (!isPrivilegedFinance(session.role)) return json({ error: "Forbidden" }, 403);
      const refund = await recordRefund({
        paymentId: String(payload.paymentId),
        amountPaise: Number(payload.amountPaise),
        reason: String(payload.reason),
        gatewayReference: payload.gatewayReference ? String(payload.gatewayReference) : null,
        failed: Boolean(payload.failed),
        actor: actorFrom(session),
      });
      const { getStore } = await import("@/lib/data/store");
      const payment = getStore().payments.find((p) => p.id === refund.paymentId);
      const stay = payment ? getStore().stays.find((s) => s.id === payment.sourceId) : undefined;
      const enquiry = payment ? getStore().enquiries.find((e) => e.id === payment.sourceId) : undefined;
      const reference = stay?.reference ?? enquiry?.reference;
      const email = stay?.guest.email ?? enquiry?.organizer.email;
      if (reference && email && refund.status !== "failed") {
        const { refundUpdateEmail } = await import("@/lib/email/templates");
        const mail = refundUpdateEmail({
          reference,
          amountPaise: refund.amountPaise,
          status: refund.status,
        });
        await enqueueNotification({
          type: "refund",
          toEmail: email,
          subject: mail.subject,
          body: mail.text,
          html: mail.html,
          idempotencyKey: `refund:${refund.id}`,
        });
      }
      return json({ refund });
    }
    if (action === "settings.update") {
      const session = await requireAdmin();
      if (session.role !== "owner") return json({ error: "Forbidden" }, 403);
      const settings = await updateSettings(payload, actorFrom(session));
      return json({ settings });
    }
    if (action === "room.update") {
      const session = await requireAdmin("content.write");
      const room = await updateRoom(String(payload.id), payload, actorFrom(session));
      return json({ room });
    }
    if (action === "content.update") {
      const session = await requireAdmin("content.write");
      const content = await updateContent(payload, actorFrom(session));
      return json({ content });
    }
    if (action === "rate.upsert") {
      const session = await requireAdmin();
      if (session.role !== "owner" && session.role !== "reservations") return json({ error: "Forbidden" }, 403);
      const rule = await upsertRateRule(
        {
          id: String(payload.id ?? randomId("rate")),
          name: String(payload.name),
          priority: Number(payload.priority ?? 1),
          startDate: payload.startDate ? String(payload.startDate) : null,
          endDate: payload.endDate ? String(payload.endDate) : null,
          weekdays: Array.isArray(payload.weekdays) ? payload.weekdays.map(Number) : null,
          nightlyPaise: Number(payload.nightlyPaise),
          label: String(payload.label ?? payload.name),
          awaitingOwnerApproval: Boolean(payload.awaitingOwnerApproval ?? true),
        },
        actorFrom(session),
      );
      return json({ rule });
    }
    if (action === "notification.retry") {
      const session = await requireAdmin("bookings.write");
      void session;
      const record = await deliverNotification(String(payload.id));
      return json({ record });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
