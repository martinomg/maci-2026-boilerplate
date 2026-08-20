/**
 * Operations-report calculations for a single parking lot.
 *
 * Everything in this module is pure and timezone-explicit: sessions and
 * transactions are bucketed by **UTC calendar day**, the same basis Directus
 * stores the seeded timestamps in. A stay that ends at exactly `00:00:00.000Z`
 * belongs to the day that starts at that instant, never to the previous one.
 *
 * Revenue leakage is the point of the report, so transactions are attributed to
 * the day their session *left the lot*, not the day the money landed. A payment
 * captured minutes after a midnight exit therefore lines up with the exit that
 * produced it, and `exits - transactions` stays readable as "unpaid exits".
 */

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Presets offered by the report UI, in days (inclusive of the anchor day). */
export const RANGE_PRESETS = [7, 30] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const DEFAULT_RANGE_DAYS: RangePreset = 30;
const MAX_RANGE_DAYS = 366;

export type LotRecord = {
  id: string | number;
  name?: string | null;
  city?: string | null;
  address?: string | null;
  capacity?: number | string | null;
  hourly_rate?: number | string | null;
};

type Relation = string | number | { id?: string | number | null } | null | undefined;

export type SessionRecord = {
  id: string | number;
  plate?: string | null;
  entered_at?: string | null;
  exited_at?: string | null;
  parking_lot?: Relation;
};

export type TransactionRecord = {
  id: string | number;
  amount?: number | string | null;
  paid_at?: string | null;
  parking_session?: Relation;
};

/** An inclusive range of UTC day keys (`YYYY-MM-DD`). */
export type DayRange = {
  from: string;
  to: string;
  days: number;
};

export type OccupancyResolution = "hour" | "day";

export type OccupancyPoint = {
  /** ISO timestamp of the bucket start. */
  bucket: string;
  /** Peak number of vehicles on site during the bucket. */
  occupancy: number;
  /** Peak occupancy as a share of capacity, or `null` without a capacity. */
  occupancyRate: number | null;
};

export type OccupancySeries = {
  resolution: OccupancyResolution;
  capacity: number | null;
  points: OccupancyPoint[];
};

export type DailyActivityRow = {
  day: string;
  entries: number;
  exits: number;
  /** Transactions attributed to this day (see module note). */
  transactions: number;
  /** Exits on this day that have at least one transaction. */
  paidExits: number;
  /** Exits on this day with no transaction at all. */
  unpaidExits: number;
};

export type UnpaidExit = {
  sessionId: string | number;
  plate: string | null;
  enteredAt: string;
  exitedAt: string;
  day: string;
  /** Actual stay length in hours. */
  hours: number;
  /** Hours actually billed (started hours round up, minimum one). */
  billedHours: number;
  /** Estimated loss at the lot's hourly rate. */
  amount: number;
};

export type ReportTotals = {
  entries: number;
  exits: number;
  transactions: number;
  paidExits: number;
  unpaidExits: number;
  unpaidAmount: number;
  peakOccupancy: number;
  peakOccupancyRate: number | null;
};

export type OperationsReport = {
  range: DayRange;
  hourlyRate: number;
  capacity: number | null;
  occupancy: OccupancySeries;
  daily: DailyActivityRow[];
  unpaid: UnpaidExit[];
  totals: ReportTotals;
};

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Parses a Directus timestamp into epoch millis, or `null` when unusable. */
export function toTimestamp(value: string | number | Date | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Parses Directus decimal strings such as `"2500.00"`. */
export function toNumber(value: number | string | null | undefined, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Normalizes a Directus many-to-one value to its primary key as a string. */
export function toRelationId(value: Relation): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    return value.id === null || value.id === undefined ? null : String(value.id);
  }
  return String(value);
}

/** UTC day key (`YYYY-MM-DD`) for a timestamp. */
export function toDayKey(value: string | number | Date): string {
  const time = toTimestamp(value);
  if (time === null) throw new RangeError(`Not a usable timestamp: ${String(value)}`);
  return new Date(time).toISOString().slice(0, 10);
}

/** Epoch millis of `00:00:00.000Z` on the given day key. */
export function dayStart(day: string): number {
  const time = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(time)) throw new RangeError(`Not a day key: ${day}`);
  return time;
}

