import { describe, expect, it } from "vitest";
import {
  billedHours,
  buildDailyActivity,
  buildOccupancySeries,
  buildOperationsReport,
  eachDay,
  latestActivityDay,
  listUnpaidExits,
  resolveRange,
  resolveResolution,
  summarizeLots,
  toDayKey,
  toNumber,
  toRelationId,
  type SessionRecord,
  type TransactionRecord,
} from "./reports";

const range = (from: string, to: string) => resolveRange({ from, to });

function session(
  id: string,
  entered: string,
  exited: string | null = null,
  extra: Partial<SessionRecord> = {},
): SessionRecord {
  return { id, entered_at: entered, exited_at: exited, ...extra };
}

function transaction(
  id: string,
  sessionId: string | number | null,
  paidAt: string,
): TransactionRecord {
  return { id, parking_session: sessionId, paid_at: paidAt, amount: "1000.00" };
}

describe("primitives", () => {
  it("parses Directus decimal strings and falls back on junk", () => {
    expect(toNumber("2500.00")).toBe(2500);
    expect(toNumber(null, 7)).toBe(7);
    expect(toNumber("not-a-number", 3)).toBe(3);
  });

  it("normalizes many-to-one values that arrive as ids or objects", () => {
    expect(toRelationId("abc")).toBe("abc");
    expect(toRelationId(12)).toBe("12");
    expect(toRelationId({ id: 12 })).toBe("12");
    expect(toRelationId(null)).toBeNull();
  });

  it("buckets timestamps by UTC day", () => {
    expect(toDayKey("2026-08-19T23:59:59.999Z")).toBe("2026-08-19");
    expect(toDayKey("2026-08-20T00:00:00.000Z")).toBe("2026-08-20");
  });
});

describe("resolveRange", () => {
  it("anchors a preset on the newest day with data, not the wall clock", () => {
    const sessions = [
      session("s1", "2026-08-18T10:00:00.000Z", "2026-08-18T12:00:00.000Z"),
      session("s2", "2026-08-19T16:00:00.000Z"),
    ];
    const anchor = latestActivityDay(sessions);
    expect(anchor).toBe("2026-08-19");

    const resolved = resolveRange({ days: 7, anchor, today: "2027-01-01" });
    expect(resolved).toEqual({ from: "2026-08-13", to: "2026-08-19", days: 7 });
    expect(eachDay(resolved)).toHaveLength(7);
  });

  it("defaults to 30 days and repairs unusable URL values", () => {
    expect(resolveRange({ anchor: "2026-08-19" })).toEqual({
      from: "2026-07-21",
      to: "2026-08-19",
      days: 30,
    });
    expect(resolveRange({ days: "banana", anchor: "2026-08-19" }).days).toBe(30);
    expect(resolveRange({ days: "-4", anchor: "2026-08-19" }).days).toBe(30);
    expect(resolveRange({ from: "nope", to: "2026-08-19", anchor: "2026-08-19" }).days).toBe(30);
  });

  it("honours an explicit range and swaps reversed bounds", () => {
    expect(range("2026-08-01", "2026-08-03")).toEqual({
      from: "2026-08-01",
      to: "2026-08-03",
      days: 3,
    });
    expect(range("2026-08-03", "2026-08-01")).toEqual({
      from: "2026-08-01",
      to: "2026-08-03",
      days: 3,
    });
  });

  it("uses hourly detail for short ranges only", () => {
    expect(resolveResolution(range("2026-08-13", "2026-08-19"))).toBe("hour");
    expect(resolveResolution(range("2026-07-21", "2026-08-19"))).toBe("day");
  });

  it("falls back to today when there is no data to anchor on", () => {
    expect(latestActivityDay([])).toBeNull();
    expect(resolveRange({ days: 7, anchor: null, today: "2026-05-10" })).toEqual({
      from: "2026-05-04",
      to: "2026-05-10",
      days: 7,
    });
  });
});

