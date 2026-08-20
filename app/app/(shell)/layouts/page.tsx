import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, LayoutTemplate, MapPin } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RefreshButton } from "@/components/layout-viewer/refresh-button";
import { getLotOverviews, type LotOverview } from "@/components/layout-viewer/parking-data";

export const metadata: Metadata = {
  title: "Layouts",
  description: "Floor plans per lot with live utilization.",
};

// Occupancy is read at request time, so the list must never be cached.
export const dynamic = "force-dynamic";

/**
 * Capacity is the honest denominator here: a lot can hold open sessions that
 * are not assigned to a spot yet, so the spot table alone would overstate use.
 */
function occupancyPercent(lot: LotOverview): number {
  const total = lot.capacity || lot.spotCount || 0;
  if (total === 0) return 0;
  return Math.min(100, Math.round((lot.openSessionCount / total) * 100));
}

function LotCard({ lot }: { lot: LotOverview }) {
  const total = lot.capacity || lot.spotCount || 0;
  const percent = occupancyPercent(lot);
  const hasLayout = Boolean(lot.layout_svg);

  return (
    <Card className="transition-colors hover:border-primary/60">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">
              <Link href={`/layouts/${lot.id}`} className="hover:underline">
                {lot.name ?? "Untitled lot"}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1 flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {[lot.address, lot.city].filter(Boolean).join(", ") || "No address"}
              </span>
            </CardDescription>
          </div>
          <Badge variant={hasLayout ? "default" : "outline"} className="shrink-0">
            {hasLayout ? "Layout" : "No layout"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-1.5 flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium tabular-nums">
            {lot.openSessionCount} in use / {total} capacity
          </span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {percent}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          {lot.spotCount} spot(s) defined
        </p>
        <Link
          href={`/layouts/${lot.id}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {hasLayout ? "Open layout" : "Open lot"}
          <ArrowUpRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function LayoutsPage() {
  const lots = await getLotOverviews();
  const withLayout = lots.filter((lot) => lot.layout_svg);
  const withoutLayout = lots.filter((lot) => !lot.layout_svg);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations"
        title="Layouts"
        description="Floor plans per lot, coloured by the live state of every spot. Occupancy is read from open sessions at request time."
        actions={<RefreshButton label="Refresh" />}
      />

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-medium">With a layout</h2>
          <Badge variant="outline" className="font-mono text-[0.68rem]">
            {withLayout.length}
          </Badge>
        </div>
        {withLayout.length === 0 ? (
          <Card>
            <CardContent className="flex items-start gap-3 text-sm text-muted-foreground">
              <LayoutTemplate className="mt-0.5 size-4 shrink-0" />
              No lot has a layout file yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {withLayout.map((lot) => (
              <LotCard key={lot.id} lot={lot} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-medium">Without a layout</h2>
          <Badge variant="outline" className="font-mono text-[0.68rem]">
            {withoutLayout.length}
          </Badge>
        </div>
        {withoutLayout.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Every lot has a layout file.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {withoutLayout.map((lot) => (
              <LotCard key={lot.id} lot={lot} />
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
