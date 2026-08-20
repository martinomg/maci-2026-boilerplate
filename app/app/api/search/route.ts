import { NextRequest, NextResponse } from "next/server";
import type { BlogPost } from "@/lib/directus";
import {
  embedOne,
  EmbeddingConfigError,
  EmbeddingRequestError,
  resolveEmbeddingConfig,
} from "@/lib/embeddings";
import {
  assertIndexMatchesProvider,
  EXCLUDE_INDEX_META_FILTER,
  qdrantBaseUrl,
  SearchIndexMismatchError,
} from "@/lib/search-index";
import { QDRANT_COLLECTION } from "@/lib/vector";

type SearchPoint = {
  id: string;
  score: number;
  payload: BlogPost;
};

type QdrantResponse = {
  result: SearchPoint[];
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "The q query parameter is required." },
      { status: 400 },
    );
  }

  const qdrantUrl = qdrantBaseUrl();

  let vector: number[];
  try {
    const config = resolveEmbeddingConfig();
    await assertIndexMatchesProvider(qdrantUrl, config);
    vector = await embedOne(query, config);
  } catch (error) {
    if (error instanceof EmbeddingConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof SearchIndexMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof EmbeddingRequestError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }

  const response = await fetch(
    `${qdrantUrl}/collections/${QDRANT_COLLECTION}/points/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vector,
        filter: EXCLUDE_INDEX_META_FILTER,
        limit: 5,
        with_payload: true,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Qdrant search failed." }, { status: 503 });
  }

  const payload = (await response.json()) as QdrantResponse;
  return NextResponse.json({
    data: payload.result.map((point) => ({
      ...point.payload,
      score: point.score,
    })),
  });
}
