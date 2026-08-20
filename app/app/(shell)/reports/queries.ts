import { directusServerFetch } from "@/lib/directus-server";
import type { LotRecord, SessionRecord, TransactionRecord } from "@/lib/reports";

/**
 * Directus reads behind the operations reports.
 *
 * Parking collections are closed to anonymous traffic, so every call goes
 * through the server-only service token. Ranges are resolved from the data
 * itself, which means the full session history of a lot is fetched and the
 * bucketing happens in `lib/reports.ts`; the seeded dataset is a few hundred
 * rows, well inside what one request can carry.
 */

const lotFields = ["id", "name", "city", "address", "capacity", "hourly_rate", "sort"].join(",");
const sessionFields = ["id", "plate", "entered_at", "exited_at", "parking_lot"].join(",");
const transactionFields = ["id", "amount", "paid_at", "parking_session"].join(",");

export type ReportLot = LotRecord & { id: string; name: string; city?: string | null };

export async function fetchLots(): Promise<ReportLot[]> {
  return directusServerFetch<ReportLot[]>("/items/parking_lots", {
    fields: lotFields,
    filter: JSON.stringify({ status: { _eq: "published" } }),
    sort: "sort,name",
    limit: "-1",
  });
}

export async function fetchLot(id: string): Promise<ReportLot | null> {
  const lots = await directusServerFetch<ReportLot[]>("/items/parking_lots", {
    fields: lotFields,
    filter: JSON.stringify({ _and: [{ id: { _eq: id } }, { status: { _eq: "published" } }] }),
    limit: "1",
  });
  return lots[0] ?? null;
}

export async function fetchSessions(lotId?: string): Promise<SessionRecord[]> {
  return directusServerFetch<SessionRecord[]>("/items/parking_sessions", {
    fields: sessionFields,
    sort: "entered_at",
    limit: "-1",
    ...(lotId ? { filter: JSON.stringify({ parking_lot: { _eq: lotId } }) } : {}),
  });
}

export async function fetchTransactions(lotId?: string): Promise<TransactionRecord[]> {
  return directusServerFetch<TransactionRecord[]>("/items/parking_transactions", {
    fields: transactionFields,
    sort: "paid_at",
    limit: "-1",
    ...(lotId
      ? { filter: JSON.stringify({ parking_session: { parking_lot: { _eq: lotId } } }) }
      : {}),
  });
}
