"use client";

import { useAdminData } from "@/components/admin/useAdminData";

export default function AdminAuditPage() {
  const { data, error } = useAdminData();
  if (error) return <main className="p-8 text-pink-400">{error}</main>;
  if (!data) return <main className="p-8">Loading audit trail…</main>;
  return (
    <main className="p-8">
      <h1 className="font-serif text-4xl">Audit trail</h1>
      <ol className="mt-8 space-y-3 text-sm">
        {data.audit.map((entry) => (
          <li key={entry.id} className="border border-earth-700/15 p-4">
            <p className="font-medium">{entry.action}</p>
            <p className="text-muted">
              {entry.actorRole} · {entry.entityType} {entry.entityId} · {new Date(entry.createdAt).toLocaleString("en-IN")}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
