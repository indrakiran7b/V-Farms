import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { createDevSeed } from "@/lib/data/seed";
import { withLock } from "@/lib/data/mutex";
import { randomBytes } from "crypto";
import { bookingReference, randomId } from "@/lib/crypto";
import { buildCalendarEntries } from "@/lib/admin/calendar-entries";
import { validateEventEnquiry } from "@/lib/events/validate";
import {
  PROPERTY_ID,
  type AppStore,
  type AdminRole,
  type EventEnquiry,
  type EventQuote,
  type GuestParty,
  type InventoryBlock,
  type InventoryHold,
  type PaymentRecord,
  type StayBooking,
} from "@/lib/types";
import { confirmEventInStore, confirmStayInStore } from "@/lib/data/payment-ledger";
import { conflictingStayNights, findConflicts, occupiedDatesForStay } from "@/lib/inventory/conflicts";
import { quoteStay } from "@/lib/inventory/pricing";
import { BookingValidationError, validateStayRequest } from "@/lib/inventory/validate";
import { addDays, nowIso } from "@/lib/time/kolkata";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "local-store.json");

let memory: AppStore | null = null;
let persistToDisk = true;

export function useMemoryStore(store: AppStore): void {
  memory = structuredClone(store);
  persistToDisk = false;
}

export function resetMemoryStore(store?: AppStore): AppStore {
  memory = structuredClone(store ?? createDevSeed());
  persistToDisk = false;
  return memory;
}

function emptyStore(): AppStore {
  return createDevSeed(process.env.ADMIN_BOOTSTRAP_EMAIL, process.env.ADMIN_BOOTSTRAP_PASSWORD);
}

function readStore(): AppStore {
  if (memory) return memory;
  if (!persistToDisk) {
    memory = emptyStore();
    return memory;
  }
  if (!existsSync(STORE_PATH)) {
    mkdirSync(DATA_DIR, { recursive: true });
    const seeded = emptyStore();
    writeFileSync(STORE_PATH, JSON.stringify(seeded, null, 2));
    memory = seeded;
    return seeded;
  }
  const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as AppStore;
  memory = normalizeStore(parsed);
  return memory;
}

function normalizeStore(store: AppStore): AppStore {
  const seed = createDevSeed();
  if (!store.eventCategories?.length) store.eventCategories = seed.eventCategories;
  if (store.settings.maxEventAttendance === undefined) {
    store.settings.maxEventAttendance = seed.settings.maxEventAttendance;
    store.settings.eventCapacityAwaitingOwnerApproval = seed.settings.eventCapacityAwaitingOwnerApproval;
  }
  for (const enquiry of store.enquiries) {
    enquiry.privacyAccepted ??= true;
    enquiry.preferredStartTime ??= enquiry.preferredTiming ?? "";
    enquiry.preferredEndTime ??= "";
    enquiry.internalNotes ??= "";
  }
  for (const stay of store.stays) {
    stay.customerAccessToken ??= randomBytes(24).toString("hex");
  }
  for (const enquiry of store.enquiries) {
    enquiry.customerAccessToken ??= randomBytes(24).toString("hex");
  }
  for (const notification of store.notifications) {
    notification.html ??= null;
    notification.idempotencyKey ??= null;
  }
  for (const refund of store.refunds) {
    refund.status ??= "pending";
    refund.customerNotified ??= false;
  }
  for (const payment of store.payments) {
    payment.recordedByActorId ??= null;
    payment.receivedAt ??= payment.capturedAt;
    payment.internalNotes ??= null;
  }
  for (const quote of store.quotes) {
    quote.version ??= 1;
    quote.accessToken ??= randomBytes(24).toString("hex");
    quote.supersedesQuoteId ??= null;
    quote.balancePaise ??= quote.totalPaise - quote.depositPaise;
    quote.securityDepositPaise ??= 0;
    quote.cancellationTerms ??= "Cancellation terms awaiting owner approval.";
    quote.declinedAt ??= null;
  }
  return store;
}

