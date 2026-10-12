import Link from "next/link";

export default function LegacyAcceptQuotePage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24">
      <h1 className="font-serif text-4xl">Quotation link updated</h1>
      <p className="mt-6 leading-8 text-muted">
        Event quotations now use a private secure link sent by email, for example{" "}
        <code className="text-sm">/events/quote/…</code>. If you received an older link, contact V-Farms for a fresh
        quotation URL.
      </p>
      <Link href="/events" className="mt-6 inline-block underline">
        Return to events
      </Link>
    </main>
  );
}
