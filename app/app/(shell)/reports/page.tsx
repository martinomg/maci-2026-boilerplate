import type { Metadata } from "next";
import { SquareChartGantt } from "lucide-react";
import { SectionPlaceholder } from "@/components/section-placeholder";

export const metadata: Metadata = {
  title: "Reports",
  description: "Scheduled and ad-hoc reporting across the portfolio.",
};

export default function ReportsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Operations"
      title="Reports"
      description="Scheduled and ad-hoc reporting across the portfolio, exportable and shareable from the same surface."
      icon={SquareChartGantt}
      tracking="#14"
      planned={[
        {
          title: "Report builder",
          detail: "Compose a report from saved filters and date ranges.",
        },
        {
          title: "Scheduled delivery",
          detail: "Recurring exports owned by the reporting collection.",
        },
        {
          title: "Result history",
          detail: "Every generated run kept auditable and re-runnable.",
        },
      ]}
    />
  );
}