describe("buildDailyActivity", () => {
  it("counts entries, exits and transactions per day and keeps empty days", () => {
    const sessions = [
      session("s1", "2026-08-13T08:00:00.000Z", "2026-08-13T10:00:00.000Z"),
      session("s2", "2026-08-13T09:00:00.000Z", "2026-08-15T11:00:00.000Z"),
      session("s3", "2026-08-15T09:00:00.000Z"),
    ];
    const transactions = [transaction("t1", "s1", "2026-08-13T10:05:00.000Z")];

    const rows = buildDailyActivity({
      sessions,
      transactions,
      range: range("2026-08-13", "2026-08-15"),
    });

    expect(rows.map((row) => row.day)).toEqual(["2026-08-13", "2026-08-14", "2026-08-15"]);
    expect(rows[0]).toMatchObject({ entries: 2, exits: 1, transactions: 1, paidExits: 1, unpaidExits: 0 });
    expect(rows[1]).toMatchObject({ entries: 0, exits: 0, transactions: 0, unpaidExits: 0 });
    expect(rows[2]).toMatchObject({ entries: 1, exits: 1, transactions: 0, unpaidExits: 1 });
  });

  it("keeps exits and unpaid deltas reconcilable: exits = transactions + delta", () => {
    const sessions = [
      session("s1", "2026-08-15T08:00:00.000Z", "2026-08-15T10:00:00.000Z"),
      session("s2", "2026-08-15T08:30:00.000Z", "2026-08-15T12:00:00.000Z"),
      session("s3", "2026-08-15T09:00:00.000Z", "2026-08-15T13:00:00.000Z"),
    ];
    const transactions = [transaction("t1", "s1", "2026-08-15T10:01:00.000Z")];

    const [row] = buildDailyActivity({
      sessions,
      transactions,
      range: range("2026-08-15", "2026-08-15"),
    });

    expect(row.exits).toBe(3);
    expect(row.transactions).toBe(1);
    expect(row.unpaidExits).toBe(2);
    expect(row.exits - row.transactions).toBe(row.unpaidExits);
  });

  describe("midnight bucketing", () => {
    it("puts an exit at exactly 00:00Z on the day that starts then", () => {
      const sessions = [session("s1", "2026-08-14T22:00:00.000Z", "2026-08-15T00:00:00.000Z")];

      const rows = buildDailyActivity({
        sessions,
        transactions: [],
        range: range("2026-08-14", "2026-08-15"),
      });

      expect(rows[0]).toMatchObject({ day: "2026-08-14", entries: 1, exits: 0 });
      expect(rows[1]).toMatchObject({ day: "2026-08-15", entries: 0, exits: 1, unpaidExits: 1 });
    });

    it("attributes a payment settled after midnight to the exit day", () => {
      const sessions = [session("s1", "2026-08-14T21:00:00.000Z", "2026-08-14T23:58:00.000Z")];
      const transactions = [transaction("t1", "s1", "2026-08-15T00:03:00.000Z")];

      const rows = buildDailyActivity({
        sessions,
        transactions,
        range: range("2026-08-14", "2026-08-15"),
      });

      expect(rows[0]).toMatchObject({ day: "2026-08-14", exits: 1, transactions: 1, unpaidExits: 0 });
      expect(rows[1]).toMatchObject({ day: "2026-08-15", exits: 0, transactions: 0 });
    });

    it("drops an exit one millisecond past the end of the range", () => {
      const sessions = [
        session("s1", "2026-08-15T22:00:00.000Z", "2026-08-15T23:59:59.999Z"),
        session("s2", "2026-08-15T22:00:00.000Z", "2026-08-16T00:00:00.000Z"),
      ];

      const rows = buildDailyActivity({
        sessions,
        transactions: [],
        range: range("2026-08-15", "2026-08-15"),
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].exits).toBe(1);
    });

    it("places an unlinked payment on its own paid_at day", () => {
      const rows = buildDailyActivity({
        sessions: [],
        transactions: [transaction("t1", null, "2026-08-15T09:00:00.000Z")],
        range: range("2026-08-15", "2026-08-15"),
      });

      expect(rows[0].transactions).toBe(1);
    });
  });
});

