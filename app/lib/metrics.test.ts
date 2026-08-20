import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeAverageStayByLot,
  computeAverageStayMinutes,
  computeCitywideOccupancy,
  computeLotOccupancy,
  computeLotOccupancyTrend,
  computeOccupancyTrend,
  computeRevenue,
  formatClp,
  formatMinutes,
  formatPercent,
  isSessionActiveAt,
  occupancyBand,
  sessionLotId,
  stripSharedNamePrefix,
  toNumber,
  toTimestamp,
  type ParkingLotRecord,
  type ParkingSessionRecord,
  type ParkingTransactionRecord,
} from "./metrics";

const NOW = "2026-08-19T12:00:00.000Z";

const lots: ParkingLotRecord[] = [
  { id: "busy", name: "Busy lot", capacity: 10 },
  { id: "quiet", name: "Quiet lot", capacity: "10" },
  { id: "empty", name: "Empty lot", capacity: 8 },
  { id: "no-capacity", name: "Unmeasured lot", capacity: 0 },
];

const sessions: ParkingSessionRecord[] = [
  // Nine open sessions in the busy lot -> 90%.
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `busy-open-${index}`,
    parking_lot: "busy",
    entered_at: "2026-08-19T08:00:00.000Z",
    exited_at: null,
  })),
  // Two open sessions in the quiet lot -> 20%.
  { id: "quiet-open-1", parking_lot: "quiet", entered_at: "2026-08-19T09:00:00.000Z", exited_at: null },
  { id: "quiet-open-2", parking_lot: { id: "quiet" }, entered_at: "2026-08-19T10:00:00.000Z", exited_at: null },
  // Closed sessions: 120 and 60 minutes.
  { id: "quiet-closed-1", parking_lot: "quiet", entered_at: "2026-08-19T06:00:00.000Z", exited_at: "2026-08-19T08:00:00.000Z" },
  { id: "busy-closed-1", parking_lot: "busy", entered_at: "2026-08-19T05:00:00.000Z", exited_at: "2026-08-19T06:00:00.000Z" },
  // Not started yet at NOW.
  { id: "future", parking_lot: "busy", entered_at: "2026-08-19T18:00:00.000Z", exited_at: null },
  // Unusable rows the calculations must survive.
  { id: "no-lot", parking_lot: null, entered_at: "2026-08-19T07:00:00.000Z", exited_at: null },
  { id: "no-entry", parking_lot: "busy", entered_at: null, exited_at: null },
  { id: "exit-before-entry", parking_lot: "busy", entered_at: "2026-08-19T09:00:00.000Z", exited_at: "2026-08-19T08:00:00.000Z" },
];

const transactions: ParkingTransactionRecord[] = [
  { id: "t1", amount: "2500.00", currency: "CLP", paid_at: "2026-08-19T11:00:00.000Z" },
  { id: "t2", amount: 1200, currency: "CLP", paid_at: "2026-08-15T11:00:00.000Z" },
  { id: "t3", amount: "900.50", currency: "CLP", paid_at: "2026-08-13T11:00:00.000Z" },
  // Outside the 7-day window.
  { id: "t4", amount: "10000.00", currency: "CLP", paid_at: "2026-08-01T11:00:00.000Z" },
  // Unpaid and malformed rows.
  { id: "t5", amount: "5000.00", currency: "CLP", paid_at: null },
  { id: "t6", amount: null, currency: "CLP", paid_at: "2026-08-19T11:30:00.000Z" },
];

describe("value normalisation", () => {
  it("parses Directus decimal strings and rejects junk", () => {
    expect(toNumber("2500.00")).toBe(2500);
    expect(toNumber(42)).toBe(42);
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });

  it("parses timestamps and rejects unusable values", () => {
    expect(toTimestamp("2026-08-19T12:00:00.000Z")).toBe(Date.parse(NOW));
    expect(toTimestamp(new Date(NOW))).toBe(Date.parse(NOW));
    expect(toTimestamp(null)).toBeNull();
    expect(toTimestamp("not a date")).toBeNull();
  });

  it("reads the lot id from both relation shapes", () => {
    expect(sessionLotId({ parking_lot: "busy" })).toBe("busy");
    expect(sessionLotId({ parking_lot: { id: "busy" } })).toBe("busy");
    expect(sessionLotId({ parking_lot: null })).toBeNull();
    expect(sessionLotId({})).toBeNull();
  });
});

describe("isSessionActiveAt", () => {
  const at = Date.parse(NOW);

  it("counts an open session from its entry onwards", () => {
    expect(isSessionActiveAt({ entered_at: "2026-08-19T08:00:00.000Z", exited_at: null }, at)).toBe(true);
    expect(isSessionActiveAt({ entered_at: "2026-08-19T18:00:00.000Z", exited_at: null }, at)).toBe(false);
  });

  it("stops counting a session once it has exited", () => {
    expect(isSessionActiveAt({ entered_at: "2026-08-19T08:00:00.000Z", exited_at: "2026-08-19T11:00:00.000Z" }, at)).toBe(false);
    expect(isSessionActiveAt({ entered_at: "2026-08-19T08:00:00.000Z", exited_at: "2026-08-19T13:00:00.000Z" }, at)).toBe(true);
  });
});

