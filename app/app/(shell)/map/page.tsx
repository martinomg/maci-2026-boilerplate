import type { Metadata } from "next";
import { Map } from "lucide-react";
import { SectionPlaceholder } from "@/components/section-placeholder";

export const metadata: Metadata = {
  title: "Map",
  description: "Spatial view of every managed site and its live state.",
};

export default function MapPage() {
  return (
    <SectionPlaceholder
      eyebrow="Operations"
      title="Map"
      description="A spatial view of every managed site, with live occupancy and alert state rendered on the map surface."
      icon={Map}
      tracking="#13"
      planned={[
        {
          title: "Site markers",
          detail: "Cluster and drill down from portfolio to a single facility.",
        },
        {
          title: "Live occupancy overlay",
          detail: "Colour-graded zones fed by the Directus alerts collection.",
        },
        {
          title: "Selection panel",
          detail: "Inspect a site without leaving the map viewport.",
        },
      ]}
    />
  );
}
