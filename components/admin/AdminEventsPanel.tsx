"use client";

import { useMemo, useState } from "react";
import { adminAction, useAdminData } from "@/components/admin/useAdminData";
import { addDays, formatDisplayDate, formatInr, todayInKolkata } from "@/lib/time/kolkata";

export function AdminEventsPanel() {
  const { data, error, reload } = useAdminData();
  const [message, setMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quoteDraft, setQuoteDraft] = useState({
    totalInr: "",
    depositInr: "",
    overnight: false,
    expiresAt: `${addDays(todayInKolkata(), 7)}T18:00:00.000Z`,
    cancellationTerms: "",
    internalNotes: "",
  });

  const enquiries = useMemo(() => {
    if (!data) return [];
    return data.enquiries.filter((item) => statusFilter === "all" || item.status === statusFilter);
  }, [data, statusFilter]);

  const selected = data?.enquiries.find((item) => item.id === selectedId) ?? enquiries[0] ?? null;
  const selectedQuote = selected?.quoteId ? data?.quotes.find((q) => q.id === selected.quoteId) : undefined;
  const quoteHistory = selected
    ? (data?.quotes.filter((q) => q.enquiryId === selected.id).sort((a, b) => b.version - a.version) ?? [])
    : [];

  async function markReview(declined: boolean) {
    if (!selected) return;
    const declineReason = declined ? window.prompt("Decline reason for audit trail") ?? "" : undefined;
    try {
      await adminAction("enquiry.review", {
        enquiryId: selected.id,
        status: declined ? "declined" : "review",
        internalNotes: quoteDraft.internalNotes,
        declineReason,
      });
      reload();
      setMessage(declined ? "Enquiry declined." : "Marked in review.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function sendQuote() {
    if (!selected) return;
    const total = Number(quoteDraft.totalInr);
    const deposit = Number(quoteDraft.depositInr);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(deposit) || deposit <= 0) {
      setMessage("Enter valid total and deposit amounts in INR.");
      return;
    }
    try {
      const result = await adminAction("quote.send", {
        enquiryId: selected.id,
        overnightRoomsIncluded: quoteDraft.overnight,
        inclusions: quoteDraft.overnight ? ["Overnight access to five guest rooms"] : ["Exclusive estate use"],
        exclusions: quoteDraft.overnight ? [] : ["Overnight access to the five guest rooms"],
        lines: [{ label: "Estate exclusive event use", amountPaise: Math.round(total * 100), inclusion: true }],
        depositPaise: Math.round(deposit * 100),
        expiresAt: quoteDraft.expiresAt,
        cancellationTerms: quoteDraft.cancellationTerms || undefined,
      });
      setMessage(`Quotation v${result.quote.version} sent. Secure link emailed when Resend is configured.`);
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to send quote");
    }
  }

  if (error) return <p className="text-pink-400">{error}</p>;
  if (!data) return <p>Loading events…</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-4xl">Event enquiries</h1>
          <select
            className="border px-2 py-1 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {[
              "enquiry",
              "review",
              "quote_sent",
              "awaiting_deposit",
              "confirmed",
              "declined",
              "expired",
              "cancelled",
            ].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-sm text-muted">Pending enquiries do not block the property calendar.</p>
        {message ? <p className="mt-2 text-sm text-forest-800">{message}</p> : null}
        <ul className="mt-6 max-h-[70vh] space-y-3 overflow-y-auto">
          {enquiries.map((enquiry) => (
            <li key={enquiry.id}>
              <button
                type="button"
                onClick={() => setSelectedId(enquiry.id)}
                className={`w-full border p-4 text-left ${selected?.id === enquiry.id ? "border-forest-800 bg-ivory-100" : "border-earth-700/15"}`}
              >
                <p className="text-xs uppercase tracking-[0.14em]">
                  {enquiry.reference} · {enquiry.status}
                </p>
                <p className="mt-1 font-serif text-xl">{enquiry.eventType}</p>
                <p className="text-sm text-muted">
                  {formatDisplayDate(enquiry.startDate)} – {formatDisplayDate(enquiry.endDate)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <article className="border border-earth-700/15 p-6">
          <p className="text-xs uppercase tracking-[0.16em]">{selected.reference}</p>
          <h2 className="mt-2 font-serif text-3xl">{selected.eventType}</h2>
          <p className="mt-2 text-sm">
            {formatDisplayDate(selected.startDate)} → {formatDisplayDate(selected.endDate)} · {selected.expectedAttendance}{" "}
            guests · {selected.preferredStartTime}–{selected.preferredEndTime}
          </p>
          <p className="mt-2 text-sm">
            {selected.organizer.name} · {selected.organizer.email} · {selected.organizer.phone}
          </p>
          <p className="mt-4 text-sm leading-7 whitespace-pre-wrap">{selected.additionalNotes || "—"}</p>
          <p className="mt-2 text-sm">Overnight rooms requested: {selected.accommodationRequested ? "yes" : "no"}</p>

          <label className="mt-6 block text-sm">
            Internal notes
            <textarea
              className="mt-1 w-full border px-3 py-2"
              rows={3}
              value={quoteDraft.internalNotes || selected.internalNotes}
              onChange={(e) => setQuoteDraft({ ...quoteDraft, internalNotes: e.target.value })}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="border px-3 py-2 text-xs uppercase" onClick={() => markReview(false)}>
              Mark in review
            </button>
            <button type="button" className="border px-3 py-2 text-xs uppercase text-pink-700" onClick={() => markReview(true)}>
              Decline enquiry
            </button>
          </div>

          <div className="mt-8 border-t pt-6">
            <h3 className="font-serif text-2xl">Issue quotation</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Total (INR)
                <input
                  className="mt-1 w-full border px-3 py-2"
                  value={quoteDraft.totalInr}
                  onChange={(e) => setQuoteDraft({ ...quoteDraft, totalInr: e.target.value })}
                />
              </label>
              <label className="text-sm">
                Deposit (INR)
                <input
                  className="mt-1 w-full border px-3 py-2"
                  value={quoteDraft.depositInr}
                  onChange={(e) => setQuoteDraft({ ...quoteDraft, depositInr: e.target.value })}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={quoteDraft.overnight}
                onChange={(e) => setQuoteDraft({ ...quoteDraft, overnight: e.target.checked })}
              />
              Include overnight access to five rooms in quote
            </label>
            <label className="mt-3 block text-sm">
              Expires (ISO)
              <input
                className="mt-1 w-full border px-3 py-2"
                value={quoteDraft.expiresAt}
                onChange={(e) => setQuoteDraft({ ...quoteDraft, expiresAt: e.target.value })}
              />
            </label>
            <label className="mt-3 block text-sm">
              Cancellation terms
              <textarea
                className="mt-1 w-full border px-3 py-2"
                rows={2}
                value={quoteDraft.cancellationTerms}
                onChange={(e) => setQuoteDraft({ ...quoteDraft, cancellationTerms: e.target.value })}
              />
            </label>
            <button type="button" onClick={sendQuote} className="mt-4 bg-forest-900 px-4 py-2 text-xs uppercase tracking-[0.16em] text-ivory-50">
              Create & send quote
            </button>
          </div>

          {selectedQuote ? (
            <div className="mt-8 border-t pt-6 text-sm">
              <p>
                Current quote v{selectedQuote.version}: {formatInr(selectedQuote.totalPaise)} · deposit{" "}
                {formatInr(selectedQuote.depositPaise)} · {selectedQuote.status}
              </p>
              <p className="mt-2 break-all text-xs text-muted">
                Customer link: /events/quote/{selectedQuote.accessToken}
              </p>
            </div>
          ) : null}

          {quoteHistory.length > 1 ? (
            <div className="mt-6">
              <h4 className="text-sm uppercase tracking-[0.14em] text-muted">Quote versions</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {quoteHistory.map((q) => (
                  <li key={q.id}>
                    v{q.version} · {q.status} · {formatInr(q.totalPaise)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 border-t pt-6">
            <h4 className="text-sm uppercase tracking-[0.14em] text-muted">Recent audit</h4>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {data.audit
                .filter((entry) => entry.entityId === selected.id || entry.entityId === selected.quoteId)
                .slice(0, 8)
                .map((entry) => (
                  <li key={entry.id}>
                    {entry.action} · {entry.createdAt.slice(0, 19)}
                  </li>
                ))}
            </ul>
          </div>
        </article>
      ) : null}
    </div>
  );
}