function writeStore(store: AppStore): void {
  memory = store;
  if (!persistToDisk) return;
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function getStore(): AppStore {
  return structuredClone(readStore());
}

function expireHolds(store: AppStore, at: string): void {
  for (const hold of store.holds) {
    if (hold.status === "active" && hold.expiresAt <= at) {
      hold.status = "expired";
    }
  }
  store.blocks = store.blocks.filter((block) => {
    if (block.kind !== "hold") return true;
    if (block.expiresAt && block.expiresAt <= at) return false;
    const hold = store.holds.find((item) => item.id === block.sourceId);
    return Boolean(hold && hold.status === "active" && hold.expiresAt > at);
  });
  for (const stay of store.stays) {
    if ((stay.status === "held" || stay.status === "awaiting_payment") && stay.holdExpiresAt && stay.holdExpiresAt <= at) {
      stay.status = "expired";
      stay.updatedAt = at;
    }
  }
  for (const enquiry of store.enquiries) {
    if ((enquiry.status === "held" || enquiry.status === "awaiting_deposit") && enquiry.holdId) {
      const hold = store.holds.find((item) => item.id === enquiry.holdId);
      if (!hold || hold.status === "expired") {
        enquiry.status = "expired";
        enquiry.updatedAt = at;
      }
    }
  }
}

function audit(
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

function policySnapshot(at: string) {
  return {
    version: "mvp-draft-unapproved",
    cancellationSummary:
      "Cancellation and refund terms are unpublished pending owner approval. Guests will be shown the approved policy before live payments.",
    stayTermsSummary: "The stay reserves the entire V-Farms property, including all five rooms.",
    eventTermsSummary: "Events require an accepted quote. Overnight room access is included only when the quote says so.",
    acceptedAt: at,
  };
}

export async function withInventory<T>(fn: (store: AppStore) => T | Promise<T>): Promise<T> {
  return withLock(async () => {
    const store = readStore();
    expireHolds(store, nowIso());
    const result = await fn(store);
    writeStore(store);
    return result;
  });
}

export function getPublicEventConfig() {
  const store = getStore();
  return {
    timezone: store.settings.timezone,
    maxEventAttendance: store.settings.maxEventAttendance,
    eventCapacityAwaitingOwnerApproval: store.settings.eventCapacityAwaitingOwnerApproval,
    categories: store.eventCategories.filter((item) => item.published),
    unpublishedCategoryCount: store.eventCategories.filter((item) => !item.published).length,
    contactEmail: store.settings.contactEmail,
    contactPhone: store.settings.contactPhone,
    supportHours: store.settings.supportHours,
  };
}

export async function getQuoteByAccessToken(token: string) {
  return withInventory((store) => {
    expireHolds(store, nowIso());
    const quote = store.quotes.find((item) => item.accessToken === token);
    if (!quote) return null;
    const enquiry = store.enquiries.find((item) => item.id === quote.enquiryId);
    if (!enquiry) return null;
    const at = nowIso();
    if (quote.status === "sent" && quote.expiresAt <= at) {
      quote.status = "expired";
      enquiry.status = enquiry.status === "quote_sent" ? "expired" : enquiry.status;
      enquiry.updatedAt = at;
    }
    return { quote, enquiry };
  });
}

export function publicAvailability(from: string, to: string) {
  const store = getStore();
  expireHolds(store, nowIso());
  const occupied = occupiedDatesForStay(store.blocks, nowIso());
  const dates: Array<{ date: string; available: boolean }> = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push({ date: cursor, available: !occupied.has(cursor) });
    cursor = addDays(cursor, 1);
  }
  return {
    propertyId: PROPERTY_ID,
    timezone: store.settings.timezone,
    from,
    to,
    dates,
    settings: {
      minNights: store.settings.minNights,
      maxNights: store.settings.maxNights,
      maxGuests: store.settings.maxGuests,
      maxAdults: store.settings.maxAdults,
      maxChildren: store.settings.maxChildren,
      turnoverSameDayAllowed: store.settings.turnoverSameDayAllowed,
      capacityAwaitingOwnerApproval: store.settings.capacityAwaitingOwnerApproval,
      publishedRatesAwaitingOwnerApproval: store.settings.publishedRatesAwaitingOwnerApproval,
      checkInTime: store.settings.checkInTime,
      checkOutTime: store.settings.checkOutTime,
    },
  };
}

export function priceStayPreview(checkIn: string, checkOut: string, party: GuestParty, addOnIds: string[] = []) {
  return withInventory((store) => {
    validateStayRequest(checkIn, checkOut, party, store.settings);
    const at = nowIso();
    const conflicts = findConflicts(
      { purpose: "stay", startDate: checkIn, endDate: checkOut },
      store.blocks,
      at,
      store.settings.turnoverSameDayAllowed,
    );
    const unavailableNights = conflictingStayNights(
      checkIn,
      checkOut,
      store.blocks,
      at,
      store.settings.turnoverSameDayAllowed,
    );
    const available = conflicts.length === 0;
    const snapshot = available
      ? quoteStay({
          checkIn,
          checkOut,
          rateRules: store.rateRules,
          taxes: store.taxes,
          addOns: store.addOns,
          selectedAddOnIds: addOnIds,
        })
      : {
          currency: "INR" as const,
          nights: [],
          subtotalPaise: 0,
          addOns: [],
          taxes: [],
          depositPaise: 0,
          securityDepositPaise: 0,
          totalPaise: 0,
          amountDueNowPaise: 0,
          balanceDuePaise: 0,
          notes: [],
          generatedAt: at,
        };
    return {
      available,
      conflicts: conflicts.map((item) => item.kind),
      unavailableNights,
      snapshot,
    };
  });
}

function insertHold(
  store: AppStore,
  purpose: "stay" | "event",
  startDate: string,
  endDate: string,
  sourceId: string | null,
  at: string,
): InventoryHold {
  const conflicts = findConflicts(
    { purpose, startDate, endDate },
    store.blocks,
    at,
    store.settings.turnoverSameDayAllowed,
  );
  if (conflicts.length > 0) {
    throw new BookingValidationError("Those dates are not available for the entire property.", "UNAVAILABLE");
  }
  const hold: InventoryHold = {
    id: randomId("hold"),
    propertyId: PROPERTY_ID,
    purpose,
    status: "active",
    startDate,
    endDate,
    stayHalfOpen: purpose === "stay",
    expiresAt: new Date(Date.parse(at) + store.settings.holdMinutes * 60_000).toISOString(),
    sourceId,
    createdAt: at,
  };
  const block: InventoryBlock = {
    id: randomId("blk"),
    propertyId: PROPERTY_ID,
    kind: "hold",
    holdPurpose: purpose,
    status: "held",
    startDate,
    endDate,
    stayHalfOpen: purpose === "stay",
    sourceType: "hold",
    sourceId: hold.id,
    expiresAt: hold.expiresAt,
    createdAt: at,
  };
  store.holds.push(hold);
  store.blocks.push(block);
  return hold;
}

export async function createStayHold(input: {
  checkIn: string;
  checkOut: string;
  party: GuestParty;
  guest: { name: string; email: string; phone: string };
  addOnIds?: string[];
  policyAccepted: boolean;
}) {
  if (!input.policyAccepted) {
    throw new BookingValidationError("Policy acceptance is required.", "POLICY", "policyAccepted");
  }
  return withInventory((store) => {
    const at = nowIso();
    validateStayRequest(input.checkIn, input.checkOut, input.party, store.settings);
    const snapshot = quoteStay({
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      rateRules: store.rateRules,
      taxes: store.taxes,
      addOns: store.addOns,
      selectedAddOnIds: input.addOnIds,
    });
    const contact = {
      id: randomId("ctc"),
      name: input.guest.name.trim(),
      email: input.guest.email.trim().toLowerCase(),
      phone: input.guest.phone.trim(),
      createdAt: at,
    };
    store.contacts.push(contact);
    const stay: StayBooking = {
      id: randomId("stay"),
      reference: bookingReference("VF"),
      customerAccessToken: randomBytes(24).toString("hex"),
      propertyId: PROPERTY_ID,
      status: "held",
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      party: input.party,
      guest: contact,
      holdId: null,
      holdExpiresAt: null,
      priceSnapshot: snapshot,
      policySnapshot: policySnapshot(at),
      paymentIds: [],
      notes: "",
      createdAt: at,
      updatedAt: at,
    };
    const hold = insertHold(store, "stay", input.checkIn, input.checkOut, stay.id, at);
    stay.holdId = hold.id;
    stay.holdExpiresAt = hold.expiresAt;
    stay.status = "awaiting_payment";
    store.stays.push(stay);
    audit(store, { id: contact.id, role: "guest" }, "stay.hold_created", "stay", stay.id, null, stay, at);
    return { stay, hold };
  });
}

export async function confirmStayFromVerifiedPayment(input: {
  stayId: string;
  payment: PaymentRecord;
  actor?: { id: string; role: AdminRole | "system" | "guest" };
}) {
  return withInventory((store) => {
    const stay = store.stays.find((item) => item.id === input.stayId);
    if (!stay) throw new BookingValidationError("Stay not found.", "NOT_FOUND");
    return confirmStayInStore(store, input, nowIso());
  });
}

export async function createEventEnquiry(input: {
  organizer: { name: string; email: string; phone: string };
  eventType: string;
  startDate: string;
  endDate: string;
  expectedAttendance: number;
  preferredTiming: string;
  preferredStartTime: string;
  preferredEndTime: string;
  cateringNotes: string;
  decorationNotes: string;
  vendorNotes: string;
  setupNotes: string;
  accommodationRequested: boolean;
  additionalNotes: string;
  policyAccepted: boolean;
  privacyAccepted: boolean;
}) {
  return withInventory((store) => {
    validateEventEnquiry({
      organizer: input.organizer,
      eventType: input.eventType,
      startDate: input.startDate,
      endDate: input.endDate,
      expectedAttendance: input.expectedAttendance,
      preferredStartTime: input.preferredStartTime,
      preferredEndTime: input.preferredEndTime,
      policyAccepted: input.policyAccepted,
      privacyAccepted: input.privacyAccepted,
      settings: store.settings,
    });
    const at = nowIso();
    const contact = {
      id: randomId("ctc"),
      name: input.organizer.name.trim(),
      email: input.organizer.email.trim().toLowerCase(),
      phone: input.organizer.phone.trim(),
      createdAt: at,
    };
    store.contacts.push(contact);
    const enquiry: EventEnquiry = {
      id: randomId("enq"),
      reference: bookingReference("EV"),
      customerAccessToken: randomBytes(24).toString("hex"),
      status: "enquiry",
      organizer: contact,
      eventType: input.eventType.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      expectedAttendance: input.expectedAttendance,
      preferredTiming: input.preferredTiming,
      preferredStartTime: input.preferredStartTime,
      preferredEndTime: input.preferredEndTime,
      cateringNotes: input.cateringNotes,
      decorationNotes: input.decorationNotes,
      vendorNotes: input.vendorNotes,
      setupNotes: input.setupNotes,
      accommodationRequested: input.accommodationRequested,
      additionalNotes: input.additionalNotes,
      policyAccepted: true,
      privacyAccepted: input.privacyAccepted,
      internalNotes: "",
      quoteId: null,
      holdId: null,
      createdAt: at,
      updatedAt: at,
    };
    store.enquiries.push(enquiry);
    audit(store, { id: contact.id, role: "guest" }, "event.enquiry_created", "event", enquiry.id, null, enquiry, at);
    return enquiry;
  });
}

export async function createAndSendQuote(input: {
  enquiryId: string;
  overnightRoomsIncluded: boolean;
  inclusions: string[];
  exclusions: string[];
  lines: Array<{ label: string; amountPaise: number; inclusion: boolean }>;
  depositPaise: number;
  securityDepositPaise?: number;
  cancellationTerms?: string;
  expiresAt: string;
  actor: { id: string; role: AdminRole };
}) {
  return withInventory((store) => {
    const at = nowIso();
    const enquiry = store.enquiries.find((item) => item.id === input.enquiryId);
    if (!enquiry) throw new BookingValidationError("Enquiry not found.", "NOT_FOUND");
    if (enquiry.status === "declined" || enquiry.status === "cancelled") {
      throw new BookingValidationError("Cannot quote a closed enquiry.", "STATE");
    }
    const totalPaise = input.lines.reduce((sum, line) => sum + line.amountPaise, 0);
    if (input.depositPaise <= 0 || input.depositPaise > totalPaise) {
      throw new BookingValidationError("Deposit must be between zero and the quote total.", "DEPOSIT");
    }
    const previous = enquiry.quoteId ? store.quotes.find((item) => item.id === enquiry.quoteId) : undefined;
    if (previous && previous.status === "sent") {
      previous.status = "withdrawn";
    }
    const priorVersions = store.quotes.filter((item) => item.enquiryId === enquiry.id);
    const version = priorVersions.length + 1;
    const quote: EventQuote = {
      id: randomId("qte"),
      enquiryId: enquiry.id,
      version,
      accessToken: randomBytes(24).toString("hex"),
      supersedesQuoteId: previous?.id ?? null,
      status: "sent",
      overnightRoomsIncluded: input.overnightRoomsIncluded,
      overnightRoomsStatement: input.overnightRoomsIncluded
        ? "This quotation includes overnight access to the five guest rooms."
        : "This quotation does not include overnight access to the five guest rooms.",
      inclusions: input.inclusions,
      exclusions: input.exclusions,
      lines: input.lines.map((line) => ({ ...line, id: randomId("ql") })),
      depositPaise: input.depositPaise,
      balancePaise: totalPaise - input.depositPaise,
      securityDepositPaise: input.securityDepositPaise ?? 0,
      totalPaise,
      cancellationTerms:
        input.cancellationTerms ??
        "Cancellation terms are draft and awaiting owner and legal approval.",
      expiresAt: input.expiresAt,
      policySnapshot: policySnapshot(at),
      sentAt: at,
      acceptedAt: null,
      declinedAt: null,
      createdAt: at,
    };
    store.quotes.push(quote);
    enquiry.quoteId = quote.id;
    enquiry.status = "quote_sent";
    enquiry.updatedAt = at;
    audit(store, input.actor, "event.quote_sent", "quote", quote.id, previous ?? null, quote, at);
    return quote;
  });
}

export async function updateEnquiryReview(input: {
  enquiryId: string;
  status: "review" | "declined";
  internalNotes?: string;
  declineReason?: string;
  actor: { id: string; role: AdminRole };
}) {
  return withInventory((store) => {
    const at = nowIso();
    const enquiry = store.enquiries.find((item) => item.id === input.enquiryId);
    if (!enquiry) throw new BookingValidationError("Enquiry not found.", "NOT_FOUND");
    const before = enquiry.status;
    if (input.internalNotes !== undefined) enquiry.internalNotes = input.internalNotes;
    if (input.status === "declined") {
      enquiry.status = "declined";
      enquiry.additionalNotes = input.declineReason
        ? `${enquiry.additionalNotes}\n[Declined: ${input.declineReason}]`.trim()
        : enquiry.additionalNotes;
    } else {
      enquiry.status = "review";
    }
    enquiry.updatedAt = at;
    audit(store, input.actor, "event.enquiry_review", "event", enquiry.id, before, enquiry, at);
    return enquiry;
  });
}

export async function acceptQuoteAndHold(accessToken: string) {
  return withInventory((store) => {
    const at = nowIso();
    const quote = store.quotes.find((item) => item.accessToken === accessToken);
    if (!quote) throw new BookingValidationError("Quote not found.", "NOT_FOUND");
    if (quote.status !== "sent") throw new BookingValidationError("Quote is not awaiting acceptance.", "STATE");
    if (quote.expiresAt <= at) {
      quote.status = "expired";
      throw new BookingValidationError("This quotation has expired.", "EXPIRED");
    }
    const enquiry = store.enquiries.find((item) => item.id === quote.enquiryId);
    if (!enquiry) throw new BookingValidationError("Enquiry not found.", "NOT_FOUND");
    const hold = insertHold(store, "event", enquiry.startDate, enquiry.endDate, enquiry.id, at);
    quote.status = "accepted";
    quote.acceptedAt = at;
    enquiry.status = "awaiting_deposit";
    enquiry.holdId = hold.id;
    enquiry.updatedAt = at;
    audit(store, { id: enquiry.organizer.id, role: "guest" }, "event.quote_accepted", "event", enquiry.id, "quote_sent", enquiry, at);
    return { enquiry, quote, hold };
  });
}

export async function declineQuoteByOrganizer(accessToken: string) {
  return withInventory((store) => {
    const at = nowIso();
    const quote = store.quotes.find((item) => item.accessToken === accessToken);
    if (!quote) throw new BookingValidationError("Quote not found.", "NOT_FOUND");
    if (quote.status !== "sent") throw new BookingValidationError("Quote is not open for response.", "STATE");
    const enquiry = store.enquiries.find((item) => item.id === quote.enquiryId);
    if (!enquiry) throw new BookingValidationError("Enquiry not found.", "NOT_FOUND");
    quote.status = "declined";
    quote.declinedAt = at;
    enquiry.status = "declined";
    enquiry.updatedAt = at;
    audit(store, { id: enquiry.organizer.id, role: "guest" }, "event.quote_declined", "event", enquiry.id, "quote_sent", enquiry, at);
    return { enquiry, quote };
  });
}

export async function confirmEventFromVerifiedPayment(input: {
  enquiryId: string;
  payment: PaymentRecord;
  actor?: { id: string; role: AdminRole | "system" | "guest" };
}) {
  return withInventory((store) => {
    const enquiry = store.enquiries.find((item) => item.id === input.enquiryId);
    if (!enquiry) throw new BookingValidationError("Enquiry not found.", "NOT_FOUND");
    return confirmEventInStore(store, input, nowIso());
  });
}

export async function addAdminBlock(input: {
  kind: "maintenance" | "admin";
  startDate: string;
  endDate: string;
  reason: string;
  internalNotes?: string;
  actor: { id: string; role: AdminRole };
}) {
  return withInventory((store) => {
    const at = nowIso();
    if (input.endDate < input.startDate) {
      throw new BookingValidationError("End date must be on or after start date.", "DATE_ORDER");
    }
    const conflicts = findConflicts(
      { purpose: "event", startDate: input.startDate, endDate: input.endDate },
      store.blocks,
      at,
      store.settings.turnoverSameDayAllowed,
    );
    if (conflicts.length > 0) {
      throw new BookingValidationError(
        `Conflict with existing ${conflicts.map((c) => c.kind).join(", ")} on the property calendar.`,
        "UNAVAILABLE",
      );
    }
    const block: InventoryBlock = {
      id: randomId("blk"),
      propertyId: PROPERTY_ID,
      kind: input.kind,
      status: "active",
      startDate: input.startDate,
      endDate: input.endDate,
      stayHalfOpen: false,
      sourceType: input.kind,
      sourceId: randomId(input.kind),
      expiresAt: null,
      reason: input.reason.trim(),
      internalNotes: input.internalNotes?.trim() ?? null,
      createdByActorId: input.actor.id,
      createdAt: at,
    };
    store.blocks.push(block);
    audit(store, input.actor, "calendar.block_added", "block", block.id, null, block, at);
    return block;
  });
}

export async function removeAdminBlock(input: {
  blockId: string;
  actor: { id: string; role: AdminRole };
}) {
  return withInventory((store) => {
    const at = nowIso();
    const index = store.blocks.findIndex((item) => item.id === input.blockId);
    if (index < 0) throw new BookingValidationError("Block not found.", "NOT_FOUND");
    const block = store.blocks[index];
    if (block.kind !== "maintenance" && block.kind !== "admin") {
      throw new BookingValidationError("Only maintenance or admin closures can be removed here.", "FORBIDDEN");
    }
    store.blocks.splice(index, 1);
    audit(store, input.actor, "calendar.block_removed", "block", block.id, block, null, at);
    return block;
  });
}

export async function cancelStayReservation(input: {
  stayId: string;
  reason: string;
  actor: { id: string; role: AdminRole };
}) {
  return withInventory((store) => {
    const at = nowIso();
    const stay = store.stays.find((item) => item.id === input.stayId);
    if (!stay) throw new BookingValidationError("Stay not found.", "NOT_FOUND");
    const before = stay.status;
    if (stay.status === "cancelled") return stay;
    stay.status = "cancelled";
    stay.updatedAt = at;
    stay.notes = `${stay.notes}\n[Cancelled: ${input.reason}]`.trim();
    if (stay.holdId) {
      const hold = store.holds.find((item) => item.id === stay.holdId);
      if (hold) hold.status = "released";
    }
    store.blocks = store.blocks.filter(
      (block) => !(block.sourceType === "stay" && block.sourceId === stay.id) && block.sourceId !== stay.holdId,
    );
    audit(store, input.actor, "stay.cancelled", "stay", stay.id, before, stay, at);
    return stay;
  });
}

export function getAdminCalendarEntries(from: string, to: string) {
  const store = getStore();
  expireHolds(store, nowIso());
  return buildCalendarEntries(store, from, to, nowIso());
}

export async function attachRazorpayOrder(input: {
  purpose: "stay" | "event";
  sourceId: string;
  amountPaise: number;
  orderId: string;
  holdId: string | null;
}) {
  return withInventory((store) => {
    const at = nowIso();
    const payment: PaymentRecord = {
      id: randomId("pay"),
      purpose: input.purpose,
      sourceId: input.sourceId,
      holdId: input.holdId,
      status: "pending",
      amountPaise: input.amountPaise,
      currency: "INR",
      method: "razorpay",
      razorpayOrderId: input.orderId,
      razorpayPaymentId: null,
      offlineReference: null,
      recordedByActorId: null,
      receivedAt: null,
      internalNotes: null,
      capturedAt: null,
      createdAt: at,
    };
    store.payments.push(payment);
    return payment;
  });
}

export function findPaymentByOrderId(orderId: string) {
  return getStore().payments.find((item) => item.razorpayOrderId === orderId);
}

export function getPublicBookingStatus(token: string) {
  const store = getStore();
  const stay = store.stays.find((item) => item.customerAccessToken === token);
  if (stay) {
    const payments = store.payments.filter((p) => stay.paymentIds.includes(p.id) || p.sourceId === stay.id);
    return {
      kind: "stay" as const,
      reference: stay.reference,
      status: stay.status,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      guestName: stay.guest.name,
      amountDueNowPaise: stay.priceSnapshot.amountDueNowPaise,
      totalPaise: stay.priceSnapshot.totalPaise,
      balanceDuePaise: stay.priceSnapshot.balanceDuePaise,
      policySummary: stay.policySnapshot.cancellationSummary,
      payments: payments.map((p) => ({
        status: p.status,
        amountPaise: p.amountPaise,
        method: p.method,
        capturedAt: p.capturedAt,
      })),
    };
  }
  const enquiry = store.enquiries.find((item) => item.customerAccessToken === token);
  if (enquiry) {
    const quote = enquiry.quoteId ? store.quotes.find((q) => q.id === enquiry.quoteId) : undefined;
    const payments = store.payments.filter((p) => p.sourceId === enquiry.id);
    return {
      kind: "event" as const,
      reference: enquiry.reference,
      status: enquiry.status,
      startDate: enquiry.startDate,
      endDate: enquiry.endDate,
      eventType: enquiry.eventType,
      organizerName: enquiry.organizer.name,
      depositPaise: quote?.depositPaise ?? null,
      balancePaise: quote?.balancePaise ?? null,
      payments: payments.map((p) => ({
        status: p.status,
        amountPaise: p.amountPaise,
        method: p.method,
        capturedAt: p.capturedAt,
      })),
    };
  }
  return null;
}

export async function recordWebhookOnce(eventId: string, eventType: string, payloadHash: string) {
  return withInventory((store) => {
    const existing = store.webhooks.find((item) => item.eventId === eventId);
    if (existing) return { duplicate: true, existing };
    const record = {
      id: randomId("wh"),
      provider: "razorpay" as const,
      eventId,
      eventType,
      processedAt: nowIso(),
      payloadHash,
    };
    store.webhooks.push(record);
    return { duplicate: false, existing: record };
  });
}

function resolveOfflineTarget(
  store: AppStore,
  input: { purpose: "stay" | "event"; sourceId?: string; bookingReference?: string },
): { sourceId: string; holdId: string | null; requiredPaise: number; eligibleStatuses: string[] } {
  const ref = input.bookingReference?.trim().toUpperCase();
  if (input.purpose === "stay") {
    const stay = input.sourceId
      ? store.stays.find((s) => s.id === input.sourceId)
      : store.stays.find((s) => s.reference === ref);
    if (!stay) throw new BookingValidationError("Stay reservation not found.", "NOT_FOUND");
    return {
      sourceId: stay.id,
      holdId: stay.holdId,
      requiredPaise: stay.priceSnapshot.amountDueNowPaise,
      eligibleStatuses: ["held", "awaiting_payment", "expired"],
    };
  }
  const enquiry = input.sourceId
    ? store.enquiries.find((e) => e.id === input.sourceId)
    : store.enquiries.find((e) => e.reference === ref);
  if (!enquiry) throw new BookingValidationError("Event enquiry not found.", "NOT_FOUND");
  const quote = enquiry.quoteId ? store.quotes.find((q) => q.id === enquiry.quoteId) : undefined;
  if (!quote) throw new BookingValidationError("Event has no accepted quotation.", "STATE");
  return {
    sourceId: enquiry.id,
    holdId: enquiry.holdId,
    requiredPaise: quote.depositPaise,
    eligibleStatuses: ["accepted", "awaiting_deposit", "held", "expired"],
  };
}

export async function recordOfflinePayment(input: {
  purpose: "stay" | "event";
  sourceId?: string;
  bookingReference?: string;
  amountPaise: number;
  method: PaymentRecord["method"];
  reference: string;
  receivedAt?: string;
  internalNotes?: string;
  actor: { id: string; role: AdminRole };
}) {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new BookingValidationError("Amount must be a positive whole number of paise.", "AMOUNT");
  }
  const txnRef = input.reference.trim();
  if (txnRef.length < 2) {
    throw new BookingValidationError("A transaction or reference number is required.", "REFERENCE");
  }
  if (!input.sourceId && !input.bookingReference?.trim()) {
    throw new BookingValidationError("Provide a booking reference or reservation id.", "NOT_FOUND");
  }

  if (input.receivedAt && Number.isNaN(Date.parse(input.receivedAt))) {
    throw new BookingValidationError("Received timestamp is not a valid ISO date.", "DATE");
  }

  return withInventory((store) => {
    const at = nowIso();
    const target = resolveOfflineTarget(store, input);

    const idempotent = store.payments.find(
      (p) =>
        p.sourceId === target.sourceId &&
        p.offlineReference?.toLowerCase() === txnRef.toLowerCase() &&
        p.method === input.method &&
        p.amountPaise === input.amountPaise,
    );
    if (idempotent) {
      const stay = input.purpose === "stay" ? store.stays.find((s) => s.id === target.sourceId) : undefined;
      const enquiry = input.purpose === "event" ? store.enquiries.find((e) => e.id === target.sourceId) : undefined;
      return {
        kind: "idempotent" as const,
        confirmed: stay?.status === "confirmed" || enquiry?.status === "confirmed",
        partial: input.amountPaise < target.requiredPaise,
        payment: idempotent,
        stay: stay ?? null,
        enquiry: enquiry ?? null,
        exception: null,
      };
    }

    const crossBookingDuplicate = store.payments.find(
      (p) =>
        p.status === "captured" &&
        p.offlineReference?.toLowerCase() === txnRef.toLowerCase() &&
        p.method === input.method &&
        p.sourceId !== target.sourceId,
    );
    if (crossBookingDuplicate) {
      throw new BookingValidationError(
        "This transaction reference is already recorded on another booking.",
        "DUPLICATE",
      );
    }

    const stay = input.purpose === "stay" ? store.stays.find((s) => s.id === target.sourceId) : undefined;
    const enquiry = input.purpose === "event" ? store.enquiries.find((e) => e.id === target.sourceId) : undefined;
    const record = stay ?? enquiry;
    if (!record) throw new BookingValidationError("Booking not found.", "NOT_FOUND");
    if (!target.eligibleStatuses.includes(record.status)) {
      throw new BookingValidationError(
        `Booking status "${record.status}" is not eligible for offline payment recording.`,
        "STATE",
      );
    }

    const receivedAt = input.receivedAt ?? at;
    const payment: PaymentRecord = {
      id: randomId("pay"),
      purpose: input.purpose,
      sourceId: target.sourceId,
      holdId: target.holdId,
      status: "captured",
      amountPaise: input.amountPaise,
      currency: "INR",
      method: input.method,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      offlineReference: txnRef,
      recordedByActorId: input.actor.id,
      receivedAt,
      internalNotes: input.internalNotes?.trim() ?? null,
      capturedAt: receivedAt,
      createdAt: at,
    };

    const beforeStatus = record.status;

    if (input.amountPaise < target.requiredPaise) {
      if (input.purpose === "stay" && stay) {
        stay.paymentIds.push(payment.id);
      }
      store.payments.push(payment);
      audit(store, input.actor, "payment.offline_partial", "payment", payment.id, beforeStatus, payment, at);
      return {
        confirmed: false,
        partial: true,
        payment,
        stay: stay ?? null,
        enquiry: enquiry ?? null,
        exception: null,
      };
    }

    if (input.amountPaise > target.requiredPaise) {
      throw new BookingValidationError(
        "Amount exceeds the configured amount due for this stage. Record a partial payment or adjust the quotation.",
        "AMOUNT",
      );
    }

    store.payments.push(payment);
    audit(store, input.actor, "payment.offline_recorded", "payment", payment.id, beforeStatus, payment, at);

    if (input.purpose === "stay" && stay) {
      const outcome = confirmStayInStore(store, { stayId: stay.id, payment, actor: input.actor }, at);
      return { ...outcome, partial: false, payment };
    }
    if (input.purpose === "event" && enquiry) {
      const outcome = confirmEventInStore(store, { enquiryId: enquiry.id, payment, actor: input.actor }, at);
      return { ...outcome, partial: false, payment };
    }
    throw new BookingValidationError("Unable to resolve booking for confirmation.", "NOT_FOUND");
  });
}

