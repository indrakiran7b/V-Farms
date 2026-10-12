import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { getStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "FAQs and policies", alternates: { canonical: "/faq" } };

export default function FaqPage() {
  const { faqs } = getStore();
  return (
    <PublicShell darkHeader>
      <PageIntro eyebrow="Guidance" title="FAQs and important policies" lede="Commercial policies remain unpublished until the owner approves cancellation, deposits, quiet hours and event conditions." />
      <div className="mx-auto max-w-3xl space-y-8 px-5 py-16 md:px-8">
        {faqs.map((item) => (
          <article key={item.id}>
            <h2 className="font-serif text-2xl">{item.question}</h2>
            <p className="mt-3 leading-8 text-muted">{item.answer}</p>
          </article>
        ))}
      </div>
    </PublicShell>
  );
}
