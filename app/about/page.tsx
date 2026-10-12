import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { getStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  const { content } = getStore();
  return (
    <PublicShell darkHeader>
      <PageIntro eyebrow="The farm" title="About V-Farms" lede={content.aboutExcerpt} />
      <article className="mx-auto max-w-3xl px-5 py-20 leading-8 md:px-8">
        <p>{content.farmStory}</p>
        <p className="mt-6">
          V-Farms is booked as one exclusive property. The five guest rooms sit in a single building and are included together in every overnight stay. They are never independently reservable.
        </p>
        <p className="mt-6 text-muted">
          Founder biography, cultivation methods, seasonal harvest notes and a verified facilities list will be published here after owner approval. No café, pool or unverified amenity is claimed.
        </p>
      </article>
    </PublicShell>
  );
}
