import { embedText, VECTOR_SIZE } from "./vector";

export const EMBEDDING_PROVIDERS = ["local", "openai"] as const;

export type EmbeddingProvider = (typeof EMBEDDING_PROVIDERS)[number];

export const DEFAULT_EMBEDDING_PROVIDER: EmbeddingProvider = "local";

const LOCAL_MODEL = "hash-v1";
const OPENAI_DEFAULT_MODEL = "text-embedding-3-small";
const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
const OPENAI_DEFAULT_DIMENSIONS = 1536;
const OPENAI_BATCH_SIZE = 64;

export type EmbeddingEnvironment = Record<string, string | undefined>;

export type EmbeddingConfig = {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  baseUrl: string | null;
  apiKey: string | null;
  explicitDimensions: boolean;
};

export class EmbeddingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingConfigError";
  }
}

export class EmbeddingRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingRequestError";
  }
}

function readValue(env: EmbeddingEnvironment, key: string) {
  const value = env[key]?.trim();
  return value ? value : null;
}

function isEmbeddingProvider(value: string): value is EmbeddingProvider {
  return (EMBEDDING_PROVIDERS as readonly string[]).includes(value);
}

function resolveDimensions(env: EmbeddingEnvironment, fallback: number) {
  const raw = readValue(env, "EMBEDDING_DIMENSIONS");
  if (!raw) return { dimensions: fallback, explicit: false };

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new EmbeddingConfigError(
      `Invalid EMBEDDING_DIMENSIONS "${raw}". Use a positive integer.`,
    );
  }
  return { dimensions: parsed, explicit: true };
}

/**
 * Resolves the active embedding provider from the environment.
 * Defaults to the deterministic local vector so the demo needs no API key.
 */
export function resolveEmbeddingConfig(
  env: EmbeddingEnvironment = process.env,
): EmbeddingConfig {
  const requested = readValue(env, "EMBEDDING_PROVIDER");
  const provider = requested ? requested.toLowerCase() : DEFAULT_EMBEDDING_PROVIDER;

  if (!isEmbeddingProvider(provider)) {
    throw new EmbeddingConfigError(
      `Unknown EMBEDDING_PROVIDER "${requested}". Allowed values: ${EMBEDDING_PROVIDERS.join(", ")}.`,
    );
  }

  if (provider === "local") {
    return {
      provider,
      model: LOCAL_MODEL,
      dimensions: VECTOR_SIZE,
      baseUrl: null,
      apiKey: null,
      explicitDimensions: false,
    };
  }

  const apiKey = readValue(env, "EMBEDDING_API_KEY");
  if (!apiKey) {
    throw new EmbeddingConfigError(
      `EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER is "${provider}".`,
    );
  }

  const { dimensions, explicit } = resolveDimensions(env, OPENAI_DEFAULT_DIMENSIONS);
  return {
    provider,
    model: readValue(env, "EMBEDDING_MODEL") ?? OPENAI_DEFAULT_MODEL,
    dimensions,
    baseUrl: (readValue(env, "EMBEDDING_BASE_URL") ?? OPENAI_DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    ),
    apiKey,
    explicitDimensions: explicit,
  };
}

/**
 * Stable identity of the vectors produced by a configuration.
 * Stored with the Qdrant index so query and index vectors can never diverge silently.
 */
export function embeddingSignature(config: EmbeddingConfig) {
  return `${config.provider}:${config.model}:${config.dimensions}`;
}

function isBlank(value: string) {
  return value.trim().length === 0;
}

function zeroVector(dimensions: number) {
  return Array<number>(dimensions).fill(0);
}

type OpenAiEmbeddingResponse = {
  data?: { index?: number; embedding?: number[] }[];
};

async function requestOpenAiEmbeddings(values: string[], config: EmbeddingConfig) {
  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: values,
      ...(config.explicitDimensions ? { dimensions: config.dimensions } : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new EmbeddingRequestError(
      `Embedding request failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as OpenAiEmbeddingResponse;
  const data = payload.data;
  if (!Array.isArray(data) || data.length !== values.length) {
    throw new EmbeddingRequestError(
      `Embedding response returned ${data?.length ?? 0} vectors for ${values.length} inputs.`,
    );
  }

  return [...data]
    .sort((first, second) => (first.index ?? 0) - (second.index ?? 0))
    .map((item) => {
      const vector = item.embedding;
      if (!Array.isArray(vector)) {
        throw new EmbeddingRequestError("Embedding response contained no vector.");
      }
      if (vector.length !== config.dimensions) {
        throw new EmbeddingRequestError(
          `Embedding model "${config.model}" returned ${vector.length} dimensions but ${config.dimensions} are configured. Set EMBEDDING_DIMENSIONS=${vector.length}.`,
        );
      }
      return vector;
    });
}

/** Embeds many texts with the configured provider, preserving input order. */
export async function embedTexts(
  values: string[],
  config: EmbeddingConfig = resolveEmbeddingConfig(),
): Promise<number[][]> {
  if (values.length === 0) return [];
  if (config.provider === "local") return values.map((value) => embedText(value));

  const vectors = new Array<number[] | undefined>(values.length);
  const pending: { index: number; value: string }[] = [];

  values.forEach((value, index) => {
    if (isBlank(value)) vectors[index] = zeroVector(config.dimensions);
    else pending.push({ index, value });
  });

  for (let offset = 0; offset < pending.length; offset += OPENAI_BATCH_SIZE) {
    const batch = pending.slice(offset, offset + OPENAI_BATCH_SIZE);
    const embedded = await requestOpenAiEmbeddings(
      batch.map((item) => item.value),
      config,
    );
    batch.forEach((item, position) => {
      vectors[item.index] = embedded[position];
    });
  }

  return vectors.map((vector) => vector ?? zeroVector(config.dimensions));
}

/** Embeds a single text with the configured provider. */
export async function embedOne(
  value: string,
  config: EmbeddingConfig = resolveEmbeddingConfig(),
): Promise<number[]> {
  const [vector] = await embedTexts([value], config);
  return vector;
}
