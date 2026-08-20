import { getPublishedPosts } from "../lib/directus";
import {
  embeddingSignature,
  embedTexts,
  resolveEmbeddingConfig,
  type EmbeddingConfig,
} from "../lib/embeddings";
import {
  buildIndexMetaPoint,
  qdrantBaseUrl,
  readCollectionVectorSize,
  readIndexSignature,
} from "../lib/search-index";
import { QDRANT_COLLECTION } from "../lib/vector";

const qdrantUrl = qdrantBaseUrl();

async function qdrant(pathname: string, init: RequestInit) {
  const response = await fetch(`${qdrantUrl}${pathname}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    throw new Error(`Qdrant request failed: ${response.status} ${await response.text()}`);
  }
  return response;
}

async function createCollection(config: EmbeddingConfig) {
  await qdrant(`/collections/${QDRANT_COLLECTION}`, {
    method: "PUT",
    body: JSON.stringify({
      vectors: { size: config.dimensions, distance: "Cosine" },
    }),
  });
}

/**
 * Recreates the collection whenever the embedding provider or vector size changed,
 * so indexed vectors always match the vectors produced at query time.
 */
async function ensureCollection(config: EmbeddingConfig) {
  const size = await readCollectionVectorSize(qdrantUrl);
  if (size === null) {
    await createCollection(config);
    return;
  }

  const stored = await readIndexSignature(qdrantUrl);
  const expected = embeddingSignature(config);
  if (size === config.dimensions && stored === expected) return;

  console.log(
    `Recreating ${QDRANT_COLLECTION}: indexed with ${stored ?? "an unknown provider"} (${size} dimensions), rebuilding with ${expected}.`,
  );
  await qdrant(`/collections/${QDRANT_COLLECTION}`, { method: "DELETE" });
  await createCollection(config);
}

async function main() {
  const config = resolveEmbeddingConfig();
  const posts = await getPublishedPosts();
  await ensureCollection(config);

  const vectors = await embedTexts(
    posts.map((post) => `${post.title}\n${post.excerpt}\n${post.content}`),
    config,
  );

  await qdrant(`/collections/${QDRANT_COLLECTION}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({
      points: [
        buildIndexMetaPoint(config),
        ...posts.map((post, index) => ({
          id: post.id,
          vector: vectors[index],
          payload: post,
        })),
      ],
    }),
  });

  console.log(
    `Indexed ${posts.length} published posts in ${QDRANT_COLLECTION} using ${embeddingSignature(config)}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
