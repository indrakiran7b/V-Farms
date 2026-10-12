import { randomId } from "@/lib/crypto";
import type { AppStore, AdminRole, PaymentException, PaymentRecord, StayBooking, EventEnquiry } from "@/lib/types";
import { findConflicts, isActiveHold } from "@/lib/inventory/conflicts";
import { PROPERTY_ID } from "@/lib/types";

export function upsertPayment(store: AppStore, payment: PaymentRecord): void {
  const index = store.payments.findIndex((item) => item.id === payment.id);
  if (index >= 0) store.payments[index] = { ...store.payments[index], ...payment };
  else store.payments.push(payment);
}

function pushAudit(
  store: AppStore,
  actor: { id: string; role: AdminRole | "system" | "guest" },
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  at: string,
): void {
  store.audit.unshift({
    id: randomId("aud"),
    actorId: actor.id,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    before,
    after,
    createdAt: at,
  });
}

function blocksForConfirmation(store: AppStore, holdId: string | null, sourceId: string, sourceType: "stay" | "event") {
  return store.blocks.filter((block) => {
    if (holdId && block.sourceId === holdId) return false;
    if (block.sourceType === sourceType && block.sourceId === sourceId) return false;
    return true;
  });
}

function paidUnbookedException(
  paymentId: string,
  sourceId: string,
  message: string,
  at: string,
): PaymentException {
  return {
    id: randomId("exc"),
    kind: "paid_unbooked",
    paymentId,
    sourceId,
    message,
    resolved: false,
    createdAt: at,
    resolvedAt: null,
  };
}

export function confirmStayInStore(
  store: AppStore,
  input: {
    stayId: string;
    payment: PaymentRecord;
    actor?: { id: string; role: AdminRole | "system" | "guest" };
  },
  at: string,
): { stay: StayBooking; confirmed: boolean; exception: PaymentException | null } {
  const stay = store.stays.find((item) => item.id === input.stayId);
  if (!stay) throw new Error("Stay not found");
  if (stay.status === "confirmed") {
    return { stay, confirmed: true, exception: null };
  }
  if (input.payment.razorpayPaymentId) {
    const foreignCaptured = store.payments.find(
      (item) =>
        item.razorpayPaymentId === input.payment.razorpayPaymentId &&
        item.status === "captured" &&
        item.id !== input.payment.id,
    );
    if (foreignCaptured) {
      return { stay, confirmed: false, exception: null };
    }
  }
  if (input.payment.currency !== "INR") {
    const exception: PaymentException = {
      id: randomId("exc"),
      kind: "reconciliation_mismatch",
      paymentId: input.payment.id,
      sourceId: stay.id,
      message: "Only INR payments are accepted.",
      resolved: false,
      createdAt: at,
      resolvedAt: null,
    };
    store.exceptions.push(exception);
    upsertPayment(store, input.payment);
    return { stay, confirmed: false, exception };
  }

  const hold = stay.holdId ? store.holds.find((item) => item.id === stay.holdId) : undefined;
  if (!hold || !isActiveHold(hold, at)) {
    const exception = paidUnbookedException(
      input.payment.id,
      stay.id,
      "Payment recorded but the inventory hold is no longer valid. Booking was not auto-confirmed.",
      at,
    );
    store.exceptions.push(exception);
    upsertPayment(store, input.payment);
    pushAudit(
      store,
      input.actor ?? { id: "system", role: "system" },
      "payment.paid_unbooked",
      "payment_exception",
      exception.id,
      stay.status,
      exception,
      at,
    );
    return { stay, confirmed: false, exception };
  }

  const conflicts = findConflicts(
    { purpose: "stay", startDate: stay.checkIn, endDate: stay.checkOut },
    blocksForConfirmation(store, hold.id, stay.id, "stay"),
    at,
    store.settings.turnoverSameDayAllowed,
  );
  if (conflicts.length > 0) {
    const exception = paidUnbookedException(
      input.payment.id,
      stay.id,
      `Payment recorded but dates conflict with ${conflicts.map((c) => c.kind).join(", ")} on the calendar.`,
      at,
    );
    store.exceptions.push(exception);
    upsertPayment(store, input.payment);
    pushAudit(
      store,
      input.actor ?? { id: "system", role: "system" },
      "payment.paid_unbooked",
      "payment_exception",
      exception.id,
      stay.status,
      exception,
      at,
    );
    return { stay, confirmed: false, exception };
  }

  if (input.payment.amountPaise !== stay.priceSnapshot.amountDueNowPaise) {
    const exception: PaymentException = {
      id: randomId("exc"),
      kind: "amount_mismatch",
      paymentId: input.payment.id,
      sourceId: stay.id,
      message: "Captured amount does not match the accepted stay snapshot.",
      resolved: false,
      createdAt: at,
      resolvedAt: null,
    };
    store.exceptions.push(exception);
    upsertPayment(store, input.payment);
    return { stay, confirmed: false, exception };
  }

  const beforeStatus = stay.status;
  hold.status = "converted";
  stay.status = "confirmed";
  stay.updatedAt = at;
  if (!stay.paymentIds.includes(input.payment.id)) stay.paymentIds.push(input.payment.id);
  upsertPayment(store, input.payment);
  store.blocks = store.blocks.filter((block) => block.sourceId !== hold.id);
  store.blocks.push({
    id: randomId("blk"),
    propertyId: PROPERTY_ID,
    kind: "stay",
    status: "confirmed",
    startDate: stay.checkIn,
    endDate: stay.checkOut,
    stayHalfOpen: true,
    sourceType: "stay",
    sourceId: stay.id,
    expiresAt: null,
    createdAt: at,
  });
  pushAudit(
    store,
    input.actor ?? { id: "system", role: "system" },
    "stay.confirmed",
    "stay",
    stay.id,
    beforeStatus,
    stay.status,
    at,
  );
  return { stay, confirmed: true, exception: null };
}

