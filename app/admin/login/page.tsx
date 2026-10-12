"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Login failed");
      return;
    }
    router.push("/admin");
    router.refresh();
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-forest-950 px-4 text-ivory-50">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border border-ivory-100/15 p-8">
        <p className="font-serif text-3xl">V-Farms staff</p>
        <label className="block text-sm">
          Email
          <input name="email" type="email" required className="mt-1 w-full bg-forest-900 px-3 py-2 text-ivory-50" />
        </label>
        <label className="block text-sm">
          Password
          <input name="password" type="password" required minLength={8} className="mt-1 w-full bg-forest-900 px-3 py-2 text-ivory-50" />
        </label>
        {error ? <p className="text-sm text-pink-300">{error}</p> : null}
        <button className="w-full bg-ivory-50 py-3 text-xs uppercase tracking-[0.18em] text-forest-950">Sign in</button>
      </form>
    </main>
  );
}
