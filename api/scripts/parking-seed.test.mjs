import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedRoot = path.join(apiRoot, "directus-config", "seed");

// The parking seed is static JSON, so "now" is a fixed instant: every open
// session started before it and the 30 day window ends there.
const SEED_REFERENCE = Date.parse("2026-08-19T17:00:00.000Z");
const WINDOW_START = Date.parse("2026-07-20T00:00:00.000Z");
const SEVEN_DAYS = 7 * 86_400_000;

// directus-sync resolves dangling seed ids with a single `filter[id][_in]=...`
// GET request. Past roughly 410 UUIDs that request line exceeds the Node HTTP
// header limit and Directus answers 431, which breaks `seed:diff`.
const MAX_ROWS_PER_COLLECTION = 380;

const SHOWCASE_LOT = "parking-lot-costanera-center";
const LAYOUT_FILE = "parking-file-lot-layout-demo";

function readSeed(name) {
  const seed = JSON.parse(readFileSync(path.join(seedRoot, `${name}.json`), "utf8"));
  assert.equal(seed.collection, name, `${name}.json must declare the ${name} collection.`);
  assert.equal(seed.meta.delete, false, `${name}.json must not own deletions.`);
  return seed;
}

const files = readSeed("directus_files");
const lots = readSeed("parking_lots");
const spots = readSeed("parking_spots");
const sessions = readSeed("parking_sessions");
const transactions = readSeed("parking_transactions");

