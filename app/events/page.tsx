import type { Metadata } from "next";
import Link from "next/link";
import { EventEnquiryForm } from "@/components/events/EventEnquiryForm";
import { PublicShell } from "@/components/layout/PublicShell";
import { getStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "Private events", alternates: { canonical: "/events" } };

export default function EventsPage() {
  const { content, gallery, faqs, settings, eventCategories } = getStore();
  const publishedCategories = eventCategories.filter((item) => item.published);
  const venueMedia = gallery.filter((item) => item.authentic && !item.awaitingOwnerApproval);
  const eventFaqs = faqs.filter((item) => item.published && item.category === "Events");

  return (
    <PublicShell darkHeader>
      <section className="relative min-h-[52vh] overflow-hidden bg-forest-950 text-ivory-50">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: "url('/images/hero-poster.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-forest-950/30" />
        <div className="relative mx-auto flex min-h-[52vh] max-w-6xl flex-col justify-end px-5 pb-16 pt-32 md:px-8">
          <p className="text-xs uppercase tracking-[0.28em] text-gold-400">Exclusive use</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl md:text-6xl">Gather Somewhere Extraordinary.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ivory-200/85">{content.eventIntro}</p>
          <Link
            href="#enquire"
            className="mt-8 inline-block w-fit bg-ivory-50 px-6 py-3 text-xs uppercase tracking-[0.18em] text-forest-950 transition hover:bg-ivory-100"
          >
            Enquire about your event
          </Link>
        </div>
      </section>

      <div className="bg-ivory-50">
        <section className="mx-auto max-w-6xl px-5 py-20 md:px-8">
          <p className="text-xs uppercase tracking-[0.22em] text-earth-700">The estate</p>
          <h2 className="mt-3 font-serif text-4xl text-forest-950">One property. Your occasion.</h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-earth-800">
            Private events at V-Farms reserve the entire five-acre dragon fruit estate — not a function room or a single
            lawn. Every approved event occupies the whole property, the same unified calendar as overnight stays, and
            the five guest rooms only when your quotation explicitly includes them.
          </p>
        </section>

        <section className="border-t border-earth-700/10 bg-ivory-100/40 px-5 py-16 md:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl text-forest-950">Event categories</h2>
            {publishedCategories.length ? (
              <ul className="mt-8 grid gap-6 md:grid-cols-3">
                {publishedCategories.map((cat) => (
                  <li key={cat.id} className="border border-earth-700/12 bg-ivory-50 p-6">
                    <p className="font-serif text-xl">{cat.label}</p>
                    <p className="mt-3 text-sm leading-7 text-muted">{cat.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                Owner-approved event types, capacity limits, music hours and catering rules will appear here once
                configured. Until then, describe your occasion in the enquiry form — placeholders are not commercial
                offers.
              </p>
            )}
          </div>
        </section>

        {venueMedia.length ? (
          <section className="mx-auto max-w-6xl px-5 py-16 md:px-8">
            <h2 className="font-serif text-3xl text-forest-950">Verified imagery</h2>
            <p className="mt-2 text-sm text-muted">Owner-supplied footage and photography only.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {venueMedia.map((item) => (
                <figure key={item.id} className="overflow-hidden border border-earth-700/10 bg-forest-950">
                  {item.kind === "video" ? (
                    <video src={item.src} muted loop playsInline className="aspect-video w-full object-cover opacity-90" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.src} alt={item.alt} className="aspect-video w-full object-cover" />
                  )}
                  <figcaption className="px-4 py-3 text-sm text-ivory-100/80">{item.caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8">
          <h2 className="font-serif text-3xl text-forest-950">How enquiries become confirmed events</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Enquiry", "Tell us your dates and vision. No inventory is held."],
              ["Review & quote", "V-Farms checks the shared calendar and sends an itemized quotation."],
              ["Accept & hold", "Accepting rechecks availability and places a short property hold."],
              ["Deposit & confirm", "Verified payment confirms the event — not a browser success message alone."],
            ].map(([title, body]) => (
              <li key={title} className="border-l-2 border-gold-400/60 pl-4">
                <p className="text-xs uppercase tracking-[0.16em] text-earth-700">{title}</p>
                <p className="mt-2 text-sm leading-7 text-earth-800">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-8 md:px-8">
          <EventEnquiryForm />
        </section>

        <section className="border-t border-earth-700/10 bg-forest-950 px-5 py-16 text-ivory-100 md:px-8">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-3xl">Event policies</h2>
              <p className="mt-4 text-sm leading-7 text-ivory-200/80">
                Cancellation windows, security deposits, vendor rules and noise curfews remain in draft until owner and
                legal approval. Quotations include the terms applicable at the time they are issued.
              </p>
              <Link href="/cancellation-policy" className="mt-4 inline-block text-sm underline">
                Read cancellation draft
              </Link>
            </div>
            <div>
              <h2 className="font-serif text-3xl">Contact</h2>
              <p className="mt-4 text-sm leading-7 text-ivory-200/80">
                {settings.contactEmail ?? "Events email unpublished."}
                <br />
                {settings.contactPhone ?? "Phone unpublished."}
                <br />
                {settings.supportHours ?? "Support hours unpublished."}
              </p>
            </div>
          </div>
        </section>

        {eventFaqs.length ? (
          <section className="mx-auto max-w-3xl px-5 py-16 md:px-8">
            <h2 className="font-serif text-3xl text-forest-950">FAQs</h2>
            <dl className="mt-8 space-y-6">
              {eventFaqs.map((item) => (
                <div key={item.id}>
                  <dt className="font-medium text-forest-900">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-7 text-muted">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
    </PublicShell>
  );
}