describe("buildOccupancySeries", () => {
  it("reports the peak concurrent vehicles per hourly bucket", () => {
    const sessions = [
      session("s1", "2026-08-15T00:30:00.000Z", "2026-08-15T02:30:00.000Z"),
      session("s2", "2026-08-15T01:10:00.000Z", "2026-08-15T01:50:00.000Z"),
    ];

    const series = buildOccupancySeries({
      sessions,
      range: range("2026-08-15", "2026-08-15"),
      capacity: 4,
      resolution: "hour",
    });

    expect(series.resolution).toBe("hour");
    expect(series.points).toHaveLength(24);
    expect(series.points[0]).toMatchObject({ bucket: "2026-08-15T00:00:00.000Z", occupancy: 1 });
    expect(series.points[1].occupancy).toBe(2);
    expect(series.points[1].occupancyRate).toBe(0.5);
    expect(series.points[2].occupancy).toBe(1);
    expect(series.points[3].occupancy).toBe(0);
  });

  it("frees the stall at the exit instant, including at midnight", () => {
    const sessions = [session("s1", "2026-08-14T23:00:00.000Z", "2026-08-15T00:00:00.000Z")];

    const series = buildOccupancySeries({
      sessions,
      range: range("2026-08-14", "2026-08-15"),
      capacity: 2,
      resolution: "day",
    });

    expect(series.points).toHaveLength(2);
    expect(series.points[0].occupancy).toBe(1);
    expect(series.points[1].occupancy).toBe(0);
  });

  it("keeps open sessions occupying the lot and carries them across buckets", () => {
    const sessions = [session("s1", "2026-08-13T10:00:00.000Z")];

    const series = buildOccupancySeries({
      sessions,
      range: range("2026-08-13", "2026-08-16"),
      capacity: 0,
      resolution: "day",
    });

    expect(series.capacity).toBeNull();
    expect(series.points.map((point) => point.occupancy)).toEqual([1, 1, 1, 1]);
    expect(series.points[0].occupancyRate).toBeNull();
  });

  it("ignores sessions with no entry or with an exit before the entry", () => {
    const series = buildOccupancySeries({
      sessions: [
        session("s1", "", "2026-08-15T10:00:00.000Z"),
        session("s2", "2026-08-15T12:00:00.000Z", "2026-08-15T08:00:00.000Z"),
      ],
      range: range("2026-08-15", "2026-08-15"),
      resolution: "day",
    });

    expect(series.points[0].occupancy).toBe(0);
  });
});

describe("unpaid exits", () => {
  it("bills started hours with a one-hour minimum", () => {
    expect(billedHours("2026-08-15T10:00:00.000Z", "2026-08-15T10:20:00.000Z")).toBe(1);
    expect(billedHours("2026-08-15T10:00:00.000Z", "2026-08-15T12:00:00.000Z")).toBe(2);
    expect(billedHours("2026-08-15T10:00:00.000Z", "2026-08-15T12:12:00.000Z")).toBe(3);
  });

  it("prices only the exits without a transaction", () => {
    const sessions = [
      session("s1", "2026-08-15T15:30:00.000Z", "2026-08-15T17:42:00.000Z", { plate: "VSXL83" }),
      session("s2", "2026-08-15T08:00:00.000Z", "2026-08-15T09:00:00.000Z", { plate: "PAID01" }),
      session("s3", "2026-08-15T08:00:00.000Z"),
    ];
    const transactions = [transaction("t1", "s2", "2026-08-15T09:02:00.000Z")];

    const unpaid = listUnpaidExits({
      sessions,
      transactions,
      range: range("2026-08-15", "2026-08-15"),
      hourlyRate: "2500.00",
    });

    expect(unpaid).toHaveLength(1);
    expect(unpaid[0]).toMatchObject({
      sessionId: "s1",
      plate: "VSXL83",
      day: "2026-08-15",
      billedHours: 3,
      amount: 7500,
    });
    expect(unpaid[0].hours).toBeCloseTo(2.2, 5);
  });
});

