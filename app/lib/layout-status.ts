/**
 * Live utilization state for a parking layout.
 *
 * The viewer joins three sources that can disagree: the lot's spots, the open
 * sessions on those spots, and the element ids present in the uploaded SVG.
 * Every disagreement is reported rather than dropped, because a spot that is
 * missing from the drawing is an operational problem, not a rendering detail.
 */

import { collectSvgShapeIds } from "./svg-sanitize";

export type ParkingSpotRecord = {
  id: string;
  code: string | null;
  type: string | null;
  status: string | null;
  svg_element_id: string | null;
};

export type ParkingSessionRecord = {
  id: string;
  plate: string | null;
  entered_at: string | null;
  exited_at?: string | null;
  parking_spot: string | { id: string } | null;
};

/** State drawn on the layout. `unmapped` never lands on an element by definition. */
export type SpotState = "occupied" | "free" | "out_of_service";

/** Why a spot could not be drawn. */
export type UnmappedReason = "no-element-id" | "missing-in-svg";

export type MappedSpot = {
  elementId: string;
  spotId: string;
  code: string;
  type: string | null;
  status: string | null;
  state: SpotState;
  plate: string | null;
  enteredAt: string | null;
  /** Human readable time since `enteredAt`, computed against the request time. */
  elapsedLabel: string | null;
};

export type UnmappedSpot = {
  spotId: string;
  code: string;
  type: string | null;
  status: string | null;
  elementId: string | null;
  reason: UnmappedReason;
  /** The state it would have been drawn with, had the drawing contained it. */
  state: SpotState;
};

export type LayoutSummary = {
  totalSpots: number;
  mapped: number;
  occupied: number;
  free: number;
  outOfService: number;
  unmappedSpots: number;
  orphanElements: number;
  /** Open sessions in the lot with no spot assigned at all. */
  sessionsWithoutSpot: number;
  /** Open sessions pointing at a spot that does not belong to this lot. */
  sessionsOnUnknownSpot: number;
  /** Spots carrying more than one open session; the latest entry wins. */
  spotsWithConflictingSessions: number;
  /** Occupied share of the lot's spots, 0..1. */
  occupancyRate: number;
};

export type LayoutStatus = {
  spots: MappedSpot[];
  byElementId: Record<string, MappedSpot>;
  unmappedSpots: UnmappedSpot[];
  /** Shape ids drawn in the SVG that no spot claims. */
  orphanElements: string[];
  summary: LayoutSummary;
  /** Request time the elapsed labels were computed against. */
  generatedAt: string;
};

/** Spot statuses that must not read as available capacity. */
const OUT_OF_SERVICE_STATUSES = new Set(["out_of_service", "maintenance", "closed"]);

function spotIdOf(session: ParkingSessionRecord): string | null {
  const value = session.parking_spot;
  if (!value) return null;
  return typeof value === "string" ? value : (value.id ?? null);
}

function isOpen(session: ParkingSessionRecord): boolean {
  return session.exited_at === null || session.exited_at === undefined;
}

