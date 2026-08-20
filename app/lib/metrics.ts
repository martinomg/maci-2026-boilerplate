/**
 * Pure parking metric calculations for the city dashboard.
 *
 * Every function here is deterministic: the caller passes the records it
 * already fetched plus an explicit "now", so the same inputs always produce
 * the same output in tests and at runtime. Nothing in this module touches the
 * network, the clock or the DOM.
 *
 * Directus returns `decimal` columns as strings ("2500.00") and m2o relations
 * either as an id or as an expanded object, so every reader normalises both
 * shapes before doing arithmetic.
 *
 * Day buckets are UTC days. The demo city is Santiago, but a fixed offset
 * keeps the series reproducible across machines and CI.
 */

export type ParkingLotRecord = {
  id: string;
  name: string;
  city?: string | null;
  status?: string | null;
  capacity?: number | string | null;
  hourly_rate?: number | string | null;
};

export type ParkingSessionRecord = {
  id?: string;
  parking_lot?: string | { id?: string | null } | null;
  entered_at?: string | null;
  exited_at?: string | null;
};

export type ParkingTransactionRecord = {
  id?: string;
  amount?: number | string | null;
  currency?: string | null;
  paid_at?: string | null;
};

export type OccupancyBand = "high" | "elevated" | "moderate" | "low";

export type LotOccupancy = {
  lotId: string;
  name: string;
  capacity: number;
  occupied: number;
  /** Share of capacity in use, 0..1. `null` when the lot has no capacity. */
  rate: number | null;
  band: OccupancyBand | null;
};

export type CitywideOccupancy = {
  lots: number;
  capacity: number;
  occupied: number;
  rate: number | null;
};

export type LotAverageStay = {
  lotId: string;
  name: string;
  /** Mean minutes between entry and exit for closed sessions, or `null`. */
  averageStayMinutes: number | null;
  closedSessions: number;
};

