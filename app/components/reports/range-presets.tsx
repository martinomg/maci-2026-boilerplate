import Link from "next/link";
import { RANGE_PRESETS, type DayRange } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { formatRangeLabel } from "./format";

/**
 * Date-range presets as plain links.
 *
 * The range lives in the URL, so every switch is a fresh server render with the
 * charts and tiles recomputed from Directus — no client-side filtering, and the
 * selected range is shareable and back-button friendly.
 */
export function RangePresets({
  basePath,
  range,
  activeDays,
}: {
  basePath: string;
  range: DayRange;
  /** `null` when the range came from explicit `from`/`to` params. */
  activeDays: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {RANGE_PRESETS.map((preset) => {
          const active = activeDays === preset;
          return (
            <Button
              key={preset}
              asChild
              size="sm"
              variant={active ? "default" : "ghost"}
              className="min-w-20"
            >
              <Link
                href={`${basePath}?days=${preset}`}
                aria-current={active ? "true" : undefined}
                prefetch={false}
              >
                {preset} days
              </Link>
            </Button>
          );
        })}
      </div>
      <p className="font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
        {formatRangeLabel(range.from, range.to)}
      </p>
    </div>
  );
}
