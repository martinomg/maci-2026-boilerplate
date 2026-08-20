import { describe, expect, it } from "vitest";
import {
  buildLayoutStatus,
  formatElapsed,
  hasLayoutWarnings,
  type ParkingSessionRecord,
  type ParkingSpotRecord,
} from "./layout-status";

const NOW = new Date("2026-08-19T12:00:00.000Z");

function spot(overrides: Partial<ParkingSpotRecord> & { id: string }): ParkingSpotRecord {
  return {
    code: overrides.id.toUpperCase(),
    type: "standard",
    status: "available",
    svg_element_id: `spot-${overrides.id}`,
    ...overrides,
  };
}

function session(
  overrides: Partial<ParkingSessionRecord> & { id: string },
): ParkingSessionRecord {
  return {
    plate: "ABCD12",
    entered_at: "2026-08-19T09:30:00.000Z",
    exited_at: null,
    parking_spot: null,
    ...overrides,
  };
}

describe("formatElapsed", () => {
  it("renders minutes, hours and days", () => {
    expect(formatElapsed("2026-08-19T11:38:00.000Z", NOW)).toBe("22 min");
    expect(formatElapsed("2026-08-19T09:30:00.000Z", NOW)).toBe("2 h 30 min");
    expect(formatElapsed("2026-08-19T10:00:00.000Z", NOW)).toBe("2 h");
    expect(formatElapsed("2026-08-17T09:00:00.000Z", NOW)).toBe("2 d 3 h");
    expect(formatElapsed("2026-08-17T12:00:00.000Z", NOW)).toBe("2 d");
  });

  it("degrades safely on missing or future timestamps", () => {
    expect(formatElapsed(null, NOW)).toBeNull();
    expect(formatElapsed("not-a-date", NOW)).toBeNull();
    expect(formatElapsed("2026-08-19T12:30:00.000Z", NOW)).toBe("just now");
  });
});

describe("buildLayoutStatus", () => {
  const spots = [
    spot({ id: "a01" }),
    spot({ id: "a02", type: "ev" }),
    spot({ id: "a03", status: "maintenance" }),
    spot({ id: "a04", status: "out_of_service" }),
    spot({ id: "a05", svg_element_id: "spot-missing" }),
    spot({ id: "a06", svg_element_id: null }),
  ];

  const sessions = [
    session({ id: "s1", parking_spot: "a01", plate: "XZXF54" }),
    session({ id: "s2", parking_spot: { id: "a03" }, plate: "PLMN22" }),
    session({
      id: "s3",
      parking_spot: "a02",
      exited_at: "2026-08-19T11:00:00.000Z",
      plate: "CLOSED1",
    }),
    session({ id: "s4", parking_spot: null, plate: "NOSPOT1" }),
    session({ id: "s5", parking_spot: "ghost", plate: "GHOST1" }),
  ];

  const status = buildLayoutStatus({
    spots,
    sessions,
    elementIds: ["spot-a01", "spot-a02", "spot-a03", "spot-a04", "spot-orphan"],
    now: NOW,
  });

  it("marks a spot with an open session as occupied and carries the vehicle detail", () => {
    const a01 = status.byElementId["spot-a01"];
    expect(a01.state).toBe("occupied");
    expect(a01.plate).toBe("XZXF54");
    expect(a01.elapsedLabel).toBe("2 h 30 min");
    expect(a01.code).toBe("A01");
  });

  it("ignores closed sessions", () => {
    expect(status.byElementId["spot-a02"].state).toBe("free");
    expect(status.byElementId["spot-a02"].plate).toBeNull();
  });

  it("lets an open session win over an out-of-service status", () => {
    expect(status.byElementId["spot-a03"].state).toBe("occupied");
    expect(status.byElementId["spot-a04"].state).toBe("out_of_service");
  });

  it("reports spots missing from the svg in both flavours, with the state they would carry", () => {
    expect(status.unmappedSpots).toEqual([
      expect.objectContaining({
        code: "A05",
        reason: "missing-in-svg",
        elementId: "spot-missing",
        state: "free",
      }),
      expect.objectContaining({
        code: "A06",
        reason: "no-element-id",
        elementId: null,
        state: "free",
      }),
    ]);
    expect(status.byElementId["spot-missing"]).toBeUndefined();
  });

  it("reports svg shapes that no spot claims", () => {
    expect(status.orphanElements).toEqual(["spot-orphan"]);
  });

  it("summarizes occupancy over every spot of the lot, mapped or not", () => {
    expect(status.summary).toMatchObject({
      totalSpots: 6,
      mapped: 4,
      occupied: 2,
      // A02 plus the two spots missing from the drawing.
      free: 3,
      outOfService: 1,
      unmappedSpots: 2,
      orphanElements: 1,
      sessionsWithoutSpot: 1,
      sessionsOnUnknownSpot: 1,
      spotsWithConflictingSessions: 0,
    });
    expect(status.summary.occupancyRate).toBeCloseTo(2 / 6);
    expect(hasLayoutWarnings(status)).toBe(true);
  });

  it("keeps the latest entry when a spot carries two open sessions", () => {
    const conflicted = buildLayoutStatus({
      spots: [spot({ id: "a01" })],
      sessions: [
        session({ id: "s1", parking_spot: "a01", plate: "OLD111", entered_at: "2026-08-19T08:00:00.000Z" }),
        session({ id: "s2", parking_spot: "a01", plate: "NEW222", entered_at: "2026-08-19T11:00:00.000Z" }),
      ],
      elementIds: ["spot-a01"],
      now: NOW,
    });
    expect(conflicted.byElementId["spot-a01"].plate).toBe("NEW222");
    expect(conflicted.summary.spotsWithConflictingSessions).toBe(1);
  });

  it("derives element ids from sanitized markup when they are not supplied", () => {
    const derived = buildLayoutStatus({
      spots: [spot({ id: "a01" })],
      sessions: [],
      svgMarkup:
        '<svg xmlns="http://www.w3.org/2000/svg"><g id="row-a"><rect id="spot-a01" /></g></svg>',
      now: NOW,
    });
    expect(derived.summary.mapped).toBe(1);
    // The wrapping <g id="row-a"> is not a drawable shape, so it is not an orphan.
    expect(derived.orphanElements).toEqual([]);
    expect(hasLayoutWarnings(derived)).toBe(false);
  });

  it("treats a lot without spots as empty rather than dividing by zero", () => {
    const empty = buildLayoutStatus({ spots: [], sessions: [], elementIds: [], now: NOW });
    expect(empty.summary.occupancyRate).toBe(0);
    expect(empty.summary.totalSpots).toBe(0);
  });
});
