"use client";

import { adminAction, useAdminData } from "@/components/admin/useAdminData";
import { formatInr } from "@/lib/time/kolkata";

export default function AdminPricingPage() {
  const { data, error, reload } = useAdminData();
  if (error) return <main className="p-8 text-pink-400">{error}</main>;
  if (!data) return <main className="p-8">Loading rates…</main>;

  return (
    <main className="p-8">
      <h1 className="font-serif text-4xl">Stay rates</h1>
      <p className="mt-2 text-sm text-muted">Changing a rate does not alter previously accepted booking snapshots.</p>
      <div className="mt-8 space-y-4">
        {data.rateRules.map((rule) => (
          <article key={rule.id} className="border border-earth-700/15 p-4">
            <p className="font-medium">{rule.name}</p>
            <p className="text-sm">{formatInr(rule.nightlyPaise)} · priority {rule.priority}</p>
            <p className="text-xs text-muted">{rule.awaitingOwnerApproval ? "Awaiting owner approval" : "Published"}</p>
          </article>
        ))}
      </div>
      <button
        type="button"
        className="mt-8 bg-forest-900 px-4 py-2 text-xs uppercase tracking-[0.16em] text-ivory-50"
        onClick={async () => {
          const name = window.prompt("Rate name");
          const rupees = Number(window.prompt("Nightly INR for whole estate"));
          if (!name || !Number.isFinite(rupees)) return;
          await adminAction("rate.upsert", { name, nightlyPaise: Math.round(rupees * 100), priority: 5, awaitingOwnerApproval: true });
          reload();
        }}
      >
        Add rate rule
      </button>
    </main>
  );
}
