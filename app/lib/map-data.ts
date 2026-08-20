import { directusServerFetch } from "./directus-server";

/**
 * Occupancy bands rendered on the city map.
 *
 * - `low`: below 30% of capacity in use
 * - `moderate`: 30% up to and including 80%
 * - `high`: above 80%
 */
export type OccupancyBand = "low" | "moderate" | "high";

export const OCCUPANCY_BAND_THRESHOLDS = {
  /** Ratios strictly below this are `low`. */
  low: 0.3,
  /** Ratios at or below this (and not `low`) are `moderate`; above it is `high`. */
  moderate: 0.8,
} as const;

/** Raw `parking_lots` row as returned by the Directus items endpoint. */
export type ParkingLotRow = {
  id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  capacity: string | number | null;
  hourly_rate: string | number | null;
};

/** Raw aggregate row grouping open sessions by lot. */
export type OpenSessionAggregateRow = {
  parking_lot: string | null;
  count: { id: string | number | null } | string | number | null;
};

/** Plain, serialisable lot passed from the server component to the client map. */
export type MapLot = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  capacity: number;
  hourlyRate: number | null;
  openSessions: number;
  /** Occupied share of capacity, clamped to 0..1. */
  occupancy: number;
  /** `occupancy` as a rounded whole percentage. */
  occupancyPercent: number;
  band: OccupancyBand;
};

/** Parses Directus decimal/numeric values, which arrive as strings. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Maps an occupancy ratio (0..1) to its display band. */
export function toOccupancyBand(occupancy: number): OccupancyBand {
  if (occupancy < OCCUPANCY_BAND_THRESHOLDS.low) return "low";
  if (occupancy <= OCCUPANCY_BAND_THRESHOLDS.moderate) return "moderate";
  return "high";
}

/** Turns Directus aggregate rows into a `lotId -> open session count` map. */
export function normalizeOpenSessionCounts(
  rows: readonly OpenSessionAggregateRow[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row?.parking_lot) continue;
    const raw =
      row.count !== null && typeof row.count === "object" ? row.count.id : row.count;
    counts[row.parking_lot] = toFiniteNumber(raw) ?? 0;
  }
  return counts;
}

/**
 * Combines lots with their open-session counts into map-ready records.
 * Lots without usable coordinates or capacity cannot be plotted and are skipped.
 */
export function buildMapLots(
  lots: readonly ParkingLotRow[],
  openSessionCounts: Readonly<Record<string, number>>,
): MapLot[] {
  const mapLots: MapLot[] = [];

  for (const lot of lots) {
    const latitude = toFiniteNumber(lot.latitude);
    const longitude = toFiniteNumber(lot.longitude);
    const capacity = toFiniteNumber(lot.capacity);

    if (latitude === null || longitude === null) continue;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    if (capacity === null || capacity <= 0) continue;

    const openSessions = Math.max(0, openSessionCounts[lot.id] ?? 0);
    const occupancy = Math.min(1, openSessions / capacity);

    mapLots.push({
      id: lot.id,
      name: lot.name ?? "Untitled lot",
      city: lot.city,
      address: lot.address,
      latitude,
      longitude,
      capacity,
      hourlyRate: toFiniteNumber(lot.hourly_rate),
      openSessions,
      occupancy,
      occupancyPercent: Math.round(occupancy * 100),
      band: toOccupancyBand(occupancy),
    });
  }

  return mapLots.sort((a, b) => b.occupancy - a.occupancy);
}

/** Geographic centre of the plotted lots, used to frame the initial camera. */
export function getMapCenter(
  lots: readonly MapLot[],
  fallback: { latitude: number; longitude: number },
): { latitude: number; longitude: number } {
  if (lots.length === 0) return fallback;
  const total = lots.reduce(
    (accumulator, lot) => ({
      latitude: accumulator.latitude + lot.latitude,
      longitude: accumulator.longitude + lot.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: total.latitude / lots.length,
    longitude: total.longitude / lots.length,
  };
}

/**
 * Reads published lots and their currently open sessions from Directus and
 * returns plain props for the client map. Parking collections require auth, so
 * both reads go through the server-only service-token fetch.
 */
export async function fetchMapLots(): Promise<MapLot[]> {
  const [lots, aggregate] = await Promise.all([
    directusServerFetch<ParkingLotRow[]>("/items/parking_lots", {
      fields: "id,name,city,address,latitude,longitude,capacity,hourly_rate",
      filter: JSON.stringify({ status: { _eq: "published" } }),
      sort: "sort,name",
      limit: "-1",
    }),
    directusServerFetch<OpenSessionAggregateRow[]>("/items/parking_sessions", {
      "aggregate[count]": "id",
      groupBy: "parking_lot",
      filter: JSON.stringify({ exited_at: { _null: true } }),
      limit: "-1",
    }),
  ]);

  return buildMapLots(lots ?? [], normalizeOpenSessionCounts(aggregate ?? []));
}
