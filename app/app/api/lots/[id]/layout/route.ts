import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/directus";
import { directusServerFetch } from "@/lib/directus-server";
import { buildElementIdReport, describeOversize, validateSvg } from "@/lib/svg-validate";
import type { LayoutMatchReport, LayoutUploadResponse } from "@/components/layout-upload/types";

type ParkingLot = {
  id: string;
  name: string;
  layout_svg: string | null;
};

type ParkingSpot = {
  id: string;
  code: string;
  svg_element_id: string | null;
};

function fail(message: string, status: number, code?: string) {
  return NextResponse.json<LayoutUploadResponse>({ ok: false, message, code }, { status });
}

/**
 * Requests to Directus made as the Configurator service user.
 *
 * The application never decides whether the caller may replace a layout:
 * it forwards the write with the Configurator token and lets Directus answer.
 * A 401/403 from Directus is surfaced as a 403 to the browser.
 */
function configuratorHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+/, "");
  const withName = cleaned.length > 0 ? cleaned : "layout.svg";
  return withName.toLowerCase().endsWith(".svg") ? withName : `${withName}.svg`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const configuratorToken = process.env.DIRECTUS_CONFIGURATOR_TOKEN;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("The upload could not be read. Send the layout as multipart form data.", 400);
  }

  const file = formData.get("file");
  const confirmed = formData.get("confirm") === "true";

  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose an SVG layout file to upload.", 400, "empty");
  }

  // Refuse an oversized upload before its bytes are read into memory.
  const oversize = describeOversize(file.size);
  if (oversize) {
    return fail(oversize, 400, "too-large");
  }

  const content = await file.text();
  const validation = validateSvg(content, { byteLength: file.size });
  if (!validation.ok) {
    return fail(validation.message, 400, validation.code);
  }

  let lot: ParkingLot;
  let spots: ParkingSpot[];
  try {
    [lot, spots] = await Promise.all([
      directusServerFetch<ParkingLot>(`/items/parking_lots/${encodeURIComponent(id)}`, {
        fields: "id,name,layout_svg",
      }),
      directusServerFetch<ParkingSpot[]>("/items/parking_spots", {
        fields: "id,code,svg_element_id",
        filter: JSON.stringify({ parking_lot: { _eq: id } }),
        sort: "code",
        limit: "-1",
      }),
    ]);
  } catch {
    return fail("The parking lot could not be read from Directus.", 404);
  }

  const report: LayoutMatchReport = {
    ...buildElementIdReport(
      validation.elementIds,
      spots.map((spot) => spot.svg_element_id),
    ),
    mappedSpotCount: spots.filter((spot) => (spot.svg_element_id ?? "").trim().length > 0).length,
    spotCount: spots.length,
  };

  if (!confirmed) {
    return NextResponse.json<LayoutUploadResponse>({ ok: true, stage: "report", report });
  }

  if (!configuratorToken) {
    return fail(
      "DIRECTUS_CONFIGURATOR_TOKEN is not set. Run bin/env.init.command.sh and pnpm schema:apply to provision the configurator service user.",
      500,
    );
  }

  const directusUrl = getDirectusUrl();
  const upload = new FormData();
  upload.append("title", `layout-${lot.name}`);
  upload.append(
    "file",
    new File([content], safeFilename(file.name), { type: "image/svg+xml" }),
  );

  const uploadResponse = await fetch(`${directusUrl}/files`, {
    method: "POST",
    headers: configuratorHeaders(configuratorToken),
    body: upload,
  });

  if (!uploadResponse.ok) {
    const status = uploadResponse.status === 401 ? 403 : uploadResponse.status;
    return fail(
      status === 403
        ? "Directus rejected the upload: this token may not create files."
        : `Directus rejected the upload (${uploadResponse.status}).`,
      status === 403 ? 403 : 502,
    );
  }

  const uploaded = (await uploadResponse.json()) as { data: { id: string } };

  const patchResponse = await fetch(
    `${directusUrl}/items/parking_lots/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...configuratorHeaders(configuratorToken), "Content-Type": "application/json" },
      body: JSON.stringify({ layout_svg: uploaded.data.id }),
    },
  );

  if (!patchResponse.ok) {
    const forbidden = patchResponse.status === 401 || patchResponse.status === 403;
    return fail(
      forbidden
        ? "Directus rejected the change: this token may not update the lot layout."
        : `Directus rejected the change (${patchResponse.status}). The lot layout is unchanged.`,
      forbidden ? 403 : 502,
    );
  }

  return NextResponse.json<LayoutUploadResponse>({
    ok: true,
    stage: "uploaded",
    report,
    fileId: uploaded.data.id,
    previousFileId: lot.layout_svg,
  });
}