export async function updateSettings(
  patch: Partial<AppStore["settings"]>,
  actor: { id: string; role: AdminRole },
) {
  return withInventory((store) => {
    const before = { ...store.settings };
    store.settings = { ...store.settings, ...patch, id: PROPERTY_ID };
    audit(store, actor, "settings.updated", "settings", PROPERTY_ID, before, store.settings, nowIso());
    return store.settings;
  });
}

export async function updateRoom(
  roomId: string,
  patch: Partial<AppStore["rooms"][number]>,
  actor: { id: string; role: AdminRole },
) {
  return withInventory((store) => {
    const room = store.rooms.find((item) => item.id === roomId);
    if (!room) throw new BookingValidationError("Room not found.", "NOT_FOUND");
    const before = { ...room };
    Object.assign(room, patch, { id: roomId });
    audit(store, actor, "room.updated", "room", roomId, before, room, nowIso());
    return room;
  });
}

export async function updateContent(patch: Partial<AppStore["content"]>, actor: { id: string; role: AdminRole }) {
  return withInventory((store) => {
    const before = { ...store.content };
    store.content = { ...store.content, ...patch };
    audit(store, actor, "content.updated", "content", "site", before, store.content, nowIso());
    return store.content;
  });
}

export async function upsertRateRule(rule: AppStore["rateRules"][number], actor: { id: string; role: AdminRole }) {
  return withInventory((store) => {
    const index = store.rateRules.findIndex((item) => item.id === rule.id);
    const before = index >= 0 ? store.rateRules[index] : null;
    if (index >= 0) store.rateRules[index] = rule;
    else store.rateRules.push(rule);
    audit(store, actor, "pricing.rate_upserted", "rate", rule.id, before, rule, nowIso());
    return rule;
  });
}

