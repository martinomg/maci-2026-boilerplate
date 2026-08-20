import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import { SectionPlaceholder } from "@/components/section-placeholder";

export const metadata: Metadata = {
  title: "Layouts",
  description: "Floor plans, zones and stall definitions per site.",
};

export default function LayoutsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Operations"
      title="Layouts"
      description="Floor plans, zones and stall definitions per site, versioned alongside the Directus schema they describe."
      icon={LayoutTemplate}
      tracking="#15"
      planned={[
        {
          title: "Zone editor",
          detail: "Draw and name zones directly on a floor plan.",
        },
        {
          title: "Stall inventory",
          detail: "Per-stall type, accessibility and pricing metadata.",
        },
        {
          title: "Layout versions",
          detail: "Compare a published layout against a working draft.",
        },
      ]}
    />
  );
}