export function confirmEventInStore(
  store: AppStore,
  input: {
    enquiryId: string;
    payment: PaymentRecord;
    actor?: { id: string; role: AdminRole | "system" | "guest" };
  },
  at: string,
): { enquiry: EventEnquiry; confirmed: boolean; exception: PaymentException | null } {
  const enquiry = store.enquiries.find((item) => item.id === input.enquiryId);
  if (!enquiry) throw new Error("Enquiry not found");
  if (enquiry.status === "confirmed") {
    return { enquiry, confirmed: true, exception: null };
  }
  const quote = enquiry.quoteId ? store.quotes.find((item) => item.id === enquiry.quoteId) : undefined;
  const hold = enquiry.holdId ? store.holds.find((item) => item.id === enquiry.holdId) : undefined;

  if (input.payment.currency !== "INR") {
    const exception: PaymentException = {
      id: randomId("exc"),
      kind: "reconciliation_mismatch",
      paymentId: input.payment.id,
      sourceId: enquiry.id,
      message: "Only INR payments are accepted.",
      resolved: false,
      createdAt: at,
      resolvedAt: null,
    };
    store.exceptions.push(exception);
    upsertPayment(store, input.payment);
    return { enquiry, confirmed: false, exception };
  }

  if (!hold || !isActiveHold(hold, at) || !quote) {
    const exception = paidUnbookedException(
      input.payment.id,
      enquiry.id,
      "Payment recorded but the event hold is no longer valid. Confirmation was not automatic.",
      at,
    );
    store.exceptions.push(exception);
    upsertPayment(store, input.payment);
    return { enquiry, confirmed: false, exception };
  }

  const conflicts = findConflicts(
    { purpose: "event", startDate: enquiry.startDate, endDate: enquiry.endDate },
    blocksForConfirmation(store, hold.id, enquiry.id, "event"),
    at,
    store.settings.turnoverSameDayAllowed,
  );
  if (conflicts.length > 0) {
    const exception = paidUnbookedException(
      input.payment.id,
      enquiry.id,
      `Deposit recorded but event dates conflict with ${conflicts.map((c) => c.kind).join(", ")}.`,
      at,
    );
    store.exceptions.push(exception);
    upsertPayment(store, input.payment);
    return { enquiry, confirmed: false, exception };
  }

  if (input.payment.amountPaise !== quote.depositPaise) {
    const exception: PaymentException = {
      id: randomId("exc"),
      kind: "amount_mismatch",
      paymentId: input.payment.id,
      sourceId: enquiry.id,
      message: "Captured deposit does not match the accepted quote.",
      resolved: false,
      createdAt: at,
      resolvedAt: null,
    };
    store.exceptions.push(exception);
    upsertPayment(store, input.payment);
    return { enquiry, confirmed: false, exception };
  }

  const beforeStatus = enquiry.status;
  hold.status = "converted";
  enquiry.status = "confirmed";
  enquiry.updatedAt = at;
  upsertPayment(store, input.payment);
  store.blocks = store.blocks.filter((block) => block.sourceId !== hold.id);
  store.blocks.push({
    id: randomId("blk"),
    propertyId: PROPERTY_ID,
    kind: "event",
    status: "confirmed",
    startDate: enquiry.startDate,
    endDate: enquiry.endDate,
    stayHalfOpen: false,
    sourceType: "event",
    sourceId: enquiry.id,
    expiresAt: null,
    createdAt: at,
  });
  pushAudit(
    store,
    input.actor ?? { id: "system", role: "system" },
    "event.confirmed",
    "event",
    enquiry.id,
    beforeStatus,
    enquiry.status,
    at,
  );
  return { enquiry, confirmed: true, exception: null };
}
