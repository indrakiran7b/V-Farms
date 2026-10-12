import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <PublicShell darkHeader>
      <PageIntro eyebrow="Legal" title="Privacy policy" lede="This draft describes how the MVP handles contact and booking data. Counsel must approve a production policy." />
      <article className="mx-auto max-w-3xl space-y-4 px-5 py-16 leading-8 md:px-8">
        <p>V-Farms collects only the contact details and stay or event information required to evaluate a reservation.</p>
        <p>Guest records are not publicly readable. Staff access is role-restricted. Payment card data is handled by Razorpay, not stored in this application.</p>
        <p>A production privacy notice, retention schedule and grievance contact will replace this draft after owner and legal review.</p>
      </article>
    </PublicShell>
  );
}
