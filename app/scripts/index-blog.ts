import { getPublishedPosts } from "../lib/directus";
import { embedText, QDRANT_COLLECTION, VECTOR_SIZE } from "../lib/vector";

const qdrantUrl = (process.env.QDRANT_URL ?? "http://localhost:18703").replace(
  /\/$/,
  "",
);

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

async function ensureCollection() {
  const existing = await fetch(`${qdrantUrl}/collections/${QDRANT_COLLECTION}`, {
    cache: "no-store",
  });
  if (existing.ok) return;
  if (existing.status !== 404) {
    throw new Error(
      `Qdrant collection check failed: ${existing.status} ${await existing.text()}`,
    );
  }

  await qdrant(`/collections/${QDRANT_COLLECTION}`, {
    method: "PUT",
    body: JSON.stringify({ vectors: { size: VECTOR_SIZE, distance: "Cosine" } }),
  });
}

async function main() {
  const posts = await getPublishedPosts();
  await ensureCollection();

  if (posts.length > 0) {
    await qdrant(`/collections/${QDRANT_COLLECTION}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify({
        points: posts.map((post) => ({
          id: post.id,
          vector: embedText(`${post.title}\n${post.excerpt}\n${post.content}`),
          payload: post,
        })),
      }),
    });
  }

  console.log(`Indexed ${posts.length} published posts in ${QDRANT_COLLECTION}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