describe("computeLotOccupancy", () => {
  const result = computeLotOccupancy(lots, sessions, NOW);
  const byId = Object.fromEntries(result.map((lot) => [lot.lotId, lot]));

  it("divides open sessions by capacity", () => {
    expect(byId.busy.occupied).toBe(9);
    expect(byId.busy.rate).toBeCloseTo(0.9, 10);
    expect(byId.busy.band).toBe("high");
  });

  it("keeps a low band under 30 percent", () => {
    expect(byId.quiet.occupied).toBe(2);
    expect(byId.quiet.rate).toBeCloseTo(0.2, 10);
    expect(byId.quiet.band).toBe("low");
  });

  it("reports an empty lot as zero rather than unknown", () => {
    expect(byId.empty.occupied).toBe(0);
    expect(byId.empty.rate).toBe(0);
    expect(byId.empty.band).toBe("low");
  });

  it("returns a null rate instead of dividing by zero capacity", () => {
    expect(byId["no-capacity"].capacity).toBe(0);
    expect(byId["no-capacity"].rate).toBeNull();
    expect(byId["no-capacity"].band).toBeNull();
  });

  it("survives sessions with no lot or no entry timestamp", () => {
    expect(result.reduce((total, lot) => total + lot.occupied, 0)).toBe(11);
  });
});

describe("computeCitywideOccupancy", () => {
  it("aggregates open sessions over total capacity", () => {
    const citywide = computeCitywideOccupancy(lots, sessions, NOW);
    expect(citywide.lots).toBe(4);
    expect(citywide.capacity).toBe(28);
    expect(citywide.occupied).toBe(11);
    expect(citywide.rate).toBeCloseTo(11 / 28, 10);
  });

  it("returns a null rate when nothing has capacity", () => {
    const citywide = computeCitywideOccupancy(
      [{ id: "x", name: "X", capacity: null }],
      sessions,
      NOW,
    );
    expect(citywide.capacity).toBe(0);
    expect(citywide.rate).toBeNull();
  });

  it("returns a null rate with no lots at all", () => {
    expect(computeCitywideOccupancy([], [], NOW).rate).toBeNull();
  });
});

describe("computeAverageStayMinutes", () => {
  it("averages closed sessions only and ignores open ones", () => {
    expect(computeAverageStayMinutes(sessions)).toBe(90);
  });

  it("returns null when every session is still open", () => {
    const openOnly = sessions.filter((session) => session.exited_at === null);
    expect(computeAverageStayMinutes(openOnly)).toBeNull();
  });

  it("returns null for an empty lot with no sessions", () => {
    expect(computeAverageStayMinutes([])).toBeNull();
    expect(computeAverageStayMinutes(sessions, { lotId: "empty" })).toBeNull();
  });

  it("restricts to a lot and to an exit window", () => {
    expect(computeAverageStayMinutes(sessions, { lotId: "quiet" })).toBe(120);
    expect(
      computeAverageStayMinutes(sessions, { since: "2026-08-19T07:00:00.000Z" }),
    ).toBe(120);
  });
});

describe("computeAverageStayByLot", () => {
  const byLot = computeAverageStayByLot(lots, sessions);
  const byId = Object.fromEntries(byLot.map((lot) => [lot.lotId, lot]));

  it("reports per-lot means", () => {
    expect(byId.quiet.averageStayMinutes).toBe(120);
    expect(byId.quiet.closedSessions).toBe(1);
    expect(byId.busy.averageStayMinutes).toBe(60);
  });

  it("keeps an empty lot as null instead of zero", () => {
    expect(byId.empty.averageStayMinutes).toBeNull();
    expect(byId.empty.closedSessions).toBe(0);
  });
});

describe("computeRevenue", () => {
  it("sums paid transactions inside the trailing window", () => {
    expect(computeRevenue(transactions, { now: NOW, days: 7 })).toBeCloseTo(4600.5, 6);
  });

  it("widens with the window", () => {
    expect(computeRevenue(transactions, { now: NOW, days: 30 })).toBeCloseTo(14600.5, 6);
  });

  it("is zero with no transactions", () => {
    expect(computeRevenue([], { now: NOW, days: 7 })).toBe(0);
  });
});

describe("occupancy trend", () => {
  it("returns one point per day ending today", () => {
    const trend = computeOccupancyTrend(lots, sessions, NOW, 7);
    expect(trend).toHaveLength(7);
    expect(trend[0].date).toBe("2026-08-13");
    expect(trend[6].date).toBe("2026-08-19");
    expect(trend[6].occupied).toBe(11);
    expect(trend[6].rate).toBeCloseTo(11 / 28, 10);
    expect(trend[0].occupied).toBe(0);
  });

  it("samples a single lot for the sparkline", () => {
    const trend = computeLotOccupancyTrend(lots[0], sessions, NOW, 3);
    expect(trend).toHaveLength(3);
    expect(trend[2].occupied).toBe(9);
    expect(trend[2].capacity).toBe(10);
  });

  it("keeps null rates for a lot with no capacity", () => {
    const trend = computeLotOccupancyTrend(lots[3], sessions, NOW, 2);
    expect(trend.every((point) => point.rate === null)).toBe(true);
  });
});

