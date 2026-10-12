"use client";

import { useState } from "react";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          company: data.get("company"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unable to send");
      setMessage("Message received. If email delivery is not yet configured, operations will see it in the admin notification queue.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="hidden">
        Company
        <input name="company" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="text-sm">
        Name
        <input required name="name" className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2" />
      </label>
      <label className="text-sm">
        Email
        <input required type="email" name="email" className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2" />
      </label>
      <label className="text-sm">
        Message
        <textarea required name="message" rows={5} className="mt-1 w-full border border-earth-700/20 bg-ivory-50 px-3 py-2" />
      </label>
      {message ? <p className="text-sm">{message}</p> : null}
      <button disabled={busy} className="bg-forest-900 py-3 text-xs uppercase tracking-[0.18em] text-ivory-50">
        Send message
      </button>
    </form>
  );
}
