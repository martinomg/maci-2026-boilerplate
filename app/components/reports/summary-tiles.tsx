import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SummaryTile = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** `alert` marks the revenue-leak tiles, `brand` the headline occupancy one. */
  tone?: "default" | "brand" | "alert";
};

/** Headline numbers above the charts, one row on every breakpoint. */
export function SummaryTiles({ tiles }: { tiles: SummaryTile[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          className={cn(
            "relative overflow-hidden",
            tile.tone === "brand" && "ring-2 ring-primary",
            tile.tone === "alert" && "ring-2 ring-destructive/60",
          )}
        >
          {tile.tone === "brand" ? (
            <div
              aria-hidden
              className="pointer-events-none absolute -top-14 -right-10 size-40 rounded-full bg-primary/20 blur-3xl"
            />
          ) : null}
          <CardContent className="relative">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[0.68rem] tracking-[0.16em] text-muted-foreground uppercase">
                {tile.label}
              </p>
              {tile.icon ? (
                <tile.icon
                  className={cn(
                    "size-4 text-muted-foreground",
                    tile.tone === "alert" && "text-destructive",
                  )}
                />
              ) : null}
            </div>
            <p
              className={cn(
                "mt-3 text-3xl font-semibold tracking-tight tabular-nums",
                tile.tone === "alert" && "text-destructive",
              )}
            >
              {tile.value}
            </p>
            {tile.hint ? (
              <p className="mt-1 text-sm text-muted-foreground">{tile.hint}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