describe("bands and formatting", () => {
  it("maps rates to bands", () => {
    expect(occupancyBand(0.95)).toBe("high");
    expect(occupancyBand(0.8)).toBe("high");
    expect(occupancyBand(0.65)).toBe("elevated");
    expect(occupancyBand(0.3)).toBe("moderate");
    expect(occupancyBand(0.29)).toBe("low");
    expect(occupancyBand(0)).toBe("low");
    expect(occupancyBand(null)).toBeNull();
  });

  it("strips only the words every lot name shares", () => {
    expect(
      stripSharedNamePrefix([
        "Estacionamiento Plaza de Armas",
        "Estacionamiento Plaza Ñuñoa",
        "Estacionamiento Los Leones",
      ]),
    ).toEqual(["Plaza de Armas", "Plaza Ñuñoa", "Los Leones"]);
    expect(stripSharedNamePrefix(["Alpha lot", "Beta lot"])).toEqual([
      "Alpha lot",
      "Beta lot",
    ]);
    expect(stripSharedNamePrefix(["Only one"])).toEqual(["Only one"]);
    expect(stripSharedNamePrefix([])).toEqual([]);
    // Never strips a name down to nothing.
    expect(stripSharedNamePrefix(["Lot A", "Lot A B"])).toEqual(["A", "A B"]);
  });

  it("formats percents, pesos and durations", () => {
    expect(formatPercent(0.851)).toBe("85%");
    expect(formatPercent(null)).toBe("—");
    expect(formatClp(1234567)).toContain("1.234.567");
    expect(formatClp(null)).toBe("—");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(null)).toBe("—");
  });
});

/**
 * Guards the acceptance criteria of issue #13 against the versioned seed:
 * Costanera Center must land above the 80% band and Ñuñoa below 30%.
 */
describe("seeded Santiago data", () => {
  type SeedFile<T> = { data: T[] };

  function readSeed<T>(name: string): T[] {
    const url = new URL(`../../api/directus-config/seed/${name}`, import.meta.url);
    return (JSON.parse(readFileSync(url, "utf8")) as SeedFile<T>).data;
  }

  // The seed uses `_sync_id` as the stable key, which stands in for the
  // Directus uuid the API returns at runtime.
  type SeedLot = ParkingLotRecord & { _sync_id: string };
  type SeedSession = ParkingSessionRecord & { _sync_id: string };

  const seedNow = "2026-08-19T23:59:00.000Z";
  const seedLots = readSeed<SeedLot>("parking_lots.json").map((lot) => ({
    ...lot,
    id: lot._sync_id,
  }));
  const seedSessions = readSeed<SeedSession>("parking_sessions.json");
  const seedTransactions = readSeed<ParkingTransactionRecord>(
    "parking_transactions.json",
  );

  const occupancy = computeLotOccupancy(seedLots, seedSessions, seedNow);
  const byId = Object.fromEntries(occupancy.map((lot) => [lot.lotId, lot]));

  it("puts Costanera Center in the high band above 80 percent", () => {
    const costanera = byId["parking-lot-costanera-center"];
    expect(costanera.capacity).toBe(60);
    expect(costanera.rate).not.toBeNull();
    expect(costanera.rate!).toBeGreaterThan(0.8);
    expect(costanera.band).toBe("high");
  });

  it("puts Ñuñoa in the low band below 30 percent", () => {
    const nunoa = byId["parking-lot-nunoa"];
    expect(nunoa.capacity).toBe(45);
    expect(nunoa.rate).not.toBeNull();
    expect(nunoa.rate!).toBeLessThan(0.3);
    expect(nunoa.band).toBe("low");
  });

  it("reports five lots and a citywide rate between the extremes", () => {
    const citywide = computeCitywideOccupancy(seedLots, seedSessions, seedNow);
    expect(citywide.lots).toBe(5);
    expect(citywide.capacity).toBe(199);
    expect(citywide.occupied).toBe(102);
    expect(citywide.rate!).toBeGreaterThan(byId["parking-lot-nunoa"].rate!);
    expect(citywide.rate!).toBeLessThan(byId["parking-lot-costanera-center"].rate!);
  });

  it("derives a plausible average stay and 7-day revenue", () => {
    const averageStay = computeAverageStayMinutes(seedSessions);
    expect(averageStay).not.toBeNull();
    expect(averageStay!).toBeGreaterThan(30);
    expect(averageStay!).toBeLessThan(24 * 60);

    const revenue = computeRevenue(seedTransactions, { now: seedNow, days: 7 });
    expect(revenue).toBeGreaterThan(0);
    expect(revenue).toBeLessThan(
      computeRevenue(seedTransactions, { now: seedNow, days: 30 }),
    );
  });
});
