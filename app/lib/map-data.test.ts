import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMapLots,
  fetchMapLots,
  getMapCenter,
  normalizeOpenSessionCounts,
  toFiniteNumber,
  toOccupancyBand,
  type MapLot,
  type ParkingLotRow,
} from "./map-data";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function lot(overrides: Partial<ParkingLotRow> & { id: string }): ParkingLotRow {
  return {
    name: "Lot",
    city: "Santiago",
    address: "Somewhere",
    latitude: "-33.4372000",
    longitude: "-70.6506000",
    capacity: 30,
    hourly_rate: "1200.00",
    ...overrides,
  };
}

describe("toFiniteNumber", () => {
  it("parses the numeric strings Directus returns for decimal columns", () => {
    expect(toFiniteNumber("-33.4372000")).toBeCloseTo(-33.4372, 7);
    expect(toFiniteNumber("2500.00")).toBe(2500);
    expect(toFiniteNumber(42)).toBe(42);
  });

  it("rejects blank, non-numeric and non-finite values", () => {
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(undefined)).toBeNull();
    expect(toFiniteNumber("")).toBeNull();
    expect(toFiniteNumber("   ")).toBeNull();
    expect(toFiniteNumber("not a number")).toBeNull();
    expect(toFiniteNumber(Number.NaN)).toBeNull();
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("toOccupancyBand", () => {
  it("maps ratios to the documented green / yellow / red bands", () => {
    expect(toOccupancyBand(0)).toBe("low");
    expect(toOccupancyBand(0.2)).toBe("low");
    expect(toOccupancyBand(0.299)).toBe("low");
    expect(toOccupancyBand(0.3)).toBe("moderate");
    expect(toOccupancyBand(0.5)).toBe("moderate");
    expect(toOccupancyBand(0.8)).toBe("moderate");
    expect(toOccupancyBand(0.801)).toBe("high");
    expect(toOccupancyBand(1)).toBe("high");
  });
});

describe("normalizeOpenSessionCounts", () => {
  it("reads Directus count aggregates, which arrive as nested strings", () => {
    expect(
      normalizeOpenSessionCounts([
        { parking_lot: "a", count: { id: "51" } },
        { parking_lot: "b", count: { id: 9 } },
      ]),
    ).toEqual({ a: 51, b: 9 });
  });

  it("tolerates flat counts, missing lots and unusable values", () => {
    expect(
      normalizeOpenSessionCounts([
        { parking_lot: "flat", count: "7" },
        { parking_lot: null, count: { id: "3" } },
        { parking_lot: "empty", count: { id: null } },
      ]),
    ).toEqual({ flat: 7, empty: 0 });
  });
});

describe("buildMapLots", () => {
  it("computes occupancy from open sessions over capacity and sorts by pressure", () => {
    const result = buildMapLots(
      [
        lot({ id: "nunoa", name: "Plaza Ñuñoa", capacity: 45 }),
        lot({ id: "costanera", name: "Costanera Center", capacity: 60 }),
      ],
      { nunoa: 9, costanera: 51 },
    );

    expect(result.map((entry) => entry.id)).toEqual(["costanera", "nunoa"]);
    expect(result[0]).toMatchObject({
      openSessions: 51,
      capacity: 60,
      occupancyPercent: 85,
      band: "high",
    });
    expect(result[1]).toMatchObject({
      openSessions: 9,
      capacity: 45,
      occupancyPercent: 20,
      band: "low",
    });
  });

  it("treats a lot with no open sessions as empty rather than unknown", () => {
    const [entry] = buildMapLots([lot({ id: "quiet", capacity: 20 })], {});
    expect(entry).toMatchObject({ openSessions: 0, occupancy: 0, band: "low" });
  });

  it("parses coordinates and hourly rate from their string representations", () => {
    const [entry] = buildMapLots(
      [lot({ id: "plaza", latitude: "-33.4372000", longitude: "-70.6506000" })],
      { plaza: 14 },
    );
    expect(entry.latitude).toBeCloseTo(-33.4372, 7);
    expect(entry.longitude).toBeCloseTo(-70.6506, 7);
    expect(entry.hourlyRate).toBe(1200);
    expect(entry.band).toBe("moderate");
  });

  it("skips lots that cannot be plotted or measured", () => {
    expect(
      buildMapLots(
        [
          lot({ id: "no-latitude", latitude: null }),
          lot({ id: "no-longitude", longitude: null }),
          lot({ id: "out-of-range", latitude: "120" }),
          lot({ id: "no-capacity", capacity: null }),
          lot({ id: "zero-capacity", capacity: 0 }),
        ],
        {},
      ),
    ).toEqual([]);
  });

  it("clamps occupancy when a lot reports more open sessions than capacity", () => {
    const [entry] = buildMapLots([lot({ id: "over", capacity: 10 })], { over: 14 });
    expect(entry.occupancy).toBe(1);
    expect(entry.occupancyPercent).toBe(100);
    expect(entry.band).toBe("high");
  });
});

describe("getMapCenter", () => {
  it("averages the plotted lots", () => {
    const lots = [
      { latitude: -33.4, longitude: -70.6 },
      { latitude: -33.6, longitude: -70.8 },
    ] as MapLot[];
    const center = getMapCenter(lots, { latitude: 0, longitude: 0 });
    expect(center.latitude).toBeCloseTo(-33.5, 7);
    expect(center.longitude).toBeCloseTo(-70.7, 7);
  });

  it("falls back when nothing can be plotted", () => {
    const fallback = { latitude: -33.45, longitude: -70.66 };
    expect(getMapCenter([], fallback)).toEqual(fallback);
  });
});

describe("fetchMapLots", () => {
  it("requests published lots and open sessions, then merges them", async () => {
    vi.stubEnv("DIRECTUS_SERVICE_TOKEN", "test-token");
    vi.stubEnv("DIRECTUS_INTERNAL_URL", "http://directus.test");

    const requested: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        requested.push(url.toString());
        const data = url.pathname.includes("parking_lots")
          ? [lot({ id: "costanera", name: "Costanera Center", capacity: 60 })]
          : [{ parking_lot: "costanera", count: { id: "51" } }];
        return { ok: true, json: async () => ({ data }) } as Response;
      }),
    );

    const result = await fetchMapLots();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Costanera Center", occupancyPercent: 85 });

    const lotsRequest = requested.find((entry) => entry.includes("parking_lots"));
    const sessionsRequest = requested.find((entry) => entry.includes("parking_sessions"));
    expect(lotsRequest).toContain(encodeURIComponent('{"status":{"_eq":"published"}}'));
    expect(sessionsRequest).toContain("groupBy=parking_lot");
    expect(sessionsRequest).toContain(encodeURIComponent('{"exited_at":{"_null":true}}'));
  });
});
