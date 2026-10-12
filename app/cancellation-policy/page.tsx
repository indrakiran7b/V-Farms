import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";

export const metadata: Metadata = {
  title: "Cancellation and refunds",
  alternates: { canonical: "/cancellation-policy" },
};

export default function CancellationPage() {
  return (
    <PublicShell darkHeader>
      <PageIntro
        eyebrow="Legal"
        title="Cancellation and refund policy"
        lede="Refund windows, security deposits and event cancellation terms are unpublished pending owner and legal approval."
      />
      <article className="mx-auto max-w-3xl space-y-4 px-5 py-16 leading-8 md:px-8">
        <p>No live cancellation schedule is in force until the owner publishes one. The booking engine stores a policy snapshot with each reservation so later edits cannot rewrite accepted terms.</p>
        <p>Refunds, when authorized, are initiated only by the owner role and recorded with a reason, amount and gateway or offline reference.</p>
      </article>
    </PublicShell>
  );
}
