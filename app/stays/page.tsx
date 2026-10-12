import type { Metadata } from "next";
import { StayBookingExperience } from "@/components/booking/StayBookingExperience";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { getStore } from "@/lib/data/store";

export const metadata: Metadata = {
  title: "Book the entire estate",
  alternates: { canonical: "/stays" },
};

export default function StaysPage() {
  const { content } = getStore();

  return (
    <PublicShell darkHeader>
      <PageIntro
        eyebrow="Whole-property stays"
        title="Your Private Escape Awaits."
        lede={
          content.stayIntro ||
          "Reserve exclusive access to the entire five-acre dragon fruit estate near Hyderabad — the guest building, plantation, and quiet of a single-property retreat."
        }
      />
      <div className="bg-ivory-50">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
          <p className="mx-auto mb-12 max-w-3xl text-center text-base leading-8 text-earth-800">
            V-Farms is one booking for the full property: five distinct rooms in a single guest building, shared
            gardens, and the working farm. Select your dates below to check availability across the unified estate
            calendar — never room-by-room.
          </p>
          <StayBookingExperience />
        </div>
      </div>
    </PublicShell>
  );
}
