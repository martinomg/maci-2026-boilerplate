import type { OccupancyBand } from "@/lib/map-data";

/**
 * Presentation for each occupancy band. The hex colours are shared with the
 * Cesium point graphics, which cannot read Tailwind tokens at run time.
 */
export const OCCUPANCY_BANDS: Record<
  OccupancyBand,
  { label: string; range: string; color: string; badgeClassName: string }
> = {
  low: {
    label: "Available",
    range: "under 30%",
    color: "#22C55E",
    badgeClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  moderate: {
    label: "Filling up",
    range: "30% to 80%",
    color: "#FACC15",
    badgeClassName: "bg-primary/20 text-amber-800 dark:text-amber-200",
  },
  high: {
    label: "Near capacity",
    range: "over 80%",
    color: "#EF4444",
    badgeClassName: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
};

export const OCCUPANCY_BAND_ORDER: OccupancyBand[] = ["low", "moderate", "high"];
