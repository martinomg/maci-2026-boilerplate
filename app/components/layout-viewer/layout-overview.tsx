import { ShieldCheck, TriangleAlert } from "lucide-react";
import type { LayoutStatus } from "@/lib/layout-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SPOT_VISUALS } from "@/components/layout-viewer/spot-visuals";

/**
 * The numbers and the warnings that frame the drawing. Both are server
 * rendered from the same status object the canvas is coloured with, so the
 * headline count and the picture can never disagree.
 */

export function OccupancySummary({ status }: { status: LayoutStatus }) {
  const { summary } = status;
  const percent = Math.round(summary.occupancyRate * 100);

  const tiles = [
    {
      label: "Occupied",
      value: summary.occupied,
      hint: `${percent}% of ${summary.totalSpots} spots`,
      color: SPOT_VISUALS.occupied.stroke,
    },
    {
      label: "Free",
      value: summary.free,
      hint: "Available capacity",
      color: SPOT_VISUALS.free.stroke,
    },
    {
      label: "Out of service",
      value: summary.outOfService,
      hint: "Maintenance or closed",
      color: SPOT_VISUALS.out_of_service.stroke,
    },
    {
      label: "Unmapped",
      value: summary.unmappedSpots + summary.orphanElements,
      hint: `${summary.unmappedSpots} spot(s), ${summary.orphanElements} shape(s)`,
      color: SPOT_VISUALS.unmapped.stroke,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardContent>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: tile.color }}
              />
              <p className="font-mono text-[0.68rem] tracking-[0.16em] text-muted-foreground uppercase">
                {tile.label}
              </p>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {tile.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{tile.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export type SanitizerReport = {
  removedElements: string[];
  removedAttributes: string[];
};

function tally(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    .join(", ");
}

/**
 * Every mismatch between the spot table and the drawing, spelled out. A spot
 * that cannot be drawn is an operational gap, so it is listed rather than
 * dropped from the picture in silence.
 */
export function LayoutWarnings({
  status,
  sanitizer,
}: {
  status: LayoutStatus;
  sanitizer: SanitizerReport;
}) {
  const { summary, unmappedSpots, orphanElements } = status;
  const stripped =
    sanitizer.removedElements.length > 0 || sanitizer.removedAttributes.length > 0;

  const hasMismatch =
    summary.unmappedSpots > 0 ||
    summary.orphanElements > 0 ||
    summary.sessionsWithoutSpot > 0 ||
    summary.sessionsOnUnknownSpot > 0 ||
    summary.spotsWithConflictingSessions > 0;

  if (!hasMismatch && !stripped) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Every spot in this lot maps to a shape in the layout, and the file carried
            no script, event handler or external reference.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium">Layout and data do not fully agree</p>
            <p className="text-sm text-muted-foreground">
              These spots are excluded from the drawing or drawn without a record. They
              still count towards the lot total.
            </p>
          </div>
        </div>

        {unmappedSpots.length > 0 ? (
          <div>
            <p className="mb-2 font-mono text-[0.68rem] tracking-[0.16em] text-muted-foreground uppercase">
              Spots missing from the SVG ({unmappedSpots.length})
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {unmappedSpots.map((spot) => (
                <li key={spot.spotId}>
                  <Badge variant="outline" className="font-mono text-[0.7rem]">
                    {spot.code}
                    <span className="ml-1.5 font-sans font-normal text-muted-foreground">
                      {spot.reason === "no-element-id"
                        ? "no svg_element_id"
                        : `id "${spot.elementId}" not drawn`}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {orphanElements.length > 0 ? (
          <div>
            <p className="mb-2 font-mono text-[0.68rem] tracking-[0.16em] text-muted-foreground uppercase">
              Shapes without a spot ({orphanElements.length})
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {orphanElements.map((elementId) => (
                <li key={elementId}>
                  <Badge variant="outline" className="font-mono text-[0.7rem]">
                    {elementId}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.sessionsWithoutSpot > 0 ||
        summary.sessionsOnUnknownSpot > 0 ||
        summary.spotsWithConflictingSessions > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {summary.sessionsWithoutSpot > 0 ? (
              <li>
                {summary.sessionsWithoutSpot} open session(s) have no spot assigned, so
                they cannot be drawn.
              </li>
            ) : null}
            {summary.sessionsOnUnknownSpot > 0 ? (
              <li>
                {summary.sessionsOnUnknownSpot} open session(s) point at a spot outside
                this lot.
              </li>
            ) : null}
            {summary.spotsWithConflictingSessions > 0 ? (
              <li>
                {summary.spotsWithConflictingSessions} spot(s) carry more than one open
                session; the latest entry is shown.
              </li>
            ) : null}
          </ul>
        ) : null}

        {stripped ? (
          <p className="text-sm text-muted-foreground">
            Sanitizer removed from the uploaded file:{" "}
            {sanitizer.removedElements.length > 0 ? (
              <span className="font-mono text-xs">{tally(sanitizer.removedElements)}</span>
            ) : null}
            {sanitizer.removedElements.length > 0 && sanitizer.removedAttributes.length > 0
              ? " · "
              : null}
            {sanitizer.removedAttributes.length > 0 ? (
              <span className="font-mono text-xs">
                {tally(sanitizer.removedAttributes)}
              </span>
            ) : null}
            .
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
