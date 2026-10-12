"use client";

import { adminAction, useAdminData } from "@/components/admin/useAdminData";

export default function AdminSettingsPage() {
  const { data, error, reload } = useAdminData();
  if (error) return <main className="p-8 text-pink-400">{error}</main>;
  if (!data) return <main className="p-8">Loading settings…</main>;
  const s = data.settings;

  return (
    <main className="p-8">
      <h1 className="font-serif text-4xl">Property settings</h1>
      <form
        className="mt-8 grid max-w-xl gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await adminAction("settings.update", {
            maxGuests: Number(form.get("maxGuests")),
            maxAdults: Number(form.get("maxAdults")),
            maxChildren: Number(form.get("maxChildren")),
            minNights: Number(form.get("minNights")),
            holdMinutes: Number(form.get("holdMinutes")),
            checkInTime: String(form.get("checkInTime")),
            checkOutTime: String(form.get("checkOutTime")),
            turnoverSameDayAllowed: form.get("turnover") === "on",
            contactEmail: String(form.get("contactEmail") || "") || null,
            contactPhone: String(form.get("contactPhone") || "") || null,
          });
          reload();
        }}
      >
        <label className="text-sm">Max guests <input name="maxGuests" type="number" defaultValue={s.maxGuests} className="mt-1 w-full border px-3 py-2" /></label>
        <label className="text-sm">Max adults <input name="maxAdults" type="number" defaultValue={s.maxAdults} className="mt-1 w-full border px-3 py-2" /></label>
        <label className="text-sm">Max children <input name="maxChildren" type="number" defaultValue={s.maxChildren} className="mt-1 w-full border px-3 py-2" /></label>
        <label className="text-sm">Min nights <input name="minNights" type="number" defaultValue={s.minNights} className="mt-1 w-full border px-3 py-2" /></label>
        <label className="text-sm">Hold minutes <input name="holdMinutes" type="number" defaultValue={s.holdMinutes} className="mt-1 w-full border px-3 py-2" /></label>
        <label className="text-sm">Check-in <input name="checkInTime" defaultValue={s.checkInTime} className="mt-1 w-full border px-3 py-2" /></label>
        <label className="text-sm">Check-out <input name="checkOutTime" defaultValue={s.checkOutTime} className="mt-1 w-full border px-3 py-2" /></label>
        <label className="text-sm">Contact email <input name="contactEmail" defaultValue={s.contactEmail ?? ""} className="mt-1 w-full border px-3 py-2" /></label>
        <label className="text-sm">Contact phone <input name="contactPhone" defaultValue={s.contactPhone ?? ""} className="mt-1 w-full border px-3 py-2" /></label>
        <label className="flex gap-2 text-sm"><input name="turnover" type="checkbox" defaultChecked={s.turnoverSameDayAllowed} /> Allow same-day stay turnover</label>
        <button className="bg-forest-900 py-2 text-xs uppercase tracking-[0.16em] text-ivory-50">Save settings</button>
      </form>
    </main>
  );
}
