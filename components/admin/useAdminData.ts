"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminData } from "@/lib/admin/types";

export function useAdminData() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    fetch("/api/admin/data")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Unable to load admin data");
        setData(json);
      })
      .catch((err: Error) => setError(err.message));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

export async function adminAction(action: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Action failed");
  return json;
}