describe("buildOperationsReport", () => {
  const sessions = [
    session("s1", "2026-08-14T08:00:00.000Z", "2026-08-14T10:00:00.000Z"),
    session("s2", "2026-08-15T15:30:00.000Z", "2026-08-15T17:42:00.000Z"),
    session("s3", "2026-08-15T09:00:00.000Z", "2026-08-15T11:00:00.000Z"),
    session("s4", "2026-08-16T09:00:00.000Z"),
  ];
  const transactions = [
    transaction("t1", "s1", "2026-08-14T10:01:00.000Z"),
    transaction("t2", "s3", "2026-08-15T11:03:00.000Z"),
  ];

  it("totals exits, transactions and the estimated leak", () => {
    const report = buildOperationsReport({
      lot: { capacity: 10, hourly_rate: "2500.00" },
      sessions,
      transactions,
      range: range("2026-08-14", "2026-08-16"),
    });

    expect(report.totals).toMatchObject({
      entries: 4,
      exits: 3,
      transactions: 2,
      paidExits: 2,
      unpaidExits: 1,
      unpaidAmount: 7500,
      peakOccupancy: 1,
    });
    expect(report.totals.peakOccupancyRate).toBeCloseTo(0.1, 5);
    expect(report.unpaid.map((exit) => exit.sessionId)).toEqual(["s2"]);
    expect(report.daily).toHaveLength(3);
  });

  it("re-renders consistently when the range shrinks", () => {
    const narrow = buildOperationsReport({
      lot: { capacity: 10, hourly_rate: "2500.00" },
      sessions,
      transactions,
      range: range("2026-08-16", "2026-08-16"),
    });

    expect(narrow.daily).toHaveLength(1);
    expect(narrow.totals).toMatchObject({ entries: 1, exits: 0, transactions: 0, unpaidExits: 0, unpaidAmount: 0 });
    expect(narrow.occupancy.resolution).toBe("hour");
    expect(narrow.occupancy.points).toHaveLength(24);
  });

  it("survives a lot without capacity or rate", () => {
    const report = buildOperationsReport({
      lot: { capacity: null, hourly_rate: null },
      sessions,
      transactions,
      range: range("2026-08-14", "2026-08-16"),
    });

    expect(report.capacity).toBeNull();
    expect(report.totals.peakOccupancyRate).toBeNull();
    expect(report.totals.unpaidAmount).toBe(0);
  });
});

describe("summarizeLots", () => {
  it("splits sessions and payments per lot and counts vehicles still on site", () => {
    const lots = [
      { id: "lot-a", capacity: 4, hourly_rate: "1000.00" },
      { id: "lot-b", capacity: 10, hourly_rate: "2000.00" },
      { id: "lot-c", capacity: 5, hourly_rate: "500.00" },
    ];
    const sessions = [
      session("s1", "2026-08-15T08:00:00.000Z", "2026-08-15T09:00:00.000Z", { parking_lot: "lot-a" }),
      session("s2", "2026-08-15T08:00:00.000Z", "2026-08-15T10:30:00.000Z", { parking_lot: "lot-a" }),
      session("s3", "2026-08-15T08:00:00.000Z", null, { parking_lot: "lot-a" }),
      session("s4", "2026-08-15T08:00:00.000Z", "2026-08-15T09:00:00.000Z", {
        parking_lot: { id: "lot-b" },
      }),
    ];
    const transactions = [
      transaction("t1", "s1", "2026-08-15T09:01:00.000Z"),
      transaction("t2", "s4", "2026-08-15T09:01:00.000Z"),
    ];

    const summaries = summarizeLots({
      lots,
      sessions,
      transactions,
      range: range("2026-08-15", "2026-08-15"),
    });

    expect(summaries.get("lot-a")).toMatchObject({
      entries: 3,
      exits: 2,
      transactions: 1,
      unpaidExits: 1,
      unpaidAmount: 3000,
      onSite: 1,
      occupancyRate: 0.25,
    });
    expect(summaries.get("lot-b")).toMatchObject({ exits: 1, transactions: 1, unpaidExits: 0, onSite: 0 });
    expect(summaries.get("lot-c")).toMatchObject({ entries: 0, exits: 0, unpaidAmount: 0, onSite: 0 });
  });
});