export async function recordRefund(input: {
  paymentId: string;
  amountPaise: number;
  reason: string;
  gatewayReference?: string | null;
  failed?: boolean;
  actor: { id: string; role: AdminRole };
}) {
  return withInventory((store) => {
    const payment = store.payments.find((item) => item.id === input.paymentId);
    if (!payment) throw new BookingValidationError("Payment not found.", "NOT_FOUND");
    const refund = {
      id: randomId("rfd"),
      paymentId: payment.id,
      amountPaise: input.amountPaise,
      reason: input.reason,
      actorId: input.actor.id,
      status: (input.failed ? "failed" : input.gatewayReference ? "succeeded" : "pending") as
        | "pending"
        | "succeeded"
        | "failed",
      createdAt: nowIso(),
      gatewayReference: input.gatewayReference ?? null,
      customerNotified: false,
    };
    store.refunds.push(refund);
    payment.status =
      refund.status === "failed"
        ? payment.status
        : input.amountPaise >= payment.amountPaise
          ? "refunded"
          : "partially_refunded";
    if (refund.status === "failed") {
      store.exceptions.push({
        id: randomId("exc"),
        kind: "partial_refund",
        paymentId: payment.id,
        sourceId: payment.sourceId,
        message: "Gateway refund failed or could not be verified.",
        resolved: false,
        createdAt: nowIso(),
        resolvedAt: null,
      });
    }
    audit(store, input.actor, "payment.refund_recorded", "refund", refund.id, payment, refund, nowIso());
    return refund;
  });
}

export async function retryNotification(id: string, actor: { id: string; role: AdminRole }) {
  return withInventory((store) => {
    const record = store.notifications.find((item) => item.id === id);
    if (!record) throw new BookingValidationError("Notification not found.", "NOT_FOUND");
    audit(store, actor, "notification.retry", "notification", id, record.status, "queued", nowIso());
  });
}

export function listRetryableNotifications(limit = 20) {
  const store = getStore();
  return store.notifications
    .filter((item) => item.status === "failed" && item.attempts < 5)
    .slice(0, limit);
}

export { STORE_PATH };
