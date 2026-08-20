import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileWarning, MapPin } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutCanvas } from "@/components/layout-viewer/layout-canvas";
import {
  LayoutWarnings,
  OccupancySummary,
} from "@/components/layout-viewer/layout-overview";
import {
  getLayoutAsset,
  getLot,
  getLotSpots,
  getOpenSessions,
} from "@/components/layout-viewer/parking-data";
import { RefreshButton } from "@/components/layout-viewer/refresh-button";
import { buildLayoutStatus } from "@/lib/layout-status";
import { sanitizeSvg } from "@/lib/svg-sanitize";

// Live occupancy: never prerender, never cache.
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const lot = await getLot(id);
  if (!lot) return { title: "Layout" };
  return {
    title: `${lot.name ?? "Lot"} layout`,
    description: `Live spot utilization for ${lot.name ?? "this lot"}.`,
  };
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export default async function LayoutDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lot = await getLot(id);
  if (!lot) notFound();

  const [spots, sessions, asset] = await Promise.all([
    getLotSpots(lot.id),
    getOpenSessions(lot.id),
    getLayoutAsset(lot.layout_svg),
  ]);

  const sanitized = asset.ok
    ? sanitizeSvg(asset.markup)
    : { markup: "", rootFound: false, removedElements: [], removedAttributes: [] };

  const status = buildLayoutStatus({
    spots,
    sessions,
    svgMarkup: sanitized.markup,
  });

  const header = (
    <PageHeader
      eyebrow="Operations · Layout"
      title={lot.name ?? "Untitled lot"}
      description={[lot.address, lot.city].filter(Boolean).join(", ") || undefined}
      actions={<RefreshButton />}
    />
  );

  if (!asset.ok || !sanitized.rootFound) {
    const detail = asset.ok
      ? "The uploaded file has no <svg> root, so nothing can be drawn."
      : asset.detail;

    return (
      <PageContainer>
        <BackLink />
        {header}
        <OccupancySummary status={status} />
        <Card className="mt-4">
          <CardContent className="flex items-start gap-3">
            <FileWarning className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No layout to render</p>
              <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                This lot has {spots.length} spot(s) and {status.summary.occupied} open
                session(s) on them. Attach an SVG whose element ids match{" "}
                <span className="font-mono text-xs">parking_spots.svg_element_id</span> to
                see them drawn.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <BackLink />
      {header}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono text-[0.68rem] uppercase">
          {status.summary.occupied} occupied / {status.summary.totalSpots} total
        </Badge>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5" />
          State read at {formatTimestamp(status.generatedAt)} UTC · refresh for a new read
        </p>
      </div>

      <OccupancySummary status={status} />

      <div className="mt-4 space-y-4">
        <LayoutWarnings
          status={status}
          sanitizer={{
            removedElements: sanitized.removedElements,
            removedAttributes: sanitized.removedAttributes,
          }}
        />
        <LayoutCanvas
          markup={sanitized.markup}
          spotsByElementId={status.byElementId}
          orphanElements={status.orphanElements}
          title={`${lot.name ?? "Lot"} layout`}
        />
      </div>
    </PageContainer>
  );
}

function BackLink() {
  return (
    <Link
      href="/layouts"
      className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to layouts
    </Link>
  );
}
