"use client";

import { useMemo, useState } from "react";
import { adminAction, useAdminData } from "@/components/admin/useAdminData";
import { formatDisplayDate, formatInr } from "@/lib/time/kolkata";

export function AdminBookingsPanel() {
  const { data, error, reload } = useAdminData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState<string | null>(null);

  const stays = useMemo(() => {
    if (!data) return [];
    return data.stays.filter((stay) => {
      if (status !== "all" && stay.status !== status) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        stay.reference.toLowerCase().includes(q) ||
        stay.guest.name.toLowerCase().includes(q) ||
        stay.guest.email.toLowerCase().includes(q) ||
        stay.checkIn.includes(q)
      );
    });
  }, [data, query, status]);

  async function cancelStay(stayId: string) {
    const reason = window.prompt("Cancellation reason (audit trail)");
    if (!reason) return;
    try {
      await adminAction("stay.cancel", { stayId, reason });
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to cancel");
    }
  }

  if (error) return <p className="p-8 text-pink-700">{error}</p>;
  if (!data) return <p className="p-8">Loading stays…</p>;

  return (
    <main className="p-6 md:p-8">
      <h1 className="font-serif text-4xl">Stay reservations</h1>
      <p className="mt-1 text-sm text-muted">Whole-estate bookings only · five rooms included together</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 border border-earth-700/20 px-3 py-2"
          placeholder="Search reference, guest, email, date…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="border border-earth-700/20 px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="held">Held</option>
          <option value="awaiting_payment">Awaiting payment</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      {message ? <p className="mt-3 text-sm text-pink-700">{message}</p> : null}
      <div className="mt-8 space-y-4">
        {stays.length === 0 ? <p className="text-muted">No matching reservations.</p> : null}
        {stays.map((stay) => (
          <article key={stay.id} className="border border-earth-700/12 bg-ivory-100/50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-earth-700">
              {stay.reference} · {stay.status}
            </p>
            <p className="mt-2 font-serif text-2xl">
              {formatDisplayDate(stay.checkIn)} → {formatDisplayDate(stay.checkOut)}
            </p>
            <p className="mt-1 text-sm">
              {stay.guest.name} · {stay.guest.email} · {stay.party.adults} adults, {stay.party.children} children
            </p>
            <p className="mt-2 text-sm">
              Snapshot total {formatInr(stay.priceSnapshot.totalPaise)} · due now{" "}
              {formatInr(stay.priceSnapshot.amountDueNowPaise)} · balance {formatInr(stay.priceSnapshot.balanceDuePaise)}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">{stay.policySnapshot.stayTermsSummary}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {stay.status === "awaiting_payment" || stay.status === "held" ? (
                <span className="text-muted">Offline payments: owner records under Payments → Record offline payment.</span>
              ) : null}
              {stay.status === "confirmed" || stay.status === "awaiting_payment" ? (
                <button type="button" className="text-pink-700 underline" onClick={() => cancelStay(stay.id)}>
                  Cancel reservation
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
