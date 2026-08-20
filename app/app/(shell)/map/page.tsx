import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CityMap } from "@/components/map/city-map";
import { fetchMapLots, getMapCenter } from "@/lib/map-data";

export const metadata: Metadata = {
  title: "Map",
  description: "Spatial view of every managed site and its live state.",
};

/** Framing fallback when no lot can be plotted. */
const SANTIAGO = { latitude: -33.4372, longitude: -70.6506 };

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const lots = await fetchMapLots();
  const center = getMapCenter(lots, SANTIAGO);
  const ionToken = process.env.CESIUM_ION_TOKEN?.trim() || undefined;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations"
        title="Map"
        description="Every managed lot on the city globe, coloured by how full it is right now. Select a point to read its occupancy and open the lot report."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono text-[0.68rem] uppercase">
          {lots.length} {lots.length === 1 ? "lot" : "lots"}
        </Badge>
        <p className="text-sm text-muted-foreground">
          Occupancy is the share of capacity held by sessions that have not exited.
          Imagery comes from OpenStreetMap and needs no API key.
        </p>
      </div>

      {lots.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No lot has usable coordinates yet. Apply the Directus schema and seed with{" "}
            <code className="font-mono text-xs">pnpm dev</code> to populate the map.
          </p>
        </div>
      ) : (
        <CityMap lots={lots} center={center} ionToken={ionToken} />
      )}
    </PageContainer>
  );
}