const layoutSvg = readFileSync(path.join(seedRoot, "assets", "lot-layout-demo.svg"), "utf8");
const svgElementIds = new Set([...layoutSvg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

const lotById = new Map(lots.data.map((lot) => [lot._sync_id, lot]));
const spotById = new Map(spots.data.map((spot) => [spot._sync_id, spot]));
const sessionById = new Map(sessions.data.map((session) => [session._sync_id, session]));
const paidSessions = new Set(transactions.data.map((transaction) => transaction.parking_session));

test("seed sync ids are unique inside every parking collection", () => {
  for (const seed of [files, lots, spots, sessions, transactions]) {
    const ids = seed.data.map((item) => item._sync_id);
    assert.equal(new Set(ids).size, ids.length, `${seed.collection} contains duplicate _sync_id values.`);
  }
});

test("every parking collection stays below the directus-sync id filter ceiling", () => {
  for (const seed of [lots, spots, sessions, transactions]) {
    assert.ok(
      seed.data.length <= MAX_ROWS_PER_COLLECTION,
      `${seed.collection} seeds ${seed.data.length} rows; keep it at or below ${MAX_ROWS_PER_COLLECTION} so seed:diff keeps working.`,
    );
  }
});

test("the committed layout file is uploaded and linked to the showcase lot", () => {
  const file = files.data.find((item) => item._sync_id === LAYOUT_FILE);
  assert.ok(file, "The demo layout file seed is missing.");
  assert.ok(
    existsSync(path.join(seedRoot, file._file_path)),
    `The seeded file path ${file._file_path} does not exist.`,
  );
  assert.equal(file.type, "image/svg+xml");

  const showcase = lotById.get(SHOWCASE_LOT);
  assert.ok(showcase, "The showcase lot is missing.");
  assert.equal(showcase.layout_svg, LAYOUT_FILE, "The showcase lot must link the seeded layout file.");
});

test("showcase spots map one to one onto the ids in the committed SVG", () => {
  const showcaseSpots = spots.data.filter((spot) => spot.parking_lot === SHOWCASE_LOT);
  assert.ok(showcaseSpots.length >= 40, "The showcase lot needs at least 40 mapped spots.");

  const mapped = new Set();
  for (const spot of showcaseSpots) {
    assert.ok(spot.svg_element_id, `Showcase spot ${spot.code} has no svg_element_id.`);
    assert.ok(
      svgElementIds.has(spot.svg_element_id),
      `svg_element_id ${spot.svg_element_id} is not present in lot-layout-demo.svg.`,
    );
    assert.ok(!mapped.has(spot.svg_element_id), `svg_element_id ${spot.svg_element_id} is seeded twice.`);
    mapped.add(spot.svg_element_id);
  }

  const svgSpotIds = [...svgElementIds].filter((id) => id.startsWith("spot-"));
  for (const id of svgSpotIds) {
    assert.ok(mapped.has(id), `SVG element ${id} has no seeded parking_spots row.`);
  }
  assert.equal(mapped.size, svgSpotIds.length);
});

test("sessions and transactions reference seeded parents only", () => {
  for (const spot of spots.data) {
    assert.ok(lotById.has(spot.parking_lot), `Spot ${spot._sync_id} references an unknown lot.`);
  }

  for (const session of sessions.data) {
    assert.ok(lotById.has(session.parking_lot), `Session ${session._sync_id} references an unknown lot.`);
    if (session.parking_spot !== null) {
      const spot = spotById.get(session.parking_spot);
      assert.ok(spot, `Session ${session._sync_id} references an unknown spot.`);
      assert.equal(
        spot.parking_lot,
        session.parking_lot,
        `Session ${session._sync_id} uses a spot from another lot.`,
      );
    }
  }

  for (const transaction of transactions.data) {
    const session = sessionById.get(transaction.parking_session);
    assert.ok(session, `Transaction ${transaction._sync_id} references an unknown session.`);
    assert.ok(session.exited_at, `Transaction ${transaction._sync_id} is attached to an open session.`);
  }
});

test("session timestamps stay inside the fixed 30 day window", () => {
  for (const session of sessions.data) {
    const enteredAt = Date.parse(session.entered_at);
    assert.ok(Number.isFinite(enteredAt), `Session ${session._sync_id} has an invalid entered_at.`);
    assert.ok(enteredAt >= WINDOW_START, `Session ${session._sync_id} starts before the seeded window.`);
    assert.ok(enteredAt <= SEED_REFERENCE, `Session ${session._sync_id} starts after the seed reference.`);

    if (session.exited_at !== null) {
      const exitedAt = Date.parse(session.exited_at);
      assert.ok(exitedAt > enteredAt, `Session ${session._sync_id} exits before it enters.`);
      assert.ok(exitedAt <= SEED_REFERENCE, `Closed session ${session._sync_id} exits in the future.`);
    }
  }
});

test("occupancy right now covers a busy lot above 80% and a quiet lot below 30%", () => {
  const openByLot = new Map(lots.data.map((lot) => [lot._sync_id, 0]));
  for (const session of sessions.data) {
    if (session.exited_at === null) {
      openByLot.set(session.parking_lot, openByLot.get(session.parking_lot) + 1);
    }
  }

  const occupancy = new Map(
    [...openByLot].map(([lotId, open]) => [lotId, open / lotById.get(lotId).capacity]),
  );

  for (const [lotId, open] of openByLot) {
    assert.ok(
      open <= lotById.get(lotId).capacity,
      `Lot ${lotId} has more open sessions than spaces.`,
    );
  }

  assert.ok(
    occupancy.get(SHOWCASE_LOT) > 0.8,
    `The showcase lot must be above 80% occupied, got ${(occupancy.get(SHOWCASE_LOT) * 100).toFixed(1)}%.`,
  );
  assert.ok(
    [...occupancy.values()].some((ratio) => ratio < 0.3),
    "At least one lot must be below 30% occupancy.",
  );
});

test("the last seven days contain at least five exits without a transaction", () => {
  const recentUnpaid = sessions.data.filter((session) => {
    if (session.exited_at === null) return false;
    const exitedAt = Date.parse(session.exited_at);
    return exitedAt >= SEED_REFERENCE - SEVEN_DAYS && !paidSessions.has(session._sync_id);
  });

  assert.ok(
    recentUnpaid.length >= 5,
    `Expected at least 5 recent unpaid exits, found ${recentUnpaid.length}.`,
  );
});

test("transaction amounts are billed against the lot rate", () => {
  for (const transaction of transactions.data) {
    const session = sessionById.get(transaction.parking_session);
    const lot = lotById.get(session.parking_lot);
    const minutes = (Date.parse(session.exited_at) - Date.parse(session.entered_at)) / 60_000;
    const billedHours = Math.max(1, Math.ceil(minutes / 60));
    assert.equal(
      transaction.amount,
      (billedHours * Number(lot.hourly_rate)).toFixed(2),
      `Transaction ${transaction._sync_id} does not match ${billedHours}h at the lot rate.`,
    );
    assert.equal(transaction.currency, "CLP");
    assert.ok(Date.parse(transaction.paid_at) <= Date.parse(session.exited_at));
  }
});