/** Shifts a day key by whole days. */
export function shiftDay(day: string, days: number): string {
  return new Date(dayStart(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Every day key in an inclusive range, oldest first. */
export function eachDay(range: DayRange): string[] {
  const days: string[] = [];
  for (let index = 0; index < range.days; index += 1) {
    days.push(shiftDay(range.from, index));
  }
  return days;
}

/** Half-open millisecond window `[from 00:00Z, to+1d 00:00Z)` for a range. */
export function rangeBounds(range: DayRange): { start: number; end: number } {
  return { start: dayStart(range.from), end: dayStart(range.to) + DAY_MS };
}

function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
}

/* ------------------------------------------------------------------ */
/* Range resolution                                                    */
/* ------------------------------------------------------------------ */

/**
 * Newest activity in a session list, as a day key.
 *
 * Reports anchor on the data rather than on the wall clock so a fixed demo seed
 * keeps showing populated charts however long after seeding it is opened.
 */
export function latestActivityDay(sessions: SessionRecord[]): string | null {
  let latest: number | null = null;
  for (const session of sessions) {
    for (const value of [session.entered_at, session.exited_at]) {
      const time = toTimestamp(value);
      if (time !== null && (latest === null || time > latest)) latest = time;
    }
  }
  return latest === null ? null : toDayKey(latest);
}

export type RangeInput = {
  /** Preset length in days, inclusive of the anchor day. */
  days?: number | string | null;
  /** Explicit `YYYY-MM-DD` bounds; both are required to take effect. */
  from?: string | null;
  to?: string | null;
  /** Newest day with data. Defaults to `today`. */
  anchor?: string | null;
  /** Wall-clock fallback, injectable for tests. */
  today?: string;
};

/**
 * Resolves URL search params into an inclusive day range.
 *
 * An explicit `from`/`to` pair wins; otherwise the range is the last `days`
 * days ending on the anchor day. Anything unparseable falls back to the
 * 30-day default rather than throwing, because these values come from the URL.
 */
export function resolveRange(input: RangeInput = {}): DayRange {
  const from = isDayKey(input.from) ? input.from : null;
  const to = isDayKey(input.to) ? input.to : null;

  if (from && to) {
    const [start, end] = dayStart(from) <= dayStart(to) ? [from, to] : [to, from];
    const span = Math.round((dayStart(end) - dayStart(start)) / DAY_MS) + 1;
    const days = Math.min(span, MAX_RANGE_DAYS);
    return { from: start, to: shiftDay(start, days - 1), days };
  }

  const requested = Math.trunc(toNumber(input.days, DEFAULT_RANGE_DAYS));
  const days = requested > 0 ? Math.min(requested, MAX_RANGE_DAYS) : DEFAULT_RANGE_DAYS;
  const anchor = isDayKey(input.anchor)
    ? input.anchor
    : isDayKey(input.today)
      ? input.today
      : toDayKey(Date.now());

  return { from: shiftDay(anchor, -(days - 1)), to: anchor, days };
}

/** Hourly detail is only legible for short ranges. */
export function resolveResolution(range: DayRange): OccupancyResolution {
  return range.days <= 7 ? "hour" : "day";
}

/* ------------------------------------------------------------------ */
/* Occupancy                                                           */
/* ------------------------------------------------------------------ */

/**
 * Peak concurrent vehicles per bucket across the range.
 *
 * A sweep over entry/exit events keeps this exact: an exit at the boundary is
 * applied before the bucket opens, so a car that leaves at `00:00Z` does not
 * count as occupying the new day.
 */
export function buildOccupancySeries(input: {
  sessions: SessionRecord[];
  range: DayRange;
  capacity?: number | string | null;
  resolution?: OccupancyResolution;
}): OccupancySeries {
  const { range } = input;
  const resolution = input.resolution ?? resolveResolution(range);
  const capacityValue = toNumber(input.capacity, 0);
  const capacity = capacityValue > 0 ? capacityValue : null;
  const step = resolution === "hour" ? HOUR_MS : DAY_MS;
  const { start, end } = rangeBounds(range);

  const events: Array<{ time: number; delta: number }> = [];
  for (const session of input.sessions) {
    const entered = toTimestamp(session.entered_at);
    if (entered === null) continue;
    const exited = toTimestamp(session.exited_at);
    if (exited !== null && exited < entered) continue;
    events.push({ time: entered, delta: 1 });
    if (exited !== null) events.push({ time: exited, delta: -1 });
  }
  // Exits before entries at the same instant: a freed stall is reusable.
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);

  const points: OccupancyPoint[] = [];
  let cursor = 0;
  let current = 0;

  for (let bucketStart = start; bucketStart < end; bucketStart += step) {
    const bucketEnd = bucketStart + step;
    while (cursor < events.length && events[cursor].time <= bucketStart) {
      current += events[cursor].delta;
      cursor += 1;
    }
    let peak = Math.max(current, 0);
    while (cursor < events.length && events[cursor].time < bucketEnd) {
      current += events[cursor].delta;
      cursor += 1;
      if (current > peak) peak = current;
    }
    points.push({
      bucket: new Date(bucketStart).toISOString(),
      occupancy: Math.max(peak, 0),
      occupancyRate: capacity ? Math.max(peak, 0) / capacity : null,
    });
  }

  return { resolution, capacity, points };
}

/* ------------------------------------------------------------------ */
/* Exits, transactions and the unpaid delta                            */
/* ------------------------------------------------------------------ */

/** Session ids that have at least one transaction, and the per-session count. */
function countTransactionsBySession(transactions: TransactionRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const transaction of transactions) {
    const sessionId = toRelationId(transaction.parking_session);
    if (sessionId === null) continue;
    counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Hours actually billed for a stay: started hours round up, minimum one.
 *
 * This is the estimate the report puts on an unpaid exit; the lot's real
 * tariff rules are out of scope for the MVP.
 */
export function billedHours(enteredAt: string, exitedAt: string): number {
  const entered = toTimestamp(enteredAt);
  const exited = toTimestamp(exitedAt);
  if (entered === null || exited === null || exited <= entered) return 1;
  return Math.max(1, Math.ceil((exited - entered) / HOUR_MS));
}

/** Exits inside the range with no transaction, priced at the lot's rate. */
export function listUnpaidExits(input: {
  sessions: SessionRecord[];
  transactions: TransactionRecord[];
  range: DayRange;
  hourlyRate?: number | string | null;
}): UnpaidExit[] {
  const rate = toNumber(input.hourlyRate, 0);
  const paid = countTransactionsBySession(input.transactions);
  const { start, end } = rangeBounds(input.range);
  const unpaid: UnpaidExit[] = [];

  for (const session of input.sessions) {
    const exited = toTimestamp(session.exited_at);
    const entered = toTimestamp(session.entered_at);
    if (exited === null || entered === null) continue;
    if (exited < start || exited >= end) continue;
    if ((paid.get(String(session.id)) ?? 0) > 0) continue;

    const enteredAt = new Date(entered).toISOString();
    const exitedAt = new Date(exited).toISOString();
    const hours = Math.max(exited - entered, 0) / HOUR_MS;
    const billed = billedHours(enteredAt, exitedAt);

    unpaid.push({
      sessionId: session.id,
      plate: session.plate ?? null,
      enteredAt,
      exitedAt,
      day: toDayKey(exited),
      hours,
      billedHours: billed,
      amount: billed * rate,
    });
  }

  return unpaid.sort((a, b) => Date.parse(a.exitedAt) - Date.parse(b.exitedAt));
}

/**
 * Entries, exits, transactions and the unpaid delta for every day in the range.
 *
 * Days without movement are kept as zero rows so the chart keeps a continuous
 * time axis.
 */
export function buildDailyActivity(input: {
  sessions: SessionRecord[];
  transactions: TransactionRecord[];
  range: DayRange;
}): DailyActivityRow[] {
  const { start, end } = rangeBounds(input.range);
  const rows = new Map<string, DailyActivityRow>();
  for (const day of eachDay(input.range)) {
    rows.set(day, { day, entries: 0, exits: 0, transactions: 0, paidExits: 0, unpaidExits: 0 });
  }

  const transactionCounts = countTransactionsBySession(input.transactions);
  /** Exit day of every session, so payments follow the exit they settle. */
  const exitDayBySession = new Map<string, string>();

  for (const session of input.sessions) {
    const entered = toTimestamp(session.entered_at);
    if (entered !== null && entered >= start && entered < end) {
      const row = rows.get(toDayKey(entered));
      if (row) row.entries += 1;
    }

    const exited = toTimestamp(session.exited_at);
    if (exited === null) continue;
    const exitDay = toDayKey(exited);
    exitDayBySession.set(String(session.id), exitDay);
    if (exited < start || exited >= end) continue;

    const row = rows.get(exitDay);
    if (!row) continue;
    row.exits += 1;
    if ((transactionCounts.get(String(session.id)) ?? 0) > 0) {
      row.paidExits += 1;
    } else {
      row.unpaidExits += 1;
    }
  }

  for (const transaction of input.transactions) {
    const sessionId = toRelationId(transaction.parking_session);
    const exitDay = sessionId === null ? undefined : exitDayBySession.get(sessionId);
    const paidAt = toTimestamp(transaction.paid_at);
    // Without a settled exit the payment can only be placed on its own date.
    const day = exitDay ?? (paidAt === null ? null : toDayKey(paidAt));
    if (day === null) continue;
    const row = rows.get(day);
    if (row) row.transactions += 1;
  }

  return eachDay(input.range).map((day) => rows.get(day)!);
}

/* ------------------------------------------------------------------ */
/* Report assembly                                                     */
/* ------------------------------------------------------------------ */

/** Everything the lot report renders, from raw Directus records. */
export function buildOperationsReport(input: {
  lot: Pick<LotRecord, "capacity" | "hourly_rate">;
  sessions: SessionRecord[];
  transactions: TransactionRecord[];
  range: DayRange;
  resolution?: OccupancyResolution;
}): OperationsReport {
  const { lot, sessions, transactions, range } = input;
  const hourlyRate = toNumber(lot.hourly_rate, 0);
  const capacityValue = toNumber(lot.capacity, 0);
  const capacity = capacityValue > 0 ? capacityValue : null;

  const occupancy = buildOccupancySeries({
    sessions,
    range,
    capacity,
    resolution: input.resolution,
  });
  const daily = buildDailyActivity({ sessions, transactions, range });
  const unpaid = listUnpaidExits({ sessions, transactions, range, hourlyRate });

  const totals = daily.reduce<ReportTotals>(
    (accumulator, row) => ({
      entries: accumulator.entries + row.entries,
      exits: accumulator.exits + row.exits,
      transactions: accumulator.transactions + row.transactions,
      paidExits: accumulator.paidExits + row.paidExits,
      unpaidExits: accumulator.unpaidExits + row.unpaidExits,
      unpaidAmount: accumulator.unpaidAmount,
      peakOccupancy: accumulator.peakOccupancy,
      peakOccupancyRate: accumulator.peakOccupancyRate,
    }),
    {
      entries: 0,
      exits: 0,
      transactions: 0,
      paidExits: 0,
      unpaidExits: 0,
      unpaidAmount: 0,
      peakOccupancy: 0,
      peakOccupancyRate: null,
    },
  );

  totals.unpaidAmount = unpaid.reduce((sum, exit) => sum + exit.amount, 0);
  totals.peakOccupancy = occupancy.points.reduce(
    (peak, point) => Math.max(peak, point.occupancy),
    0,
  );
  totals.peakOccupancyRate = capacity ? totals.peakOccupancy / capacity : null;

  return { range, hourlyRate, capacity, occupancy, daily, unpaid, totals };
}

/** Headline numbers for the lot cards on the report index. */
export type LotSummary = {
  lotId: string;
  entries: number;
  exits: number;
  transactions: number;
  unpaidExits: number;
  unpaidAmount: number;
  onSite: number;
  occupancyRate: number | null;
};

/**
 * Per-lot headline numbers for the index page.
 *
 * Sessions carry their lot, transactions only carry their session, so the lot
 * of a payment is resolved through the session map.
 */
export function summarizeLots(input: {
  lots: LotRecord[];
  sessions: SessionRecord[];
  transactions: TransactionRecord[];
  range: DayRange;
  now?: number;
}): Map<string, LotSummary> {
  const lotOfSession = new Map<string, string>();
  const sessionsByLot = new Map<string, SessionRecord[]>();
  for (const session of input.sessions) {
    const lotId = toRelationId(session.parking_lot);
    if (lotId === null) continue;
    lotOfSession.set(String(session.id), lotId);
    const bucket = sessionsByLot.get(lotId);
    if (bucket) bucket.push(session);
    else sessionsByLot.set(lotId, [session]);
  }

  const transactionsByLot = new Map<string, TransactionRecord[]>();
  for (const transaction of input.transactions) {
    const sessionId = toRelationId(transaction.parking_session);
    const lotId = sessionId === null ? undefined : lotOfSession.get(sessionId);
    if (!lotId) continue;
    const bucket = transactionsByLot.get(lotId);
    if (bucket) bucket.push(transaction);
    else transactionsByLot.set(lotId, [transaction]);
  }

  const summaries = new Map<string, LotSummary>();
  for (const lot of input.lots) {
    const lotId = String(lot.id);
    const sessions = sessionsByLot.get(lotId) ?? [];
    const transactions = transactionsByLot.get(lotId) ?? [];
    const report = buildOperationsReport({ lot, sessions, transactions, range: input.range });
    const capacity = report.capacity;
    const onSite = sessions.filter(
      (session) => toTimestamp(session.entered_at) !== null && toTimestamp(session.exited_at) === null,
    ).length;

    summaries.set(lotId, {
      lotId,
      entries: report.totals.entries,
      exits: report.totals.exits,
      transactions: report.totals.transactions,
      unpaidExits: report.totals.unpaidExits,
      unpaidAmount: report.totals.unpaidAmount,
      onSite,
      occupancyRate: capacity ? onSite / capacity : null,
    });
  }

  return summaries;
}
