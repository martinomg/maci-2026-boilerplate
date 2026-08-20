import { directusServerFetch } from "@/lib/directus-server";
import type {
  ParkingLotRecord,
  ParkingSessionRecord,
  ParkingTransactionRecord,
} from "@/lib/metrics";

/** Window of the citywide occupancy line chart and the revenue KPI. */
export const TREND_DAYS = 7;
/** How far back sessions and transactions are pulled for the averages. */
export const HISTORY_DAYS = 30;

const DAY_MS = 86_400_000;

export type DashboardData = {
  /** Server clock captured once so every metric shares the same instant. */
  now: string;
  lots: ParkingLotRecord[];
  sessions: ParkingSessionRecord[];
  transactions: ParkingTransactionRecord[];
  /** Set when Directus could not be reached; the page degrades instead of throwing. */
  error: string | null;
};

function listParams(fields: string[], extra: Record<string, string> = {}) {
  return { fields: fields.join(","), limit: "-1", ...extra };
}

/**
 * Reads the parking records the dashboard needs in one server-side pass.
 *
 * Parking collections are not public, so every request goes through
 * `directusServerFetch` with the app service token. The dataset is small
 * (hundreds of rows), so the metrics are computed in the app rather than with
 * Directus aggregations — that keeps the arithmetic in one tested module.
 *
 * Sessions are limited to the last 30 days plus every still-open session,
 * because an open session may have started before the window and still occupies
 * a spot today.
 */
export async function loadDashboardData(
  now: Date = new Date(),
): Promise<DashboardData> {
  const windowStart = new Date(now.getTime() - HISTORY_DAYS * DAY_MS).toISOString();

  try {
    const [lots, sessions, transactions] = await Promise.all([
      directusServerFetch<ParkingLotRecord[]>(
        "/items/parking_lots",
        listParams(["id", "name", "city", "status", "capacity", "hourly_rate"], {
          filter: JSON.stringify({ status: { _eq: "published" } }),
          sort: "sort,name",
        }),
      ),
      directusServerFetch<ParkingSessionRecord[]>(
        "/items/parking_sessions",
        listParams(["id", "parking_lot", "entered_at", "exited_at"], {
          filter: JSON.stringify({
            _or: [
              { exited_at: { _null: true } },
              { exited_at: { _gte: windowStart } },
            ],
          }),
          sort: "entered_at",
        }),
      ),
      directusServerFetch<ParkingTransactionRecord[]>(
        "/items/parking_transactions",
        listParams(["id", "amount", "currency", "paid_at"], {
          filter: JSON.stringify({ paid_at: { _gte: windowStart } }),
          sort: "paid_at",
        }),
      ),
    ]);

    return {
      now: now.toISOString(),
      lots: lots ?? [],
      sessions: sessions ?? [],
      transactions: transactions ?? [],
      error: null,
    };
  } catch (error) {
    return {
      now: now.toISOString(),
      lots: [],
      sessions: [],
      transactions: [],
      error: error instanceof Error ? error.message : "Directus request failed.",
    };
  }
}
