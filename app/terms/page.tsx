import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <PublicShell darkHeader>
      <PageIntro eyebrow="Legal" title="Terms and conditions" lede="Draft operating terms for exclusive whole-property stays and quoted events. Not a substitute for counsel-approved contracts." />
      <article className="mx-auto max-w-3xl space-y-4 px-5 py-16 leading-8 md:px-8">
        <p>Every overnight booking reserves the entire V-Farms property, including all five rooms in the guest building. Rooms are not sold individually.</p>
        <p>Event use requires an accepted quotation. Overnight room access during an event is included only when the quotation states it.</p>
        <p>Published placeholder rates are for development demonstration and are marked as awaiting owner approval.</p>
      </article>
    </PublicShell>
  );
}
