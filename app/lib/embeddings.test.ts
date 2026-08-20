import { afterEach, describe, expect, it, vi } from "vitest";
import {
  embedOne,
  embedTexts,
  EmbeddingConfigError,
  EmbeddingRequestError,
  embeddingSignature,
  EMBEDDING_PROVIDERS,
  resolveEmbeddingConfig,
} from "./embeddings";
import { embedText, VECTOR_SIZE } from "./vector";

const hostedEnv = {
  EMBEDDING_PROVIDER: "openai",
  EMBEDDING_API_KEY: "test-key",
  EMBEDDING_MODEL: "text-embedding-3-small",
  EMBEDDING_BASE_URL: "https://embeddings.example/v1/",
};

function mockFetch(vectors: number[][]) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async () =>
      Response.json({
        data: vectors.map((embedding, index) => ({ index, embedding })),
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveEmbeddingConfig", () => {
  it("defaults to the local provider when no embedding variables are set", () => {
    const config = resolveEmbeddingConfig({});

    expect(config.provider).toBe("local");
    expect(config.dimensions).toBe(VECTOR_SIZE);
    expect(config.apiKey).toBeNull();
    expect(embeddingSignature(config)).toBe(`local:hash-v1:${VECTOR_SIZE}`);
  });

  it("fails fast on an invalid provider and names the allowed values", () => {
    expect(() => resolveEmbeddingConfig({ EMBEDDING_PROVIDER: "cohere" })).toThrow(
      EmbeddingConfigError,
    );
    expect(() => resolveEmbeddingConfig({ EMBEDDING_PROVIDER: "cohere" })).toThrow(
      `Unknown EMBEDDING_PROVIDER "cohere". Allowed values: ${EMBEDDING_PROVIDERS.join(", ")}.`,
    );
  });

  it("requires an API key for the hosted provider", () => {
    expect(() => resolveEmbeddingConfig({ EMBEDDING_PROVIDER: "openai" })).toThrow(
      /EMBEDDING_API_KEY is required/,
    );
  });

  it("reads hosted model, base URL and dimensions from the environment", () => {
    const config = resolveEmbeddingConfig({
      ...hostedEnv,
      EMBEDDING_DIMENSIONS: "512",
    });

    expect(config.baseUrl).toBe("https://embeddings.example/v1");
    expect(config.model).toBe("text-embedding-3-small");
    expect(config.dimensions).toBe(512);
    expect(embeddingSignature(config)).toBe("openai:text-embedding-3-small:512");
  });

  it("rejects non-positive dimensions", () => {
    expect(() =>
      resolveEmbeddingConfig({ ...hostedEnv, EMBEDDING_DIMENSIONS: "0" }),
    ).toThrow(/Invalid EMBEDDING_DIMENSIONS/);
  });
});

describe("embedTexts", () => {
  it("matches the deterministic local vector for the local provider", async () => {
    const config = resolveEmbeddingConfig({});
    const [vector] = await embedTexts(["Directus and Next.js"], config);

    expect(vector).toEqual(embedText("Directus and Next.js"));
  });

  it("calls the hosted embeddings endpoint and preserves input order", async () => {
    const config = resolveEmbeddingConfig({ ...hostedEnv, EMBEDDING_DIMENSIONS: "3" });
    const fetchMock = mockFetch([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);

    const vectors = await embedTexts(["first", "second"], config);

    expect(vectors).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://embeddings.example/v1/embeddings");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "text-embedding-3-small",
      input: ["first", "second"],
      dimensions: 3,
    });
  });

  it("returns a zero vector for blank input without calling the hosted API", async () => {
    const config = resolveEmbeddingConfig({ ...hostedEnv, EMBEDDING_DIMENSIONS: "3" });
    const fetchMock = mockFetch([]);

    expect(await embedOne("   ", config)).toEqual([0, 0, 0]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a clear error when the hosted vector size differs from the configuration", async () => {
    const config = resolveEmbeddingConfig({ ...hostedEnv, EMBEDDING_DIMENSIONS: "3" });
    mockFetch([[0.1, 0.2]]);

    await expect(embedOne("first", config)).rejects.toThrow(
      /returned 2 dimensions but 3 are configured/,
    );
  });

  it("surfaces hosted provider failures", async () => {
    const config = resolveEmbeddingConfig(hostedEnv);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );

    await expect(embedOne("first", config)).rejects.toThrow(EmbeddingRequestError);
  });
});