function timeOf(value: string | null): number {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

/**
 * Formats a duration as an operator reads it: hours and minutes, days once a
 * stay runs past 24 h. Returns null when `enteredAt` is unusable.
 */
export function formatElapsed(enteredAt: string | null, now: Date | number): string | null {
  const start = timeOf(enteredAt);
  if (Number.isNaN(start)) return null;

  const end = typeof now === "number" ? now : now.getTime();
  const totalMinutes = Math.floor((end - start) / 60_000);
  if (totalMinutes < 0) return "just now";
  if (totalMinutes < 1) return "just now";
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}

/**
 * Joins spots, open sessions and SVG element ids into everything the viewer
 * renders: the per-element state map, both directions of unmapped ids, and the
 * occupancy summary.
 */
export function buildLayoutStatus(input: {
  spots: ParkingSpotRecord[];
  sessions: ParkingSessionRecord[];
  /** Sanitized SVG markup, or the shape ids already extracted from it. */
  svgMarkup?: string;
  elementIds?: string[];
  now?: Date | number;
}): LayoutStatus {
  const now = input.now ?? new Date();
  const nowMs = typeof now === "number" ? now : now.getTime();

  const elementIds =
    input.elementIds ?? (input.svgMarkup ? collectSvgShapeIds(input.svgMarkup) : []);
  const elementIdSet = new Set(elementIds);

  const openSessions = input.sessions.filter(isOpen);
  const spotById = new Map(input.spots.map((spot) => [spot.id, spot]));

  let sessionsWithoutSpot = 0;
  let sessionsOnUnknownSpot = 0;
  let spotsWithConflictingSessions = 0;

  // Latest open session per spot: a spot is occupied by one vehicle, and if the
  // data says otherwise the most recent entry is the current occupant.
  const sessionBySpot = new Map<string, ParkingSessionRecord>();
  for (const session of openSessions) {
    const spotId = spotIdOf(session);
    if (!spotId) {
      sessionsWithoutSpot += 1;
      continue;
    }
    if (!spotById.has(spotId)) {
      sessionsOnUnknownSpot += 1;
      continue;
    }
    const current = sessionBySpot.get(spotId);
    if (!current) {
      sessionBySpot.set(spotId, session);
      continue;
    }
    spotsWithConflictingSessions += 1;
    const currentTime = timeOf(current.entered_at);
    const candidateTime = timeOf(session.entered_at);
    if (Number.isNaN(currentTime) || candidateTime > currentTime) {
      sessionBySpot.set(spotId, session);
    }
  }

  const spots: MappedSpot[] = [];
  const byElementId: Record<string, MappedSpot> = {};
  const unmappedSpots: UnmappedSpot[] = [];
  const claimedElements = new Set<string>();

  let occupied = 0;
  let free = 0;
  let outOfService = 0;

  for (const spot of input.spots) {
    const elementId = spot.svg_element_id?.trim() || null;
    const code = spot.code ?? "—";
    const session = sessionBySpot.get(spot.id) ?? null;

    // State is a property of the spot, not of the drawing: a spot missing from
    // the SVG still occupies capacity and still counts in the summary.
    const state: SpotState = session
      ? "occupied"
      : OUT_OF_SERVICE_STATUSES.has(spot.status ?? "")
        ? "out_of_service"
        : "free";

    if (state === "occupied") occupied += 1;
    else if (state === "out_of_service") outOfService += 1;
    else free += 1;

    if (!elementId || !elementIdSet.has(elementId)) {
      unmappedSpots.push({
        spotId: spot.id,
        code,
        type: spot.type,
        status: spot.status,
        elementId,
        reason: elementId ? "missing-in-svg" : "no-element-id",
        state,
      });
      continue;
    }

    const mapped: MappedSpot = {
      elementId,
      spotId: spot.id,
      code,
      type: spot.type,
      status: spot.status,
      state,
      plate: session?.plate ?? null,
      enteredAt: session?.entered_at ?? null,
      elapsedLabel: session ? formatElapsed(session.entered_at, nowMs) : null,
    };

    spots.push(mapped);
    byElementId[elementId] = mapped;
    claimedElements.add(elementId);
  }

  const orphanElements = elementIds.filter((id) => !claimedElements.has(id));
  const totalSpots = input.spots.length;

  return {
    spots,
    byElementId,
    unmappedSpots,
    orphanElements,
    generatedAt: new Date(nowMs).toISOString(),
    summary: {
      totalSpots,
      mapped: spots.length,
      occupied,
      free,
      outOfService,
      unmappedSpots: unmappedSpots.length,
      orphanElements: orphanElements.length,
      sessionsWithoutSpot,
      sessionsOnUnknownSpot,
      spotsWithConflictingSessions,
      occupancyRate: totalSpots === 0 ? 0 : occupied / totalSpots,
    },
  };
}

/** True when anything about this layout needs an operator's attention. */
export function hasLayoutWarnings(status: LayoutStatus): boolean {
  const { summary } = status;
  return (
    summary.unmappedSpots > 0 ||
    summary.orphanElements > 0 ||
    summary.sessionsWithoutSpot > 0 ||
    summary.sessionsOnUnknownSpot > 0 ||
    summary.spotsWithConflictingSessions > 0
  );
}
