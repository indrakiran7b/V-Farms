import Link from "next/link";
import { LuminousHero } from "@/components/hero/LuminousHero";
import { PublicShell } from "@/components/layout/PublicShell";
import { getStore } from "@/lib/data/store";

export default function HomePage() {
  const store = getStore();
  const { content, rooms, faqs } = store;

  return (
    <PublicShell darkHeader>
      <LuminousHero eyebrow={content.heroEyebrow} headline={content.heroHeadline} lede={content.heroLede} />

      <section className="mx-auto max-w-4xl px-5 py-24 text-center md:px-8">
        <p className="text-xs uppercase tracking-[0.28em] text-earth-700">The estate</p>
        <h2 className="mt-4 font-serif text-4xl md:text-5xl">A singular agricultural retreat</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted">{content.aboutExcerpt}</p>
      </section>

      <section className="bg-forest-950 px-5 py-24 text-ivory-50 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gold-400">Exclusive occupation</p>
            <h2 className="mt-4 font-serif text-4xl">Book the entire resort</h2>
            <p className="mt-5 max-w-md leading-8 text-ivory-200/80">{content.stayIntro}</p>
            <Link href="/booking" className="mt-8 inline-block border border-ivory-100/40 px-5 py-3 text-xs uppercase tracking-[0.18em]">
              Check estate availability
            </Link>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gold-400">By invitation of a quote</p>
            <h2 className="mt-4 font-serif text-4xl">Plan a private event</h2>
            <p className="mt-5 max-w-md leading-8 text-ivory-200/80">{content.eventIntro}</p>
            <Link href="/events" className="mt-8 inline-block border border-ivory-100/40 px-5 py-3 text-xs uppercase tracking-[0.18em]">
              Send an event enquiry
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 md:px-8">
        <p className="text-xs uppercase tracking-[0.28em] text-earth-700">Accommodation</p>
        <h2 className="mt-3 font-serif text-4xl">{content.roomsNotice}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-5">
          {rooms.map((room) => (
            <article key={room.id} className="border border-earth-700/15 p-5">
              <p className="font-serif text-2xl">{room.name}</p>
              <p className="mt-3 text-sm leading-6 text-muted">
                {room.awaitingOwnerApproval ? "Profile awaiting owner-approved photographs and specifications." : room.description}
              </p>
              <Link href="/rooms" className="mt-4 inline-block text-sm underline">
                View all five rooms
              </Link>
            </article>
          ))}
        </div>
        <Link href="/booking" className="mt-10 inline-block bg-forest-900 px-5 py-3 text-xs uppercase tracking-[0.18em] text-ivory-50">
          Book the Entire Resort
        </Link>
      </section>

      <section className="bg-ivory-100 px-5 py-24 md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs uppercase tracking-[0.28em] text-earth-700">The plantation</p>
          <h2 className="mt-3 font-serif text-4xl">Dragon fruit across five acres</h2>
          <p className="mt-5 max-w-2xl leading-8 text-muted">{content.farmStory}</p>
          <Link href="/estate" className="mt-8 inline-block text-sm underline">
            Explore the schematic estate map
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 md:px-8">
        <p className="text-xs uppercase tracking-[0.28em] text-earth-700">Verified notes</p>
        <h2 className="mt-3 font-serif text-4xl">Amenities and experiences</h2>
        <p className="mt-5 max-w-2xl leading-8 text-muted">
          Only owner-verified facilities will be listed here. No pool, café, lawn or activity is promised until it is confirmed as existing and available.
        </p>
        <Link href="/experiences" className="mt-6 inline-block text-sm underline">
          Review pending experiences
        </Link>
      </section>

      <section className="bg-forest-900 px-5 py-24 text-ivory-50 md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs uppercase tracking-[0.28em] text-gold-400">Gallery</p>
          <h2 className="mt-3 font-serif text-4xl">Footage from the land</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <video className="h-64 w-full object-cover" src="/videos/farm-h1.mp4" muted playsInline controls preload="metadata" />
            <video className="h-64 w-full object-cover" src="/videos/farmhouse-v1.mp4" muted playsInline controls preload="metadata" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-24 md:px-8">
        <h2 className="font-serif text-4xl">Questions before you write</h2>
        <dl className="mt-10 space-y-6">
          {faqs.slice(0, 4).map((item) => (
            <div key={item.id}>
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-2 leading-7 text-muted">{item.answer}</dd>
            </div>
          ))}
        </dl>
        <Link href="/faq" className="mt-8 inline-block text-sm underline">
          All policies and FAQs
        </Link>
      </section>

      <section className="bg-ivory-100 px-5 py-24 md:px-8">
        <div className="mx-auto max-w-6xl grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-4xl">Near Hyderabad</h2>
            <p className="mt-5 leading-8 text-muted">
              Exact postal address, coordinates and a maps link will appear here after the owner verifies them. Do not rely on placeholder pins.
            </p>
          </div>
          <div>
            <h2 className="font-serif text-4xl">Write to us</h2>
            <p className="mt-5 leading-8 text-muted">Phone, WhatsApp and support hours are unpublished until supplied.</p>
            <Link href="/contact" className="mt-6 inline-block bg-forest-900 px-5 py-3 text-xs uppercase tracking-[0.18em] text-ivory-50">
              Contact V-Farms
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
