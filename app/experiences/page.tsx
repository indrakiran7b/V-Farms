import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { getStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "Experiences", alternates: { canonical: "/experiences" } };

export default function ExperiencesPage() {
  const { experiences } = getStore();
  return (
    <PublicShell darkHeader>
      <PageIntro
        eyebrow="On the land"
        title="Experiences"
        lede="Only experiences actually offered and approved by the owner are bookable. Pending items remain labelled as such."
      />
      <div className="mx-auto max-w-3xl space-y-8 px-5 py-16 md:px-8">
        {experiences.length === 0 ? <p>No approved experiences have been published.</p> : null}
        {experiences.map((item) => (
          <article key={item.id} className="border border-earth-700/15 p-6">
            <h2 className="font-serif text-3xl">{item.title}</h2>
            <p className="mt-3 leading-8 text-muted">{item.description}</p>
            <p className="mt-3 text-sm">{item.offered ? "Currently offered." : "Not offered until owner approval."}</p>
          </article>
        ))}
      </div>
    </PublicShell>
  );
}
