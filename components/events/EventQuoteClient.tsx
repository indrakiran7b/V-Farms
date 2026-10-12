"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDisplayDate, formatInr } from "@/lib/time/kolkata";

type QuoteView = {
  quote: {
    version: number;
    status: string;
    overnightRoomsStatement: string;
    inclusions: string[];
    exclusions: string[];
    lines: Array<{ id: string; label: string; amountPaise: number; inclusion: boolean }>;
    depositPaise: number;
    balancePaise: number;
    securityDepositPaise: number;
    totalPaise: number;
    cancellationTerms: string;
    expiresAt: string;
    policySnapshot: { cancellationSummary: string; eventTermsSummary: string };
  };
  enquiry: {
    id: string;
    reference: string;
    customerAccessToken?: string;
    eventType: string;
    startDate: string;
    endDate: string;
    expectedAttendance: number;
    status: string;
  };
};

export function EventQuoteClient({ token }: { token: string }) {
  const router = useRouter();
  const [data, setData] = useState<QuoteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events/quote/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Quotation unavailable");
        setData(json);
      })
      .catch((err: Error) => setError(err.message));
  }, [token]);

  async function respond(decision: "accept" | "decline") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/events/quote/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unable to update quotation");
      if (decision === "decline") {
        setMessage("You declined this quotation. Contact V-Farms if you would like to revise dates.");
        setData((current) =>
          current
            ? { ...current, quote: { ...current.quote, status: "declined" }, enquiry: { ...current.enquiry, status: "declined" } }
            : current,
        );
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              quote: { ...current.quote, status: "accepted" },
              enquiry: { ...current.enquiry, status: json.enquiry.status, id: json.enquiry.id },
            }
          : current,
      );
      setMessage("Availability confirmed and dates held. Pay the deposit below to proceed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to respond");
    } finally {
      setBusy(false);
    }
  }

  async function payDeposit(enquiryId: string) {
    setPayError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "event", sourceId: enquiryId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Payment could not start");
      if (json.mode === "unconfigured") {
        setPayError(json.error);
        return;
      }
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({
        key: json.keyId,
        amount: json.amount,
        currency: "INR",
        name: "V-Farms",
        order_id: json.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const result = await verify.json();
          router.push(
            `/booking/confirmation?token=${encodeURIComponent(result.token ?? data?.enquiry.customerAccessToken ?? "")}&status=${result.status ?? "pending"}`,
          );
        },
      });
      checkout.open();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-pink-700">{error}</p>;
  if (!data) return <p className="text-muted">Loading quotation…</p>;

  const { quote, enquiry } = data;
  const expired = quote.status === "expired";
  const canRespond = quote.status === "sent" && !expired;
  const canPay = enquiry.status === "awaiting_deposit" && quote.status === "accepted";

  return (
    <div className="space-y-8">
      <header className="border-b border-earth-700/10 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-earth-700">
          {enquiry.reference} · quotation v{quote.version}
        </p>
        <h1 className="mt-2 font-serif text-4xl text-forest-950">{enquiry.eventType}</h1>
        <p className="mt-3 text-sm leading-7 text-earth-800">
          {formatDisplayDate(enquiry.startDate)}
          {enquiry.endDate !== enquiry.startDate ? ` — ${formatDisplayDate(enquiry.endDate)}` : ""} ·{" "}
          {enquiry.expectedAttendance} guests · entire estate
        </p>
        <p className="mt-2 text-sm text-muted">Expires {new Date(quote.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
      </header>

      <p className="rounded-sm border border-gold-400/30 bg-ivory-50 px-4 py-3 text-sm leading-7">
        Accepting does not guarantee the date until availability is rechecked and a valid property hold is acquired.
        {quote.overnightRoomsStatement}
      </p>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl">Itemized charges</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {quote.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-4">
                <span>{line.label}</span>
                <span>{formatInr(line.amountPaise)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between border-t border-earth-700/15 pt-3 font-medium">
            <span>Total</span>
            <span>{formatInr(quote.totalPaise)}</span>
          </p>
          <p className="mt-2 flex justify-between text-sm">
            <span>Deposit due now</span>
            <span>{formatInr(quote.depositPaise)}</span>
          </p>
          <p className="flex justify-between text-sm text-muted">
            <span>Balance before event</span>
            <span>{formatInr(quote.balancePaise)}</span>
          </p>
          {quote.securityDepositPaise > 0 ? (
            <p className="flex justify-between text-sm text-muted">
              <span>Security deposit (refundable)</span>
              <span>{formatInr(quote.securityDepositPaise)}</span>
            </p>
          ) : null}
        </div>
        <div>
          <h2 className="font-serif text-2xl">Inclusions</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-7">
            {quote.inclusions.length ? quote.inclusions.map((item) => <li key={item}>{item}</li>) : <li>See line items</li>}
          </ul>
          {quote.exclusions.length ? (
            <>
              <h3 className="mt-6 font-serif text-xl">Exclusions</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-muted">
                {quote.exclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>

      <section className="text-sm leading-7 text-earth-800">
        <h2 className="font-serif text-2xl text-forest-950">Terms</h2>
        <p className="mt-3">{quote.cancellationTerms}</p>
        <p className="mt-3">{quote.policySnapshot.cancellationSummary}</p>
        <p className="mt-2">{quote.policySnapshot.eventTermsSummary}</p>
        <Link href="/cancellation-policy" className="mt-2 inline-block underline">
          Full cancellation draft
        </Link>
      </section>

      {message ? <p className="text-sm text-pink-700">{message}</p> : null}
      {payError ? <p className="text-sm text-pink-700">{payError}</p> : null}

      {canRespond ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("accept")}
            className="bg-forest-900 px-6 py-3 text-xs uppercase tracking-[0.18em] text-ivory-50 disabled:opacity-40"
          >
            Accept quotation
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => respond("decline")}
            className="border border-earth-700/30 px-6 py-3 text-xs uppercase tracking-[0.18em]"
          >
            Decline
          </button>
        </div>
      ) : null}

      {canPay ? (
        <div>
          <p className="mb-3 text-sm text-forest-800">Dates held — pay the deposit to confirm (server-verified).</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => payDeposit(enquiry.id)}
            className="bg-forest-900 px-6 py-3 text-xs uppercase tracking-[0.18em] text-ivory-50"
          >
            Pay deposit via Razorpay
          </button>
        </div>
      ) : null}

      {expired ? <p className="text-sm text-pink-700">This quotation has expired. Contact V-Farms for a revised quote.</p> : null}
    </div>
  );
}

function loadRazorpay(): Promise<new (options: Record<string, unknown>) => { open: () => void }> {
  return new Promise((resolve, reject) => {
    const ctor = (window as unknown as { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
    if (ctor) {
      resolve(ctor);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      const loaded = (window as unknown as { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (loaded) resolve(loaded);
      else reject(new Error("Razorpay failed to load"));
    };
    script.onerror = () => reject(new Error("Razorpay failed to load"));
    document.body.appendChild(script);
  });
}
