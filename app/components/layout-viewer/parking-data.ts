import { directusServerFetch } from "@/lib/directus-server";
import type { ParkingSessionRecord, ParkingSpotRecord } from "@/lib/layout-status";

/**
 * Server-side reads for the layout viewer.
 *
 * Parking collections are not public, so every call goes through
 * `directusServerFetch` (Bearer token, `cache: "no-store"`). The SVG itself is
 * a binary asset, so it is fetched with the same token but read as text.
 */

export type ParkingLotRecord = {
  id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  capacity: number | null;
  status: string | null;
  layout_svg: string | null;
};

export type LotOverview = ParkingLotRecord & {
  spotCount: number;
  openSessionCount: number;
};

type AggregateRow = {
  parking_lot: string | null;
  count: { id: string | number } | null;
};

const LOT_FIELDS = "id,name,city,address,capacity,status,layout_svg";
const SPOT_FIELDS = "id,code,type,status,svg_element_id";
const SESSION_FIELDS = "id,plate,entered_at,exited_at,parking_spot";

/** Refuses to inline anything absurd; a floor plan is kilobytes, not megabytes. */
export const MAX_LAYOUT_BYTES = 2_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLotId(value: string): boolean {
  return UUID.test(value);
}

function toCountMap(rows: AggregateRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.parking_lot) continue;
    map.set(row.parking_lot, Number(row.count?.id ?? 0));
  }
  return map;
}

/** Every lot, with how many spots it has and how many are in use right now. */
export async function getLotOverviews(): Promise<LotOverview[]> {
  const [lots, spotRows, sessionRows] = await Promise.all([
    directusServerFetch<ParkingLotRecord[]>("/items/parking_lots", {
      fields: LOT_FIELDS,
      sort: "sort,name",
      limit: "-1",
    }),
    directusServerFetch<AggregateRow[]>("/items/parking_spots", {
      "aggregate[count]": "id",
      groupBy: "parking_lot",
    }),
    directusServerFetch<AggregateRow[]>("/items/parking_sessions", {
      "aggregate[count]": "id",
      groupBy: "parking_lot",
      filter: JSON.stringify({ exited_at: { _null: true } }),
    }),
  ]);

  const spotCounts = toCountMap(spotRows);
  const sessionCounts = toCountMap(sessionRows);

  return lots.map((lot) => ({
    ...lot,
    spotCount: spotCounts.get(lot.id) ?? 0,
    openSessionCount: sessionCounts.get(lot.id) ?? 0,
  }));
}

export async function getLot(id: string): Promise<ParkingLotRecord | null> {
  if (!isLotId(id)) return null;
  try {
    return await directusServerFetch<ParkingLotRecord>(`/items/parking_lots/${id}`, {
      fields: LOT_FIELDS,
    });
  } catch {
    return null;
  }
}

export function getLotSpots(lotId: string): Promise<ParkingSpotRecord[]> {
  return directusServerFetch<ParkingSpotRecord[]>("/items/parking_spots", {
    fields: SPOT_FIELDS,
    filter: JSON.stringify({ parking_lot: { _eq: lotId } }),
    sort: "code",
    limit: "-1",
  });
}

/** Only sessions still open: those are what "occupied" means. */
export function getOpenSessions(lotId: string): Promise<ParkingSessionRecord[]> {
  return directusServerFetch<ParkingSessionRecord[]>("/items/parking_sessions", {
    fields: SESSION_FIELDS,
    filter: JSON.stringify({
      parking_lot: { _eq: lotId },
      exited_at: { _null: true },
    }),
    sort: "entered_at",
    limit: "-1",
  });
}

export type LayoutAsset =
  | { ok: true; markup: string }
  | { ok: false; reason: "missing" | "not-svg" | "too-large" | "unreachable"; detail: string };

function directusUrl(): string {
  return (
    process.env.DIRECTUS_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_DIRECTUS_URL ??
    "http://localhost:18707"
  ).replace(/\/$/, "");
}

/**
 * Downloads the raw layout file. The content is returned untouched; sanitizing
 * is the caller's job so the page can report what was stripped.
 */
export async function getLayoutAsset(fileId: string | null): Promise<LayoutAsset> {
  if (!fileId) return { ok: false, reason: "missing", detail: "This lot has no layout file." };

  const token = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!token) {
    return {
      ok: false,
      reason: "unreachable",
      detail: "DIRECTUS_SERVICE_TOKEN is not set for this environment.",
    };
  }

  let meta: { type: string | null; filesize: string | number | null };
  try {
    meta = await directusServerFetch<{ type: string | null; filesize: string | number | null }>(
      `/files/${fileId}`,
      { fields: "id,type,filesize" },
    );
  } catch {
    return { ok: false, reason: "missing", detail: "The layout file is not readable." };
  }

  if (meta.type && !meta.type.includes("svg")) {
    return { ok: false, reason: "not-svg", detail: `Unsupported layout type: ${meta.type}.` };
  }
  if (Number(meta.filesize ?? 0) > MAX_LAYOUT_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      detail: `The layout file is larger than ${Math.round(MAX_LAYOUT_BYTES / 1000)} kB.`,
    };
  }

  const response = await fetch(`${directusUrl()}/assets/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: "unreachable",
      detail: `Directus returned ${response.status} for the layout file.`,
    };
  }

  return { ok: true, markup: await response.text() };
}