export type OccupancyPoint = {
  /** UTC calendar day, `YYYY-MM-DD`. */
  date: string;
  occupied: number;
  capacity: number;
  rate: number | null;
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Ordered high to low; the first band whose `min` is reached wins. */
export const OCCUPANCY_BANDS: {
  band: OccupancyBand;
  min: number;
  label: string;
}[] = [
  { band: "high", min: 0.8, label: "High" },
  { band: "elevated", min: 0.6, label: "Elevated" },
  { band: "moderate", min: 0.3, label: "Moderate" },
  { band: "low", min: 0, label: "Low" },
];

/** Accepts Directus decimal strings, numbers and nullish values. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Milliseconds since epoch for an ISO timestamp, or `null` when unusable. */
export function toTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function instantOf(now: Date | number | string): number {
  return toTimestamp(now) ?? Number.NaN;
}

/** Resolves the lot id whether Directus returned an id or an expanded object. */
export function sessionLotId(session: ParkingSessionRecord): string | null {
  const relation = session?.parking_lot;
  if (typeof relation === "string") return relation.length > 0 ? relation : null;
  if (relation && typeof relation === "object") {
    const id = relation.id;
    return typeof id === "string" && id.length > 0 ? id : null;
  }
  return null;
}

/**
 * A session occupies a spot at `instant` when it has already entered and has
 * either not exited yet or exits later. Open sessions (`exited_at === null`)
 * therefore count for every instant at or after entry.
 */
export function isSessionActiveAt(
  session: ParkingSessionRecord,
  instant: number,
): boolean {
  const entered = toTimestamp(session?.entered_at);
  if (entered === null || entered > instant) return false;
  const exited = toTimestamp(session?.exited_at);
  return exited === null || exited > instant;
}

export function occupancyBand(rate: number | null): OccupancyBand | null {
  if (rate === null || !Number.isFinite(rate)) return null;
  const match = OCCUPANCY_BANDS.find((entry) => rate >= entry.min);
  return match ? match.band : "low";
}

export function occupancyBandLabel(band: OccupancyBand | null): string {
  if (band === null) return "No capacity";
  return OCCUPANCY_BANDS.find((entry) => entry.band === band)?.label ?? "Low";
}

function lotCapacity(lot: ParkingLotRecord): number {
  const capacity = toNumber(lot?.capacity);
  return capacity !== null && capacity > 0 ? Math.floor(capacity) : 0;
}

/**
 * Current occupancy per lot: sessions active at `now` over lot capacity.
 * A lot with no capacity keeps a `null` rate instead of dividing by zero.
 */
export function computeLotOccupancy(
  lots: ParkingLotRecord[],
  sessions: ParkingSessionRecord[],
  now: Date | number | string,
): LotOccupancy[] {
  const instant = instantOf(now);
  const active = new Map<string, number>();

  for (const session of sessions ?? []) {
    if (!isSessionActiveAt(session, instant)) continue;
    const lotId = sessionLotId(session);
    if (lotId === null) continue;
    active.set(lotId, (active.get(lotId) ?? 0) + 1);
  }

  return (lots ?? []).map((lot) => {
    const capacity = lotCapacity(lot);
    // Never report more vehicles than the lot can physically hold.
    const occupied = Math.min(active.get(lot.id) ?? 0, capacity || Number.MAX_SAFE_INTEGER);
    const rate = capacity > 0 ? occupied / capacity : null;
    return {
      lotId: lot.id,
      name: lot.name,
      capacity,
      occupied,
      rate,
      band: occupancyBand(rate),
    };
  });
}

/** Citywide occupancy: total active sessions over total capacity. */
export function computeCitywideOccupancy(
  lots: ParkingLotRecord[],
  sessions: ParkingSessionRecord[],
  now: Date | number | string,
): CitywideOccupancy {
  const perLot = computeLotOccupancy(lots, sessions, now);
  const capacity = perLot.reduce((total, lot) => total + lot.capacity, 0);
  const occupied = perLot.reduce((total, lot) => total + lot.occupied, 0);
  return {
    lots: perLot.length,
    capacity,
    occupied,
    rate: capacity > 0 ? occupied / capacity : null,
  };
}

export type StayWindow = {
  /** Only count sessions that exited at or after this instant. */
  since?: Date | number | string | null;
  /** Only count sessions that exited at or before this instant. */
  until?: Date | number | string | null;
  /** Restrict to a single lot. */
  lotId?: string | null;
};

/**
 * Mean stay in minutes over closed sessions. Open sessions have no exit yet,
 * so including them would bias the mean downwards; they are excluded. Returns
 * `null` when no closed session qualifies (empty or brand-new lot).
 */
export function computeAverageStayMinutes(
  sessions: ParkingSessionRecord[],
  window: StayWindow = {},
): number | null {
  const since = window.since == null ? null : toTimestamp(window.since);
  const until = window.until == null ? null : toTimestamp(window.until);

  let total = 0;
  let count = 0;

  for (const session of sessions ?? []) {
    const entered = toTimestamp(session?.entered_at);
    const exited = toTimestamp(session?.exited_at);
    if (entered === null || exited === null) continue;
    if (exited < entered) continue;
    if (since !== null && exited < since) continue;
    if (until !== null && exited > until) continue;
    if (window.lotId != null && sessionLotId(session) !== window.lotId) continue;
    total += (exited - entered) / MINUTE_MS;
    count += 1;
  }

  return count === 0 ? null : total / count;
}

export function computeAverageStayByLot(
  lots: ParkingLotRecord[],
  sessions: ParkingSessionRecord[],
  window: Omit<StayWindow, "lotId"> = {},
): LotAverageStay[] {
  return (lots ?? []).map((lot) => {
    const lotSessions = (sessions ?? []).filter(
      (session) => sessionLotId(session) === lot.id,
    );
    const averageStayMinutes = computeAverageStayMinutes(lotSessions, window);
    const closedSessions = lotSessions.filter(
      (session) =>
        toTimestamp(session?.entered_at) !== null &&
        toTimestamp(session?.exited_at) !== null,
    ).length;
    return {
      lotId: lot.id,
      name: lot.name,
      averageStayMinutes,
      closedSessions,
    };
  });
}

/**
 * Revenue over a trailing window ending at `now`, inclusive of the end and
 * exclusive of the start. Unpaid transactions (`paid_at === null`) are ignored.
 */
export function computeRevenue(
  transactions: ParkingTransactionRecord[],
  options: { now: Date | number | string; days?: number },
): number {
  const instant = instantOf(options.now);
  const days = options.days ?? 7;
  const start = instant - days * DAY_MS;

  let total = 0;
  for (const transaction of transactions ?? []) {
    const paidAt = toTimestamp(transaction?.paid_at);
    if (paidAt === null || paidAt <= start || paidAt > instant) continue;
    const amount = toNumber(transaction?.amount);
    if (amount === null) continue;
    total += amount;
  }
  return total;
}

/** UTC `YYYY-MM-DD` for an instant. */
export function utcDayKey(instant: number): string {
  return new Date(instant).toISOString().slice(0, 10);
}

/**
 * Sample instants for a trailing `days` window ending at `now`: the end of each
 * UTC day, clamped to `now` for today so the latest point reflects the present.
 */
function sampleInstants(instant: number, days: number): { date: string; at: number }[] {
  const startOfToday = Math.floor(instant / DAY_MS) * DAY_MS;
  const points: { date: string; at: number }[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayStart = startOfToday - offset * DAY_MS;
    const at = Math.min(dayStart + DAY_MS - 1, instant);
    points.push({ date: utcDayKey(dayStart), at });
  }
  return points;
}

/** Citywide occupancy sampled once per UTC day over a trailing window. */
export function computeOccupancyTrend(
  lots: ParkingLotRecord[],
  sessions: ParkingSessionRecord[],
  now: Date | number | string,
  days = 7,
): OccupancyPoint[] {
  const instant = instantOf(now);
  const capacity = (lots ?? []).reduce((total, lot) => total + lotCapacity(lot), 0);
  const lotIds = new Set((lots ?? []).map((lot) => lot.id));

  return sampleInstants(instant, days).map(({ date, at }) => {
    let occupied = 0;
    for (const session of sessions ?? []) {
      const lotId = sessionLotId(session);
      if (lotId === null || !lotIds.has(lotId)) continue;
      if (isSessionActiveAt(session, at)) occupied += 1;
    }
    occupied = Math.min(occupied, capacity || Number.MAX_SAFE_INTEGER);
    return {
      date,
      occupied,
      capacity,
      rate: capacity > 0 ? occupied / capacity : null,
    };
  });
}

/** Same sampling as {@link computeOccupancyTrend}, restricted to one lot. */
export function computeLotOccupancyTrend(
  lot: ParkingLotRecord,
  sessions: ParkingSessionRecord[],
  now: Date | number | string,
  days = 7,
): OccupancyPoint[] {
  return computeOccupancyTrend([lot], sessions, now, days);
}

/**
 * Drops the leading words every name shares, so chart axes carry the part that
 * actually distinguishes a lot ("Estacionamiento Plaza Ñuñoa" -> "Plaza Ñuñoa").
 * Names are returned untouched when they share nothing, or when stripping would
 * leave one of them empty.
 */
export function stripSharedNamePrefix(names: string[]): string[] {
  if (names.length < 2) return [...names];

  const words = names.map((name) => name.trim().split(/\s+/));
  const shortest = Math.min(...words.map((parts) => parts.length));
  let shared = 0;
  while (shared < shortest - 1) {
    const candidate = words[0][shared].toLocaleLowerCase();
    if (!words.every((parts) => parts[shared].toLocaleLowerCase() === candidate)) break;
    shared += 1;
  }

  if (shared === 0) return [...names];
  return words.map((parts) => parts.slice(shared).join(" "));
}

export function formatPercent(rate: number | null, digits = 0): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(digits)}%`;
}

/** Chilean pesos have no minor unit, so amounts are always whole. */
export function formatClp(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/** `null` renders as an em dash; under an hour stays in minutes. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Short UTC label such as `19 Aug` for chart axes. */
export function formatDayLabel(date: string): string {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(parsed));
}
