"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CALENDAR_MONTHS,
  CALENDAR_WEEKDAYS,
  cursorFromIso,
  isInRange,
  monthMatrix,
  moveCalendarFocus,
  selectStayDate,
  shiftMonth,
} from "@/lib/booking/calendar-utils";
import { addDays, formatDisplayDate, formatInr, todayInKolkata } from "@/lib/time/kolkata";
import type { PriceSnapshot } from "@/lib/types";

type Day = { date: string; available: boolean };

type AvailabilitySettings = {
  minNights: number;
  maxNights: number;
  maxGuests: number;
  maxAdults: number;
  maxChildren: number;
  turnoverSameDayAllowed: boolean;
  capacityAwaitingOwnerApproval: boolean;
  publishedRatesAwaitingOwnerApproval: boolean;
  checkInTime: string;
  checkOutTime: string;
};

type Step = "dates" | "review" | "guest";

const emptySnapshot = (): PriceSnapshot => ({
  currency: "INR",
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
  generatedAt: new Date().toISOString(),
});

export function StayBookingExperience({ className = "" }: { className?: string }) {
  const router = useRouter();
  const today = todayInKolkata();
  const [cursor, setCursor] = useState(() => cursorFromIso(today));
  const [days, setDays] = useState<Day[]>([]);
  const [settings, setSettings] = useState<AvailabilitySettings | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [quote, setQuote] = useState<{
    available: boolean;
    snapshot: PriceSnapshot;
    unavailableNights?: string[];
    error?: string;
  } | null>(null);
  const [step, setStep] = useState<Step>("dates");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", policy: false });
  const [message, setMessage] = useState<string | null>(null);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const from = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-01`;
  const to = addDays(from, 62);

  useEffect(() => {
    fetch(`/api/availability?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((data) => {
        setDays(data.dates ?? []);
        setSettings(data.settings ?? null);
      })
      .catch(() => {
        setDays([]);
        setSettings(null);
      });
  }, [from, to]);

  const lookup = useMemo(() => new Map(days.map((day) => [day.date, day.available])), [days]);
  const cells = monthMatrix(cursor.year, cursor.month);

  const isSelectable = useCallback(
    (date: string) => {
      if (date < today) return false;
      if (lookup.get(date) === false) return false;
      return true;
    },
    [lookup, today],
  );

  const applySelection = useCallback(
    (next: { checkIn: string | null; checkOut: string | null }) => {
      setCheckIn(next.checkIn);
      setCheckOut(next.checkOut);
      setQuote(null);
      setStep("dates");
      setMessage(null);
    },
    [],
  );

  function selectDate(date: string) {
    applySelection(selectStayDate({ checkIn, checkOut }, date, isSelectable));
    setFocusedDate(date);
  }

  function syncFromField(field: "checkIn" | "checkOut", value: string) {
    if (!value) {
      if (field === "checkIn") applySelection({ checkIn: null, checkOut: null });
      else applySelection({ checkIn, checkOut: null });
      return;
    }
    if (!isSelectable(value) && field === "checkIn") {
      setMessage("That check-in date is unavailable or in the past.");
      return;
    }
    if (field === "checkIn") {
      applySelection({ checkIn: value, checkOut: checkOut && checkOut > value ? checkOut : null });
      setCursor(cursorFromIso(value));
      return;
    }
    if (!checkIn) {
      setMessage("Choose a check-in date first.");
      return;
    }
    if (value <= checkIn) {
      setMessage("Check-out must be after check-in.");
      return;
    }
    applySelection({ checkIn, checkOut: value });
  }

  async function checkAvailability() {
    if (!checkIn || !checkOut) {
      setMessage("Select both check-in and check-out dates.");
      return;
    }
    setChecking(true);
    setMessage(null);
    setQuote(null);
    try {
      const res = await fetch("/api/stays/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut, adults, children }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to price those dates.");
      setQuote(data);
      if (data.available) setStep("review");
      else setStep("dates");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to check availability.";
      setQuote({ available: false, snapshot: emptySnapshot(), error: msg });
      setMessage(msg);
    } finally {
      setChecking(false);
    }
  }

  async function reserve() {
    if (!quote?.available) {
      setMessage("Check availability for open dates before reserving.");
      setStep("dates");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stays/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn,
          checkOut,
          adults,
          children,
          guest: { name: form.name, email: form.email, phone: form.phone },
          policyAccepted: form.policy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to hold the estate.");
      router.push(`/booking?hold=${data.stay.id}&token=${encodeURIComponent(data.stay.customerAccessToken)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to hold the estate.");
    } finally {
      setBusy(false);
    }
  }

  function onGridKeyDown(event: React.KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    const nextFocus = moveCalendarFocus(
      cells,
      focusedDate ?? checkIn,
      event.key as "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown",
      today,
    );
    if (event.key === "Enter" || event.key === " ") {
      if (nextFocus) selectDate(nextFocus);
      return;
    }
    if (nextFocus) setFocusedDate(nextFocus);
  }

  const statusLabel = !checkIn || !checkOut
    ? "Select your dates"
    : quote?.available
      ? "Available — entire estate"
      : quote && !quote.available
        ? "Some selected dates are unavailable"
        : quote?.error
          ? "Validation required"
          : "Ready to check availability";

  return (
    <div className={className}>
      <ol className="mb-10 flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em] text-earth-700">
        {(
          [
            ["dates", "1 · Dates & guests"],
            ["review", "2 · Review & policies"],
            ["guest", "3 · Guest details"],
          ] as const
        ).map(([id, label]) => (
          <li
            key={id}
            className={
              step === id
                ? "border-b-2 border-forest-800 pb-1 text-forest-900"
                : "pb-1 text-muted"
            }
          >
            {label}
          </li>
        ))}
      </ol>

      {settings?.publishedRatesAwaitingOwnerApproval ? (
        <p className="mb-8 border border-gold-400/40 bg-ivory-50 px-4 py-3 text-sm leading-7 text-earth-800">
          Published tariffs and tax lines are awaiting owner approval. Amounts shown are development placeholders for
          testing the booking flow — not a live commercial offer until approved in admin.
        </p>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Check-in
                <input
                  type="date"
                  className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
                  value={checkIn ?? ""}
                  min={today}
                  onChange={(e) => syncFromField("checkIn", e.target.value)}
                />
              </label>
              <label className="text-sm">
                Check-out
                <input
                  type="date"
                  className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
                  value={checkOut ?? ""}
                  min={checkIn ? addDays(checkIn, 1) : today}
                  onChange={(e) => syncFromField("checkOut", e.target.value)}
                />
              </label>
            </div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Asia/Kolkata</p>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(shiftMonth(cursor, -1))}
              className="rounded-sm border border-earth-700/20 px-3 py-2 text-sm hover:border-forest-700"
            >
              Previous
            </button>
            <p className="font-serif text-2xl text-forest-950">
              {CALENDAR_MONTHS[cursor.month]} {cursor.year}
            </p>
            <button
              type="button"
              onClick={() => setCursor(shiftMonth(cursor, 1))}
              className="rounded-sm border border-earth-700/20 px-3 py-2 text-sm hover:border-forest-700"
            >
              Next
            </button>
          </div>

          <div
            ref={gridRef}
            role="grid"
            aria-label="Stay availability calendar"
            tabIndex={0}
            onKeyDown={onGridKeyDown}
            className="outline-none focus-visible:ring-2 focus-visible:ring-forest-700/40"
          >
            <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wider text-muted">
              {CALENDAR_WEEKDAYS.map((day) => (
                <div key={day} role="columnheader" className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, index) => {
                if (!date) return <div key={`e-${index}`} role="gridcell" aria-hidden="true" />;
                const disabled = !isSelectable(date);
                const selected = date === checkIn || date === checkOut;
                const inRange = isInRange(date, checkIn, checkOut);
                const isToday = date === today;
                const focused = focusedDate === date;
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    aria-label={`${formatDisplayDate(date)}${disabled ? ", unavailable" : ", available"}${isToday ? ", today" : ""}`}
                    aria-selected={selected || inRange}
                    aria-disabled={disabled}
                    disabled={disabled}
                    tabIndex={focused ? 0 : -1}
                    onFocus={() => setFocusedDate(date)}
                    onClick={() => selectDate(date)}
                    className={`min-h-12 border text-sm transition-colors ${
                      disabled
                        ? "cursor-not-allowed border-transparent bg-earth-700/5 text-muted/35 line-through"
                        : selected
                          ? "border-forest-800 bg-forest-800 text-ivory-50"
                          : inRange
                            ? "border-forest-700/25 bg-forest-800/10 text-forest-900"
                            : isToday
                              ? "border-gold-400/70 bg-ivory-50 text-forest-950"
                              : "border-earth-700/12 bg-ivory-50/80 hover:border-forest-700"
                    }`}
                  >
                    {date.slice(8)}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted">
            Unavailable nights are struck through. Confirmed stays, approved events, active holds and maintenance
            closures block the <strong className="font-normal text-forest-800">entire estate</strong>. Minimum stay:{" "}
            {settings?.minNights ?? "—"} night(s). Times: check-in {settings?.checkInTime ?? "—"}, check-out{" "}
            {settings?.checkOutTime ?? "—"}.
          </p>
        </div>

        <aside className="border border-earth-700/12 bg-ivory-100/90 p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-earth-700">Five distinct rooms · One exclusive booking</p>
          <h2 className="mt-2 font-serif text-3xl text-forest-950">Stay summary</h2>
          <p className="mt-2 text-sm font-medium text-forest-800" aria-live="polite">
            {statusLabel}
          </p>
          <p className="mt-3 text-sm leading-7 text-earth-800">
            {checkIn ? formatDisplayDate(checkIn) : "Check-in"} — {checkOut ? formatDisplayDate(checkOut) : "Check-out"}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="text-sm">
              Adults
              <input
                className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2"
                type="number"
                min={1}
                max={settings?.maxAdults ?? 99}
                value={adults}
                onChange={(event) => {
                  setAdults(Number(event.target.value));
                  setQuote(null);
                  setStep("dates");
                }}
              />
            </label>
            <label className="text-sm">
              Children
              <input
                className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2"
                type="number"
                min={0}
                max={settings?.maxChildren ?? 99}
                value={children}
                onChange={(event) => {
                  setChildren(Number(event.target.value));
                  setQuote(null);
                  setStep("dates");
                }}
              />
            </label>
          </div>
          {settings?.capacityAwaitingOwnerApproval ? (
            <p className="mt-2 text-xs leading-6 text-muted">
              Capacity limits are marked awaiting owner certification (max {settings.maxGuests} guests).
            </p>
          ) : null}

          {quote?.error ? (
            <div
              className="mt-5 border border-earth-700/15 bg-ivory-50 px-4 py-3 text-sm leading-7 text-earth-800"
              role="alert"
            >
              {quote.error}
            </div>
          ) : null}

          {quote && !quote.error && !quote.available ? (
            <div
              className="mt-5 border border-gold-400/45 bg-ivory-50 px-4 py-4 text-sm leading-7 text-earth-800"
              role="alert"
            >
              <p className="font-medium text-forest-900">Some selected dates are unavailable</p>
              <p className="mt-2">The following dates conflict with an existing reservation or hold:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {(quote.unavailableNights ?? []).map((date) => (
                  <li key={date}>{formatDisplayDate(date)}</li>
                ))}
              </ul>
              <p className="mt-3 text-earth-700">Please select different dates and check availability again.</p>
            </div>
          ) : null}

          {quote?.available && !quote.error ? (
            <div className="mt-5 space-y-2 border-t border-earth-700/10 pt-4 text-sm">
              <p className="text-forest-700">The whole property is available for your dates.</p>
              {quote.snapshot.nights.map((night) => (
                <p key={night.date} className="flex justify-between gap-4">
                  <span>{formatDisplayDate(night.date)}</span>
                  <span>{formatInr(night.nightlyPaise)}</span>
                </p>
              ))}
              {quote.snapshot.taxes.map((tax) => (
                <p key={tax.code} className="flex justify-between gap-4 text-muted">
                  <span>{tax.label}</span>
                  <span>{formatInr(tax.amountPaise)}</span>
                </p>
              ))}
              <p className="flex justify-between gap-4 border-t border-earth-700/15 pt-2 font-medium text-forest-950">
                <span>Total (whole property)</span>
                <span>{formatInr(quote.snapshot.totalPaise)}</span>
              </p>
              <p className="flex justify-between gap-4 text-earth-800">
                <span>Due now (deposit)</span>
                <span>{formatInr(quote.snapshot.amountDueNowPaise)}</span>
              </p>
              {quote.snapshot.notes.map((note) => (
                <p key={note} className="text-xs leading-6 text-muted">
                  {note}
                </p>
              ))}
            </div>
          ) : null}

          {step === "dates" ? (
            <button
              type="button"
              disabled={checking || !checkIn || !checkOut}
              onClick={checkAvailability}
              className="mt-6 w-full bg-forest-900 py-3.5 text-xs uppercase tracking-[0.18em] text-ivory-50 disabled:opacity-40"
            >
              {checking ? "Checking…" : "Check availability"}
            </button>
          ) : null}

          {step === "review" && quote?.available ? (
            <button
              type="button"
              onClick={() => setStep("guest")}
              className="mt-6 w-full border border-forest-800 py-3.5 text-xs uppercase tracking-[0.18em] text-forest-900"
            >
              Continue to guest details
            </button>
          ) : null}

          {step === "guest" && quote?.available ? (
            <div className="mt-6 space-y-3 border-t border-earth-700/10 pt-4">
              <label className="block text-sm">
                Full name
                <input
                  className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  type="email"
                  className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                Phone
                <input
                  className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  autoComplete="tel"
                />
              </label>
              <label className="flex items-start gap-2 text-sm leading-6">
                <input type="checkbox" checked={form.policy} onChange={(e) => setForm({ ...form, policy: e.target.checked })} />
                I accept that this reserves the entire V-Farms estate (all five rooms), not an individual room, and I
                have read the{" "}
                <Link href="/cancellation-policy" className="underline">
                  cancellation draft
                </Link>{" "}
                and{" "}
                <Link href="/terms" className="underline">
                  terms
                </Link>
                .
              </label>
              <button
                type="button"
                disabled={busy || !form.name || !form.email || !form.phone || !form.policy}
                onClick={reserve}
                className="w-full bg-forest-900 py-3.5 text-xs uppercase tracking-[0.18em] text-ivory-50 disabled:opacity-40"
              >
                {busy ? "Creating hold…" : "Reserve the entire resort"}
              </button>
            </div>
          ) : null}

          {message ? (
            <p className="mt-3 text-sm leading-7 text-earth-800" role="status">
              {message}
            </p>
          ) : null}
        </aside>
      </div>

      <section className="mt-16 border-t border-earth-700/10 pt-10">
        <h3 className="font-serif text-2xl text-forest-950">Policies & important information</h3>
        <ul className="mt-4 max-w-3xl space-y-3 text-sm leading-7 text-earth-800">
          <li>
            Every stay reserves the <strong className="font-normal text-forest-900">entire five-acre estate</strong> and
            all five guest rooms together. Individual rooms are never sold separately.
          </li>
          <li>
            A temporary hold expires if payment is not verified in time. Confirmation requires server-side payment
            verification — not a browser success message alone.
          </li>
          <li>
            Cancellation windows, security deposits and refund rules remain in draft until owner and legal approval. See{" "}
            <Link href="/cancellation-policy" className="underline">
              cancellation policy
            </Link>
            .
          </li>
          {settings?.turnoverSameDayAllowed ? (
            <li>Back-to-back stays may share a turnover day when the previous guest departs on another guest&apos;s arrival date.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
