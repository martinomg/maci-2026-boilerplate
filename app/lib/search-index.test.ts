import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveEmbeddingConfig } from "./embeddings";
import {
  assertIndexMatchesProvider,
  buildIndexMetaPoint,
  INDEX_META_POINT_ID,
  INDEX_META_SIGNATURE_KEY,
  qdrantBaseUrl,
  SearchIndexMismatchError,
} from "./search-index";
import { VECTOR_SIZE } from "./vector";

const localConfig = resolveEmbeddingConfig({});

function mockMetaPoint(signature: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      signature === null
        ? new Response("not found", { status: 404 })
        : Response.json({ result: { payload: { [INDEX_META_SIGNATURE_KEY]: signature } } }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("qdrantBaseUrl", () => {
  it("falls back to the local Qdrant port and trims a trailing slash", () => {
    expect(qdrantBaseUrl({})).toBe("http://localhost:18703");
    expect(qdrantBaseUrl({ QDRANT_URL: "http://qdrant:6333/" })).toBe(
      "http://qdrant:6333",
    );
  });
});

describe("buildIndexMetaPoint", () => {
  it("stores the embedding signature on a fixed, non-zero point", () => {
    const point = buildIndexMetaPoint(localConfig);

    expect(point.id).toBe(INDEX_META_POINT_ID);
    expect(point.vector).toHaveLength(VECTOR_SIZE);
    expect(point.vector[0]).toBe(1);
    expect(point.payload[INDEX_META_SIGNATURE_KEY]).toBe(`local:hash-v1:${VECTOR_SIZE}`);
  });
});

describe("assertIndexMatchesProvider", () => {
  it("accepts an index built by the active provider", async () => {
    mockMetaPoint(`local:hash-v1:${VECTOR_SIZE}`);

    await expect(
      assertIndexMatchesProvider("http://qdrant:6333", localConfig),
    ).resolves.toBeUndefined();
  });

  it("fails with a clear error when another provider built the index", async () => {
    mockMetaPoint("openai:text-embedding-3-small:1536");

    await expect(
      assertIndexMatchesProvider("http://qdrant:6333", localConfig),
    ).rejects.toThrow(SearchIndexMismatchError);
    await expect(
      assertIndexMatchesProvider("http://qdrant:6333", localConfig),
    ).rejects.toThrow(/openai:text-embedding-3-small:1536.*pnpm search:index/s);
  });

  it("fails when the index carries no embedding signature", async () => {
    mockMetaPoint(null);

    await expect(
      assertIndexMatchesProvider("http://qdrant:6333", localConfig),
    ).rejects.toThrow(/no embedding signature/);
  });
});
