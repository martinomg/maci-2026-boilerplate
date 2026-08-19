import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/directus";

async function check(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const qdrantUrl = (process.env.QDRANT_URL ?? "http://localhost:18703").replace(
    /\/$/,
    "",
  );
  const [directus, qdrant] = await Promise.all([
    check(`${getDirectusUrl()}/server/health`),
    check(`${qdrantUrl}/readyz`),
  ]);
  const healthy = directus && qdrant;

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", services: { directus, qdrant } },
    { status: healthy ? 200 : 503 },
  );
}

