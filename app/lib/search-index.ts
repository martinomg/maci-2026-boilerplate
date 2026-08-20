import { embeddingSignature, type EmbeddingConfig } from "./embeddings";
import { QDRANT_COLLECTION } from "./vector";

/**
 * Fixed point that stores which embedding provider built the current index.
 * It is excluded from search results with {@link EXCLUDE_INDEX_META_FILTER}.
 */
export const INDEX_META_POINT_ID = "00000000-0000-0000-0000-0000000000e5";
export const INDEX_META_SIGNATURE_KEY = "embedding_signature";

export const EXCLUDE_INDEX_META_FILTER = {
  must_not: [{ has_id: [INDEX_META_POINT_ID] }],
};

export class SearchIndexMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchIndexMismatchError";
  }
}

export function qdrantBaseUrl(env: Record<string, string | undefined> = process.env) {
  return (env.QDRANT_URL ?? "http://localhost:18703").replace(/\/$/, "");
}

export function buildIndexMetaPoint(config: EmbeddingConfig) {
  const vector = Array<number>(config.dimensions).fill(0);
  vector[0] = 1;
  return {
    id: INDEX_META_POINT_ID,
    vector,
    payload: { [INDEX_META_SIGNATURE_KEY]: embeddingSignature(config) },
  };
}

type CollectionInfoResponse = {
  result?: { config?: { params?: { vectors?: { size?: number } } } };
};

type MetaPointResponse = {
  result?: { payload?: Record<string, unknown> };
};

/** Vector size of the existing collection, or null when the collection does not exist. */
export async function readCollectionVectorSize(
  baseUrl: string,
  collection = QDRANT_COLLECTION,
): Promise<number | null> {
  const response = await fetch(`${baseUrl}/collections/${collection}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Qdrant collection check failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as CollectionInfoResponse;
  return payload.result?.config?.params?.vectors?.size ?? null;
}

/** Embedding signature stored with the index, or null when the index predates it. */
export async function readIndexSignature(
  baseUrl: string,
  collection = QDRANT_COLLECTION,
): Promise<string | null> {
  const response = await fetch(
    `${baseUrl}/collections/${collection}/points/${INDEX_META_POINT_ID}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Qdrant index metadata read failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as MetaPointResponse;
  const signature = payload.result?.payload?.[INDEX_META_SIGNATURE_KEY];
  return typeof signature === "string" ? signature : null;
}

/**
 * Fails with a clear error when the index was built by another embedding provider or
 * vector size, instead of letting the search return silently empty or meaningless hits.
 */
export async function assertIndexMatchesProvider(
  baseUrl: string,
  config: EmbeddingConfig,
  collection = QDRANT_COLLECTION,
) {
  const expected = embeddingSignature(config);
  const stored = await readIndexSignature(baseUrl, collection);
  if (stored === expected) return;

  const detail =
    stored === null
      ? `collection "${collection}" has no embedding signature`
      : `collection "${collection}" was indexed with "${stored}"`;
  throw new SearchIndexMismatchError(
    `Search index does not match the active embedding provider: ${detail}, but queries use "${expected}". Run pnpm search:index to rebuild it.`,
  );
}
