import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { ContactForm } from "@/components/contact/ContactForm";
import { getStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  const { settings } = getStore();
  return (
    <PublicShell darkHeader>
      <PageIntro eyebrow="Hyderabad" title="Contact and directions" lede="Verified address, maps, phone and support hours will replace these placeholders after the owner supplies them." />
      <div className="mx-auto grid max-w-5xl gap-12 px-5 py-16 md:grid-cols-2 md:px-8">
        <div className="space-y-3 leading-8">
          <p>{settings.locationLabel}</p>
          <p>{settings.postalAddress ?? "Postal address awaiting owner verification."}</p>
          <p>{settings.contactPhone ?? "Phone unpublished."}</p>
          <p>{settings.contactEmail ?? "Public email unpublished."}</p>
          <p>{settings.supportHours ?? "Support hours unpublished."}</p>
          {settings.mapsUrl ? (
            <a className="underline" href={settings.mapsUrl}>
              Open maps
            </a>
          ) : (
            <p className="text-sm text-muted">No maps link is published because coordinates have not been verified.</p>
          )}
        </div>
        <ContactForm />
      </div>
    </PublicShell>
  );
}
