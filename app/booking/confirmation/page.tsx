import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { getPublicBookingStatus } from "@/lib/data/store";
import { formatDisplayDate, formatInr } from "@/lib/time/kolkata";

export const metadata: Metadata = { title: "Booking status", alternates: { canonical: "/booking/confirmation" } };
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status: checkoutStatus } = await searchParams;
  const record = token ? getPublicBookingStatus(token) : null;
  const confirmed =
    record?.kind === "stay"
      ? record.status === "confirmed"
      : record?.kind === "event"
        ? record.status === "confirmed"
        : false;

  return (
    <PublicShell darkHeader>
      <PageIntro
        eyebrow="Status"
        title={confirmed ? "Reservation confirmed" : "Reservation status"}
        lede="This page reports verified state from the property ledger. A checkout redirect alone never confirms a booking."
      />
      <div className="mx-auto max-w-2xl px-5 py-16 md:px-8">
        {!token ? (
          <p className="leading-7">
            Open the secure link from your payment or hold email to view this reservation. Booking references alone are not
            sufficient to access guest details.
          </p>
        ) : !record ? (
          <p className="leading-7">
            No booking matches this secure link. If you just paid, wait a moment and refresh. Contact V-Farms with your payment
            id if the issue persists.
          </p>
        ) : record.kind === "stay" ? (
          <div className="space-y-3 leading-7">
            <p>Reference {record.reference}</p>
            <p>
              {formatDisplayDate(record.checkIn)} → {formatDisplayDate(record.checkOut)}
            </p>
            <p>Guest {record.guestName}</p>
            <p>
              Status: <strong>{record.status}</strong>
              {checkoutStatus === "exception" ? " — payment received; manual review may be required" : null}
            </p>
            <p>Amount due at checkout: {formatInr(record.amountDueNowPaise)}</p>
            <p>Total stay value: {formatInr(record.totalPaise)}</p>
            {record.balanceDuePaise > 0 ? <p>Outstanding balance: {formatInr(record.balanceDuePaise)}</p> : null}
            {record.payments.length > 0 ? (
              <ul className="text-sm text-muted">
                {record.payments.map((payment, index) => (
                  <li key={index}>
                    Payment {payment.status} · {formatInr(payment.amountPaise)} · {payment.method}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-sm text-muted">{record.policySummary}</p>
          </div>
        ) : (
          <div className="space-y-3 leading-7">
            <p>Reference {record.reference}</p>
            <p>{record.eventType}</p>
            <p>
              {formatDisplayDate(record.startDate)} → {formatDisplayDate(record.endDate)}
            </p>
            <p>Organizer {record.organizerName}</p>
            <p>
              Status: <strong>{record.status}</strong>
            </p>
            {record.depositPaise != null ? <p>Quoted deposit: {formatInr(record.depositPaise)}</p> : null}
            {record.balancePaise != null && record.balancePaise > 0 ? (
              <p>Balance after deposit: {formatInr(record.balancePaise)}</p>
            ) : null}
          </div>
        )}
        <Link href="/" className="mt-8 inline-block text-sm underline">
          Return home
        </Link>
      </div>
    </PublicShell>
  );
}
