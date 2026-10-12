"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminAction } from "@/components/admin/useAdminData";
import type { CalendarEntry, CalendarEntryKind } from "@/lib/admin/calendar-entries";
import { CALENDAR_MONTHS, monthMatrix, shiftMonth } from "@/lib/booking/calendar-utils";
import { addDays, formatDisplayDate, todayInKolkata } from "@/lib/time/kolkata";

const KIND_STYLE: Record<CalendarEntryKind, string> = {
  stay: "bg-forest-800 text-ivory-50",
  event: "bg-pink-700/90 text-ivory-50",
  hold: "bg-gold-400/90 text-forest-950",
  maintenance: "bg-earth-700 text-ivory-50",
  admin: "bg-earth-900 text-ivory-50",
};

export function MasterCalendar() {
  const today = todayInKolkata();
  const initial = new Date(`${today}T00:00:00Z`);
  const [cursor, setCursor] = useState({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() });
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [filters, setFilters] = useState<Record<CalendarEntryKind, boolean>>({
    stay: true,
    event: true,
    hold: true,
    maintenance: true,
    admin: true,
  });
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState({
    kind: "maintenance",
    startDate: "",
    endDate: "",
    reason: "",
    internalNotes: "",
  });

  const from = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const to = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const load = useCallback(() => {
    fetch(`/api/admin/calendar?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => setEntries([]));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => entries.filter((entry) => filters[entry.kind]),
    [entries, filters],
  );

  const cells = monthMatrix(cursor.year, cursor.month);
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of filtered) {
      let day = entry.startDate;
      while (day <= entry.endDate) {
        const list = map.get(day) ?? [];
        list.push(entry);
        map.set(day, list);
        day = addDays(day, 1);
      }
    }
    return map;
  }, [filtered]);

  async function addBlock() {
    setMessage(null);
    try {
      await adminAction("calendar.block", blockForm);
      setBlockForm({ kind: "maintenance", startDate: "", endDate: "", reason: "", internalNotes: "" });
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to save closure");
    }
  }

  async function removeBlock(blockId: string) {
    if (!window.confirm("Remove this closure? An audit entry will be recorded.")) return;
    try {
      await adminAction("calendar.block.remove", { blockId });
      setSelected(null);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to remove block");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Master calendar</h1>
          <p className="mt-1 text-sm text-muted">Whole-property inventory · Asia/Kolkata</p>
        </div>
        <div className="flex gap-2 text-sm">
          <button type="button" className={view === "month" ? "underline" : ""} onClick={() => setView("month")}>
            Month
          </button>
          <button type="button" className={view === "agenda" ? "underline" : ""} onClick={() => setView("agenda")}>
            Agenda
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wider">
        {(Object.keys(filters) as CalendarEntryKind[]).map((kind) => (
          <label key={kind} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters[kind]}
              onChange={(e) => setFilters({ ...filters, [kind]: e.target.checked })}
            />
            <span className={`rounded-sm px-2 py-0.5 ${KIND_STYLE[kind]}`}>{kind}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="text-sm underline" onClick={() => setCursor(shiftMonth(cursor, -1))}>
          Previous
        </button>
        <p className="font-serif text-2xl">
          {CALENDAR_MONTHS[cursor.month]} {cursor.year}
        </p>
        <button type="button" className="text-sm underline" onClick={() => setCursor(shiftMonth(cursor, 1))}>
          Next
        </button>
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-1 text-xs">
          {cells.map((date, index) => {
            if (!date) return <div key={`e-${index}`} />;
            const dayEntries = byDate.get(date) ?? [];
            return (
              <button
                key={date}
                type="button"
                onClick={() => dayEntries[0] && setSelected(dayEntries[0])}
                className="min-h-24 border border-earth-700/10 bg-ivory-100/50 p-1 text-left hover:border-forest-700/40"
              >
                <span className="font-medium">{date.slice(8)}</span>
                <div className="mt-1 space-y-0.5">
                  {dayEntries.slice(0, 3).map((entry) => (
                    <span key={entry.id} className={`block truncate rounded px-1 py-0.5 ${KIND_STYLE[entry.kind]}`}>
                      {entry.reference}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="divide-y divide-earth-700/10 border border-earth-700/10">
          {filtered.length === 0 ? (
            <li className="p-6 text-sm text-muted">No entries in this range.</li>
          ) : (
            filtered.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-ivory-100 sm:flex-row sm:items-center sm:justify-between"
                  onClick={() => setSelected(entry)}
                >
                  <span className={`w-fit rounded px-2 py-0.5 text-xs uppercase ${KIND_STYLE[entry.kind]}`}>
                    {entry.kind}
                  </span>
                  <span className="font-medium">
                    {formatDisplayDate(entry.startDate)} – {formatDisplayDate(entry.endDate)}
                  </span>
                  <span className="text-sm">
                    {entry.reference} · {entry.title}
                  </span>
                  <span className="text-sm text-muted">{entry.status}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {selected ? (
        <aside className="border border-earth-700/15 bg-ivory-100 p-5">
          <p className="text-xs uppercase tracking-[0.16em]">{selected.kind} · {selected.status}</p>
          <h2 className="mt-1 font-serif text-2xl">{selected.reference}</h2>
          <p className="mt-2 text-sm">
            {formatDisplayDate(selected.startDate)} → {formatDisplayDate(selected.endDate)}
          </p>
          <p className="text-sm">{selected.title}</p>
          <p className="text-sm text-muted">{selected.subtitle}</p>
          {selected.expiresAt ? (
            <p className="mt-2 text-xs text-muted">Hold expires {new Date(selected.expiresAt).toLocaleString("en-IN")}</p>
          ) : null}
          {selected.blockId && (selected.kind === "maintenance" || selected.kind === "admin") ? (
            <button type="button" className="mt-4 text-sm text-pink-700 underline" onClick={() => removeBlock(selected.blockId!)}>
              Remove closure
            </button>
          ) : null}
        </aside>
      ) : null}

      <div className="grid max-w-xl gap-3 border border-earth-700/15 p-5">
        <h3 className="font-serif text-xl">Add closure</h3>
        <select className="border px-3 py-2" value={blockForm.kind} onChange={(e) => setBlockForm({ ...blockForm, kind: e.target.value })}>
          <option value="maintenance">Maintenance</option>
          <option value="admin">Administrative block</option>
        </select>
        <input type="date" className="border px-3 py-2" value={blockForm.startDate} onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value })} />
        <input type="date" className="border px-3 py-2" value={blockForm.endDate} onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })} />
        <input className="border px-3 py-2" placeholder="Reason (required)" value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
        <textarea className="border px-3 py-2" placeholder="Internal notes" value={blockForm.internalNotes} onChange={(e) => setBlockForm({ ...blockForm, internalNotes: e.target.value })} />
        {message ? <p className="text-sm text-pink-700">{message}</p> : null}
        <button type="button" onClick={addBlock} className="bg-forest-900 py-2 text-xs uppercase tracking-[0.16em] text-ivory-50">
          Save closure
        </button>
      </div>
    </div>
  );
}
