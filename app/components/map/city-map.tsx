"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, MapPin, X } from "lucide-react";
import type { MapLot } from "@/lib/map-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OCCUPANCY_BAND_ORDER, OCCUPANCY_BANDS } from "./occupancy-band";

/**
 * CesiumJS touches `window` and WebGL while its module graph evaluates, so the
 * globe is client-only and never rendered on the server.
 */
const CesiumGlobe = dynamic(
  () => import("./cesium-globe").then((module) => module.CesiumGlobe),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center bg-muted/60">
        <p className="font-mono text-[0.68rem] tracking-[0.18em] text-muted-foreground uppercase">
          Loading globe…
        </p>
      </div>
    ),
  },
);

export type CityMapProps = {
  lots: MapLot[];
  center: { latitude: number; longitude: number };
  ionToken?: string;
};

export function CityMap({ lots, center, ionToken }: CityMapProps) {
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  const selectedLot = useMemo(
    () => lots.find((lot) => lot.id === selectedLotId) ?? null,
    [lots, selectedLotId],
  );

  const handleSelectLot = useCallback((lotId: string | null) => {
    setSelectedLotId(lotId);
  }, []);

  return (
    <div className="relative h-[clamp(28rem,72vh,54rem)] w-full overflow-hidden rounded-xl border bg-card shadow-sm">
      <CesiumGlobe
        lots={lots}
        center={center}
        selectedLotId={selectedLotId}
        onSelectLot={handleSelectLot}
        ionToken={ionToken}
      />

      <MapLegend className="absolute top-4 left-4 max-w-[15rem]" lots={lots} />

      {selectedLot ? (
        <LotPanel
          lot={selectedLot}
          onClose={() => setSelectedLotId(null)}
          className="absolute top-4 right-4 w-[min(20rem,calc(100%-2rem))]"
        />
      ) : (
        <div className="pointer-events-none absolute right-4 bottom-14 rounded-lg border bg-card/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          Select a lot to inspect it.
        </div>
      )}
    </div>
  );
}

function MapLegend({ lots, className }: { lots: MapLot[]; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card/90 p-3 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <p className="mb-2 font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
        Occupancy
      </p>
      <ul className="space-y-1.5">
        {OCCUPANCY_BAND_ORDER.map((band) => {
          const { label, range, color } = OCCUPANCY_BANDS[band];
          const count = lots.filter((lot) => lot.band === band).length;
          return (
            <li key={band} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/20"
                style={{ backgroundColor: color }}
              />
              <span className="flex-1 font-medium">{label}</span>
              <span className="font-mono text-[0.68rem] text-muted-foreground tabular-nums">
                {range}
              </span>
              <span className="w-4 text-right font-mono text-[0.68rem] tabular-nums">
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LotPanel({
  lot,
  onClose,
  className,
}: {
  lot: MapLot;
  onClose: () => void;
  className?: string;
}) {
  const band = OCCUPANCY_BANDS[lot.band];

  return (
    <div
      className={cn(
        "rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground uppercase">
            <MapPin className="size-3" />
            {lot.city ?? "Lot"}
          </p>
          <h2 className="text-base leading-tight font-semibold text-balance">
            {lot.name}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close lot details"
        >
          <X />
        </Button>
      </div>

      {lot.address ? (
        <p className="mt-1 text-xs text-muted-foreground">{lot.address}</p>
      ) : null}

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {lot.occupancyPercent}%
        </span>
        <Badge variant="outline" className={cn("border-transparent", band.badgeClassName)}>
          {band.label}
        </Badge>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${lot.occupancyPercent}%`,
            backgroundColor: band.color,
          }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Capacity</dt>
          <dd className="font-mono text-sm tabular-nums">{lot.capacity}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Occupied now</dt>
          <dd className="font-mono text-sm tabular-nums">{lot.openSessions}</dd>
        </div>
      </dl>

      <Button className="mt-4 w-full" asChild>
        <Link href={`/reports/${lot.id}`}>
          Open lot report
          <ArrowUpRight />
        </Link>
      </Button>
    </div>
  );
}
