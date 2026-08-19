import { NextRequest, NextResponse } from "next/server";
import type { BlogPost } from "@/lib/directus";
import { embedText, QDRANT_COLLECTION } from "@/lib/vector";

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

  const qdrantUrl = (process.env.QDRANT_URL ?? "http://localhost:18703").replace(
    /\/$/,
    "",
  );
  const response = await fetch(
    `${qdrantUrl}/collections/${QDRANT_COLLECTION}/points/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vector: embedText(query),
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

