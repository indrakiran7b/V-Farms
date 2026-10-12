import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { getStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "Gallery", alternates: { canonical: "/gallery" } };

export default function GalleryPage() {
  const { gallery } = getStore();
  return (
    <PublicShell darkHeader>
      <PageIntro eyebrow="From the farm" title="Gallery" lede="Only authentic, owner-supplied media is shown. Stock photography is not used as a substitute." />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-16 md:grid-cols-2 md:px-8">
        {gallery.map((item) => (
          <figure key={item.id}>
            {item.kind === "video" ? (
              <video src={item.src} className="h-72 w-full object-cover" controls muted playsInline preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.src} alt={item.alt} className="h-72 w-full object-cover" />
            )}
            <figcaption className="mt-3 text-sm text-muted">{item.caption}</figcaption>
          </figure>
        ))}
      </div>
    </PublicShell>
  );
}
