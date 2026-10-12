"use client";

import { useMemo, useState } from "react";
import { OfflinePaymentForm } from "@/components/admin/OfflinePaymentForm";
import { adminAction, useAdminData } from "@/components/admin/useAdminData";
import { formatInr } from "@/lib/time/kolkata";

export function AdminPaymentsPanel() {
  const { data, error, reload } = useAdminData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const payments = useMemo(() => {
    if (!data) return [];
    return data.payments.filter((payment) => {
      if (statusFilter !== "all" && payment.status !== statusFilter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const stay = data.stays.find((s) => s.id === payment.sourceId);
      const enquiry = data.enquiries.find((e) => e.id === payment.sourceId);
      return (
        payment.id.toLowerCase().includes(q) ||
        (payment.razorpayOrderId ?? "").toLowerCase().includes(q) ||
        (payment.razorpayPaymentId ?? "").toLowerCase().includes(q) ||
        (stay?.reference ?? "").toLowerCase().includes(q) ||
        (enquiry?.reference ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, query, statusFilter]);

  if (error) return <main className="p-8 text-pink-700">{error}</main>;
  if (!data) return <main className="p-8">Loading payments…</main>;

  const openExceptions = data.exceptions.filter((item) => !item.resolved);

  return (
    <main className="p-6 md:p-8">
      <h1 className="font-serif text-4xl">Payments and exceptions</h1>
      <p className="mt-2 text-sm text-muted">Gateway amounts are stored in paise. Only verified captures confirm bookings.</p>

      {data.session?.role === "owner" ? <OfflinePaymentForm onRecorded={reload} /> : null}

      <section className="mt-8">
        <h2 className="font-serif text-2xl">Exception queue ({openExceptions.length})</h2>
        {openExceptions.length === 0 ? <p className="mt-3 text-muted">No open reconciliation exceptions.</p> : null}
        {openExceptions.map((item) => (
          <article key={item.id} className="mt-3 border border-pink-400/30 bg-ivory-100/40 p-4 text-sm">
            <p className="font-medium">{item.kind}</p>
            <p className="mt-1">{item.message}</p>
            <p className="mt-1 text-xs text-muted">
              Payment {item.paymentId} · source {item.sourceId ?? "—"}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="flex-1 border border-earth-700/20 px-3 py-2 text-sm"
            placeholder="Search reference, order id, payment id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="border border-earth-700/20 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="authorized">Authorized</option>
            <option value="captured">Captured</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially refunded</option>
          </select>
        </div>
        <h2 className="mt-6 font-serif text-2xl">Ledger</h2>
        {payments.length === 0 ? <p className="mt-3 text-muted">No matching payments.</p> : null}
        {payments.map((payment) => {
          const stay = data.stays.find((s) => s.id === payment.sourceId);
          const enquiry = data.enquiries.find((e) => e.id === payment.sourceId);
          const relatedNotifications = data.notifications.filter(
            (n) => n.idempotencyKey?.includes(payment.sourceId) || n.body.includes(stay?.reference ?? enquiry?.reference ?? ""),
          );
          return (
            <article key={payment.id} className="mt-3 border border-earth-700/15 p-4 text-sm">
              <p className="font-medium">
                {stay?.reference ?? enquiry?.reference ?? payment.sourceId} · {payment.purpose} · {payment.status}
              </p>
              <p>
                {formatInr(payment.amountPaise)} {payment.currency} · {payment.method}
              </p>
              <p className="text-muted">
                Order {payment.razorpayOrderId ?? "—"} · Payment {payment.razorpayPaymentId ?? payment.offlineReference ?? "—"}
              </p>
              {relatedNotifications.length > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  Notifications: {relatedNotifications.map((n) => `${n.type}:${n.status}`).join(", ")}
                </p>
              ) : null}
              {payment.status === "captured" && data.session?.role === "owner" ? (
                <button
                  type="button"
                  className="mt-2 underline"
                  onClick={async () => {
                    const reason = window.prompt("Refund reason (audit trail)");
                    if (!reason) return;
                    const gatewayReference = window.prompt("Gateway refund id (optional)") ?? undefined;
                    await adminAction("payment.refund", {
                      paymentId: payment.id,
                      amountPaise: payment.amountPaise,
                      reason,
                      gatewayReference,
                    });
                    reload();
                  }}
                >
                  Record refund (owner)
                </button>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Email delivery</h2>
        {data.notifications.slice(0, 40).map((item) => (
          <article key={item.id} className="mt-3 border border-earth-700/15 p-4 text-sm">
            <p>
              {item.status} · {item.type} · {item.toEmail}
            </p>
            {item.lastError ? <p className="text-pink-700">{item.lastError}</p> : null}
            {item.status === "failed" ? (
              <button type="button" className="mt-2 underline" onClick={() => adminAction("notification.retry", { id: item.id }).then(reload)}>
                Retry send
              </button>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
