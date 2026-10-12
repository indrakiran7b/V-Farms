import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { StayBookingExperience } from "@/components/booking/StayBookingExperience";
import { CheckoutPanel } from "@/components/booking/CheckoutPanel";

export const metadata: Metadata = { title: "Book the estate", alternates: { canonical: "/booking" } };

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ hold?: string }>;
}) {
  const { hold } = await searchParams;
  return (
    <PublicShell darkHeader>
      <PageIntro
        eyebrow="Whole-property reservation"
        title="Reserve V-Farms"
        lede="Select nights for the entire estate. Individual rooms cannot be booked. A hold expires if payment is not verified in time."
      />
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
        {hold ? <CheckoutPanel stayId={hold} /> : <StayBookingExperience />}
      </div>
    </PublicShell>
  );
}
