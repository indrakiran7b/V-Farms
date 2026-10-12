import type { Metadata } from "next";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicShell } from "@/components/layout/PublicShell";
import { EstateMap } from "@/components/estate/EstateMap";
import { getStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "Explore the estate", alternates: { canonical: "/estate" } };

export default function EstatePage() {
  const { hotspots } = getStore();
  return (
    <PublicShell darkHeader>
      <PageIntro
        eyebrow="Five acres"
        title="A schematic map of V-Farms"
        lede="This drawing is not a surveyed plan. Boundaries, building placement, paths and walking times are illustrative until the owner supplies drone imagery or a site survey."
      />
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8">
        <EstateMap hotspots={hotspots} />
      </div>
    </PublicShell>
  );
}
