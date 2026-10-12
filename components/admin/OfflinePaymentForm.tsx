"use client";

import { useState } from "react";
import { adminAction } from "@/components/admin/useAdminData";

const METHODS = [
  { value: "offline_bank", label: "Bank transfer" },
  { value: "offline_upi", label: "UPI" },
  { value: "offline_cash", label: "Cash" },
  { value: "offline_other", label: "Other" },
] as const;

export function OfflinePaymentForm({ onRecorded }: { onRecorded: () => void }) {
  const [purpose, setPurpose] = useState<"stay" | "event">("stay");
  const [bookingReference, setBookingReference] = useState("");
  const [amountInr, setAmountInr] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("offline_bank");
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const inr = Number(amountInr.replace(/,/g, ""));
      if (!Number.isFinite(inr) || inr <= 0) throw new Error("Enter a valid INR amount.");
      const amountPaise = Math.round(inr * 100);
      const result = await adminAction("payment.offline", {
        purpose,
        bookingReference: bookingReference.trim().toUpperCase(),
        amountPaise,
        method,
        reference: reference.trim(),
        receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
        internalNotes: internalNotes.trim() || undefined,
      });
      if (result.partial) {
        setMessage("Partial payment recorded. Booking remains unconfirmed until the full amount due is received.");
      } else if (result.confirmed) {
        setMessage("Payment recorded and booking confirmed after inventory validation.");
      } else if (result.exception) {
        setMessage(`Payment recorded but not confirmed: ${result.exception.message}`);
      } else {
        setMessage("Payment recorded.");
      }
      onRecorded();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to record payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 border border-forest-800/15 bg-ivory-100/50 p-5 text-sm">
      <h3 className="font-serif text-xl">Record offline payment (owner)</h3>
      <p className="mt-1 text-muted">
        Confirms only when the amount matches the amount due, the hold is valid, and inventory checks pass.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-earth-700">Type</span>
          <select className="mt-1 w-full border border-earth-700/20 px-2 py-2" value={purpose} onChange={(e) => setPurpose(e.target.value as "stay" | "event")}>
            <option value="stay">Stay reservation</option>
            <option value="event">Event deposit</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-earth-700">Booking reference</span>
          <input
            required
            className="mt-1 w-full border border-earth-700/20 px-2 py-2"
            placeholder="VF-… or EV-…"
            value={bookingReference}
            onChange={(e) => setBookingReference(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-earth-700">Amount received (INR)</span>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full border border-earth-700/20 px-2 py-2"
            value={amountInr}
            onChange={(e) => setAmountInr(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-earth-700">Payment method</span>
          <select className="mt-1 w-full border border-earth-700/20 px-2 py-2" value={method} onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number]["value"])}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs uppercase tracking-wider text-earth-700">Transaction / reference number</span>
          <input
            required
            className="mt-1 w-full border border-earth-700/20 px-2 py-2"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-earth-700">Date & time received</span>
          <input
            type="datetime-local"
            className="mt-1 w-full border border-earth-700/20 px-2 py-2"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs uppercase tracking-wider text-earth-700">Internal notes</span>
          <textarea
            className="mt-1 w-full border border-earth-700/20 px-2 py-2"
            rows={2}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
          />
        </label>
      </div>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 bg-forest-900 px-4 py-2 text-xs uppercase tracking-wider text-ivory-50 disabled:opacity-60"
      >
        {busy ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}
