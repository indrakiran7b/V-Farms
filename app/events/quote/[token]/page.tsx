import type { Metadata } from "next";
import { EventQuoteClient } from "@/components/events/EventQuoteClient";
import { PublicShell } from "@/components/layout/PublicShell";

export const metadata: Metadata = { title: "Event quotation", robots: { index: false, follow: false } };

export default async function EventQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <PublicShell>
      <div className="bg-ivory-50">
        <div className="mx-auto max-w-3xl px-5 py-20 md:px-8">
          <EventQuoteClient token={token} />
        </div>
      </div>
    </PublicShell>
  );
}
