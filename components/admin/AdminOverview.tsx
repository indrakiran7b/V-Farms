"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatInr } from "@/lib/time/kolkata";

type Summary = {
  arrivals: number;
  departures: number;
  activeStays: number;
  upcomingEvents: number;
  pendingEnquiries: number;
  pendingQuotes: number;
  quotesAwaiting: number;
  paymentExceptions: number;
  holds: number;
  closures: number;
  outstandingBalancePaise: number;
};

export function AdminOverview() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/summary")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to load summary");
        setSummary(data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="p-8 text-pink-700">{error}</p>;
  if (!summary) return <p className="p-8 text-muted">Loading overview…</p>;

  const cards: Array<[string, string, string]> = [
    ["Arrivals today", String(summary.arrivals), "/admin/bookings"],
    ["Departures today", String(summary.departures), "/admin/bookings"],
    ["Active stays", String(summary.activeStays), "/admin/bookings"],
    ["Upcoming events", String(summary.upcomingEvents), "/admin/events"],
    ["Pending enquiries", String(summary.pendingEnquiries), "/admin/events"],
    ["Quotes awaiting response", String(summary.quotesAwaiting), "/admin/events"],
    ["Active holds", String(summary.holds), "/admin/calendar"],
    ["Closures on calendar", String(summary.closures), "/admin/calendar"],
    ["Open payment exceptions", String(summary.paymentExceptions), "/admin/payments"],
    ["Outstanding stay balance", formatInr(summary.outstandingBalancePaise), "/admin/payments"],
  ];

  return (
    <main className="p-6 md:p-8">
      <h1 className="font-serif text-4xl">Operations overview</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
        Metrics are derived from the live property ledger. Empty counts are real — not placeholders.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, href]) => (
          <Link
            key={label}
            href={href}
            className="border border-earth-700/12 bg-ivory-100/60 p-5 transition hover:border-forest-700/30"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-earth-700">{label}</p>
            <p className="mt-3 font-serif text-3xl text-forest-950">{value}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
