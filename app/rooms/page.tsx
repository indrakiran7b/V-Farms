import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { getStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "The five rooms", alternates: { canonical: "/rooms" } };

export default function RoomsPage() {
  const { rooms, content } = getStore();
  return (
    <PublicShell darkHeader>
      <PageIntro
        eyebrow="Accommodation"
        title={content.roomsNotice}
        lede="Each profile is editorial. Availability, price and checkout exist only for the whole estate."
      />
      <div className="mx-auto max-w-5xl space-y-10 px-5 py-20 md:px-8">
        {rooms.map((room) => (
          <article id={room.slug} key={room.id} className="border border-earth-700/15 p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-earth-700">Room {room.sortOrder} of 5</p>
            <h2 className="mt-2 font-serif text-4xl">{room.name}</h2>
            <p className="mt-4 max-w-2xl leading-8 text-muted">{room.description}</p>
            <dl className="mt-6 grid gap-4 text-sm md:grid-cols-3">
              <div>
                <dt className="text-muted">Size</dt>
                <dd>{room.sizeLabel ?? "Awaiting owner-approved measurement"}</dd>
              </div>
              <div>
                <dt className="text-muted">Bed</dt>
                <dd>{room.bedConfiguration ?? "Awaiting owner-approved configuration"}</dd>
              </div>
              <div>
                <dt className="text-muted">View</dt>
                <dd>{room.view ?? "Awaiting owner-approved description"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-muted">
              Amenities: {room.amenities.length ? room.amenities.join(", ") : "None listed until verified by the owner."}
            </p>
            <div className="mt-6 h-48 border border-dashed border-earth-700/30 bg-ivory-100 p-6 text-sm text-muted">
              Photograph placeholder — awaiting owner-approved imagery. No stock interiors are shown.
            </div>
            <Link href="/booking" className="mt-6 inline-block bg-forest-900 px-5 py-3 text-xs uppercase tracking-[0.18em] text-ivory-50">
              Book the Entire Resort
            </Link>
          </article>
        ))}
      </div>
    </PublicShell>
  );
}
