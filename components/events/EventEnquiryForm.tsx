"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type EventConfig = {
  maxEventAttendance: number;
  eventCapacityAwaitingOwnerApproval: boolean;
  categories: Array<{ id: string; label: string; description: string }>;
  unpublishedCategoryCount: number;
};

export function EventEnquiryForm() {
  const router = useRouter();
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    eventType: "",
    startDate: "",
    endDate: "",
    expectedAttendance: 40,
    preferredStartTime: "10:00",
    preferredEndTime: "18:00",
    cateringNotes: "",
    decorationNotes: "",
    vendorNotes: "",
    setupNotes: "",
    accommodationRequested: false,
    additionalNotes: "",
    policyAccepted: false,
    privacyAccepted: false,
  });

  useEffect(() => {
    fetch("/api/events/config")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => setConfig(null));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/events/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizer: { name: form.name, email: form.email, phone: form.phone },
          eventType: form.eventType,
          startDate: form.startDate,
          endDate: form.endDate,
          expectedAttendance: form.expectedAttendance,
          preferredTiming: `${form.preferredStartTime} – ${form.preferredEndTime}`,
          preferredStartTime: form.preferredStartTime,
          preferredEndTime: form.preferredEndTime,
          cateringNotes: form.cateringNotes,
          decorationNotes: form.decorationNotes,
          vendorNotes: form.vendorNotes,
          setupNotes: form.setupNotes,
          accommodationRequested: form.accommodationRequested,
          additionalNotes: form.additionalNotes,
          policyAccepted: form.policyAccepted,
          privacyAccepted: form.privacyAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to send enquiry");
      router.push(`/booking/confirmation?token=${encodeURIComponent(data.enquiry.customerAccessToken)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send enquiry");
    } finally {
      setBusy(false);
    }
  }

  const categories = config?.categories ?? [];

  return (
    <form onSubmit={submit} id="enquire" className="mt-10 grid gap-5 rounded-sm border border-earth-700/10 bg-ivory-100/80 p-6 md:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-earth-700">Enquiry only — not a booking</p>
      {config?.eventCapacityAwaitingOwnerApproval ? (
        <p className="text-sm leading-7 text-muted">
          Attendance limits are awaiting owner certification (development cap: {config.maxEventAttendance} guests).
        </p>
      ) : null}
      {!categories.length && config?.unpublishedCategoryCount ? (
        <p className="text-sm leading-7 text-muted">
          Approved event categories are not published yet. Describe your event type below.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Organizer name *
          <input
            required
            autoComplete="name"
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </label>
        <label className="text-sm">
          Email *
          <input
            required
            type="email"
            autoComplete="email"
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Phone *
          <input
            required
            autoComplete="tel"
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </label>
      </div>

      <label className="text-sm">
        Event category *
        {categories.length ? (
          <select
            required
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form.eventType}
            onChange={(e) => update("eventType", e.target.value)}
          >
            <option value="">Select…</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.label}>
                {cat.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            required
            placeholder="Describe your event type"
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form.eventType}
            onChange={(e) => update("eventType", e.target.value)}
          />
        )}
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Start date *
          <input
            required
            type="date"
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form.startDate}
            onChange={(e) => update("startDate", e.target.value)}
          />
        </label>
        <label className="text-sm">
          End date *
          <input
            required
            type="date"
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form.endDate}
            onChange={(e) => update("endDate", e.target.value)}
          />
        </label>
        <label className="text-sm">
          Preferred start time *
          <input
            required
            type="time"
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form.preferredStartTime}
            onChange={(e) => update("preferredStartTime", e.target.value)}
          />
        </label>
        <label className="text-sm">
          Preferred end time *
          <input
            required
            type="time"
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form.preferredEndTime}
            onChange={(e) => update("preferredEndTime", e.target.value)}
          />
        </label>
      </div>

      <label className="text-sm">
        Expected attendees *
        <input
          type="number"
          min={1}
          max={config?.maxEventAttendance ?? 999}
          required
          className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
          value={form.expectedAttendance}
          onChange={(e) => update("expectedAttendance", Number(e.target.value))}
        />
      </label>

      {(["cateringNotes", "decorationNotes", "vendorNotes", "setupNotes", "additionalNotes"] as const).map((key) => (
        <label key={key} className="text-sm">
          {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
          <textarea
            rows={3}
            className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2.5"
            value={form[key]}
            onChange={(e) => update(key, e.target.value)}
          />
        </label>
      ))}

      <label className="flex items-start gap-2 text-sm leading-6">
        <input type="checkbox" checked={form.accommodationRequested} onChange={(e) => update("accommodationRequested", e.target.checked)} />
        Request overnight access to the five rooms (included only if the written quote says so).
      </label>
      <label className="flex items-start gap-2 text-sm leading-6">
        <input type="checkbox" required checked={form.policyAccepted} onChange={(e) => update("policyAccepted", e.target.checked)} />
        I understand this is an enquiry, not a confirmed event, and the entire estate is reserved only after an accepted quote, valid hold, and verified deposit.
      </label>
      <label className="flex items-start gap-2 text-sm leading-6">
        <input type="checkbox" required checked={form.privacyAccepted} onChange={(e) => update("privacyAccepted", e.target.checked)} />
        I agree to the{" "}
        <Link href="/privacy" className="underline">
          privacy policy
        </Link>{" "}
        for processing this request.
      </label>

      {message ? (
        <p className="text-sm text-pink-700" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="bg-forest-900 py-3.5 text-xs uppercase tracking-[0.18em] text-ivory-50 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Submit event enquiry"}
      </button>
    </form>
  );
}
