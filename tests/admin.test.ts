import { afterEach, describe, expect, it } from "vitest";
import { can, canAccessAudit, requirePermission } from "@/lib/auth/permissions";
import { buildCalendarEntries } from "@/lib/admin/calendar-entries";
import { createDevSeed } from "@/lib/data/seed";
import {
  addAdminBlock,
  cancelStayReservation,
  confirmStayFromVerifiedPayment,
  createEventEnquiry,
  createStayHold,
  getAdminCalendarEntries,
  getStore,
  removeAdminBlock,
  resetMemoryStore,
} from "@/lib/data/store";
import { paymentFromCapture } from "@/lib/payments/razorpay";
import { BookingValidationError } from "@/lib/inventory/validate";

const guest = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" };
const owner = { id: "admin-owner", role: "owner" as const };

afterEach(() => {
  resetMemoryStore(createDevSeed());
});

describe("admin permissions", () => {
  it("maps roles to server-side capabilities", () => {
    expect(can("owner", "payments.read")).toBe(true);
    expect(can("reservations", "calendar.write")).toBe(true);
    expect(can("reservations", "settings.write")).toBe(false);
    expect(can("operations", "calendar.read")).toBe(true);
    expect(can("content", "content.write")).toBe(true);
    expect(canAccessAudit("owner")).toBe(true);
    expect(canAccessAudit("reservations")).toBe(false);
    expect(() => requirePermission("content", "bookings.write")).toThrow(/Forbidden/);
  });
});

describe("master calendar entries", () => {
  it("loads stays, holds, and closures from the store ledger", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-10",
      checkOut: "2026-11-12",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    const block = await addAdminBlock({
      kind: "maintenance",
      startDate: "2026-11-20",
      endDate: "2026-11-21",
      reason: "Pool servicing",
      actor: owner,
    });
    const entries = getAdminCalendarEntries("2026-11-01", "2026-11-30");
    expect(entries.some((e) => e.kind === "stay" && e.sourceId === held.stay.id)).toBe(true);
    expect(entries.some((e) => e.kind === "hold" && e.sourceId === held.hold.id)).toBe(true);
    expect(entries.some((e) => e.kind === "maintenance" && e.blockId === block.id)).toBe(true);
  });

  it("does not list pending enquiries as calendar events", async () => {
    resetMemoryStore(createDevSeed());
    const enquiry = await createEventEnquiry({
      organizer: guest,
      eventType: "Team offsite",
      startDate: "2026-12-01",
      endDate: "2026-12-01",
      expectedAttendance: 15,
      preferredTiming: "Day",
      preferredStartTime: "10:00",
      preferredEndTime: "18:00",
      cateringNotes: "",
      decorationNotes: "",
      vendorNotes: "",
      setupNotes: "",
      accommodationRequested: false,
      additionalNotes: "",
      policyAccepted: true,
      privacyAccepted: true,
    });
    const entries = buildCalendarEntries(getStore(), "2026-12-01", "2026-12-05", new Date().toISOString());
    expect(entries.find((e) => e.reference === enquiry.reference)).toBeUndefined();
  });
});

describe("admin closures and cancellations", () => {
  it("rejects maintenance blocks that overlap confirmed stays", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-06",
      checkOut: "2026-11-08",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await confirmStayFromVerifiedPayment({
      stayId: held.stay.id,
      payment: paymentFromCapture({
        purpose: "stay",
        sourceId: held.stay.id,
        holdId: held.hold.id,
        amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
        orderId: "order_admin",
        paymentId: "pay_admin",
      }),
    });
    await expect(
      addAdminBlock({
        kind: "admin",
        startDate: "2026-11-07",
        endDate: "2026-11-07",
        reason: "Blackout",
        actor: owner,
      }),
    ).rejects.toBeInstanceOf(BookingValidationError);
  });

  it("removes maintenance blocks and records audit entries", async () => {
    resetMemoryStore(createDevSeed());
    const block = await addAdminBlock({
      kind: "maintenance",
      startDate: "2026-12-10",
      endDate: "2026-12-11",
      reason: "Generator test",
      actor: owner,
    });
    await removeAdminBlock({ blockId: block.id, actor: owner });
    const store = getStore();
    expect(store.blocks.find((b) => b.id === block.id)).toBeUndefined();
    expect(store.audit.some((a) => a.action === "calendar.block_removed" && a.entityId === block.id)).toBe(true);
  });

  it("cancels stays and frees inventory blocks", async () => {
    resetMemoryStore(createDevSeed());
    const held = await createStayHold({
      checkIn: "2026-11-14",
      checkOut: "2026-11-16",
      party: { adults: 2, children: 0 },
      guest,
      policyAccepted: true,
    });
    await confirmStayFromVerifiedPayment({
      stayId: held.stay.id,
      payment: paymentFromCapture({
        purpose: "stay",
        sourceId: held.stay.id,
        holdId: held.hold.id,
        amountPaise: held.stay.priceSnapshot.amountDueNowPaise,
        orderId: "order_cancel",
        paymentId: "pay_cancel",
      }),
    });
    await cancelStayReservation({ stayId: held.stay.id, reason: "Guest request", actor: owner });
    const store = getStore();
    expect(store.stays.find((s) => s.id === held.stay.id)?.status).toBe("cancelled");
    expect(store.blocks.some((b) => b.sourceId === held.stay.id)).toBe(false);
    expect(store.audit.some((a) => a.action === "stay.cancelled")).toBe(true);
  });
});
