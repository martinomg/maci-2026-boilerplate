"use client";

import { useEffect, useRef, useState } from "react";
import type { ConstantProperty, Entity, Property, Viewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { MapLot } from "@/lib/map-data";
import { OCCUPANCY_BANDS } from "./occupancy-band";

/**
 * Where Cesium loads its web workers, textures and widget assets from at run
 * time. `scripts/copy-cesium-assets.mjs` writes them into `public/cesium`.
 */
const CESIUM_BASE_URL = "/cesium/";

/** Tokenless imagery. OpenStreetMap needs no Cesium Ion account or API key. */
const OSM_TILE_URL = "https://tile.openstreetmap.org/";

const CAMERA_PITCH_DEGREES = -50;
const CAMERA_RANGE_METERS = 30_000;

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

type PickedFeature = { id?: unknown } | undefined;

/** Updates a Cesium graphics property that was created from a plain number. */
function setConstant(property: Property | undefined, value: number) {
  const constant = property as ConstantProperty | undefined;
  if (typeof constant?.setValue === "function") constant.setValue(value);
}

export type CesiumGlobeProps = {
  lots: MapLot[];
  center: { latitude: number; longitude: number };
  selectedLotId: string | null;
  onSelectLot: (lotId: string | null) => void;
  /** Optional Cesium Ion token. Imagery works without it. */
  ionToken?: string;
};

export function CesiumGlobe({
  lots,
  center,
  selectedLotId,
  onSelectLot,
  ionToken,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const entitiesRef = useRef<Map<string, Entity>>(new Map());
  const onSelectLotRef = useRef(onSelectLot);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onSelectLotRef.current = onSelectLot;
  }, [onSelectLot]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let dispose: (() => void) | undefined;

    async function start(target: HTMLDivElement) {
      // Cesium reads this the first time its module graph evaluates, so it has
      // to be assigned before the dynamic import resolves.
      window.CESIUM_BASE_URL = CESIUM_BASE_URL;
      const Cesium = await import("cesium");
      if (disposed) return;

      if (ionToken) {
        Cesium.Ion.defaultAccessToken = ionToken;
      }

      const viewer = new Cesium.Viewer(target, {
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.OpenStreetMapImageryProvider({ url: OSM_TILE_URL }),
        ),
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        scene3DOnly: true,
        requestRenderMode: true,
        maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      });

      viewerRef.current = viewer;
      viewer.scene.globe.enableLighting = false;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;

      const entities = new Map<string, Entity>();
      for (const lot of lots) {
        const band = OCCUPANCY_BANDS[lot.band];
        const entity = viewer.entities.add({
          id: lot.id,
          name: lot.name,
          position: Cesium.Cartesian3.fromDegrees(lot.longitude, lot.latitude),
          point: {
            pixelSize: 18,
            color: Cesium.Color.fromCssColorString(band.color),
            outlineColor: Cesium.Color.fromCssColorString("#1C1917"),
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: `${lot.name}\n${lot.occupancyPercent}% full`,
            font: "600 13px ui-sans-serif, system-ui, sans-serif",
            fillColor: Cesium.Color.fromCssColorString("#FAFAF9"),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString("#1C1917").withAlpha(0.82),
            backgroundPadding: new Cesium.Cartesian2(9, 6),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        entities.set(lot.id, entity);
      }
      entitiesRef.current = entities;

      viewer.camera.lookAt(
        Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude),
        new Cesium.HeadingPitchRange(
          0,
          Cesium.Math.toRadians(CAMERA_PITCH_DEGREES),
          CAMERA_RANGE_METERS,
        ),
      );
      // Release the reference frame so the user can pan away from the centre.
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { position: import("cesium").Cartesian2 }) => {
        const picked = viewer.scene.pick(movement.position) as PickedFeature;
        const pickedEntity = picked?.id;
        const lotId =
          pickedEntity && typeof (pickedEntity as Entity).id === "string"
            ? (pickedEntity as Entity).id
            : null;
        onSelectLotRef.current(lotId);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      setStatus("ready");

      dispose = () => {
        handler.destroy();
        entitiesRef.current = new Map();
        viewerRef.current = null;
        if (!viewer.isDestroyed()) viewer.destroy();
      };
    }

    start(container).catch((error: unknown) => {
      if (disposed) return;
      console.error("Failed to initialise the Cesium viewer", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setStatus("error");
    });

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [center.latitude, center.longitude, ionToken, lots]);

  // Emphasise the selected lot without rebuilding the viewer.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    for (const [lotId, entity] of entitiesRef.current) {
      const isSelected = lotId === selectedLotId;
      if (!entity.point) continue;
      // Cesium wraps the numbers we passed at creation time in ConstantProperty.
      setConstant(entity.point.pixelSize, isSelected ? 26 : 18);
      setConstant(entity.point.outlineWidth, isSelected ? 4 : 2);
    }
    viewer.scene.requestRender();
  }, [selectedLotId, status]);

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="size-full" data-testid="cesium-container" />
      {status !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60 px-6 text-center backdrop-blur-sm">
          {status === "loading" ? (
            <p className="font-mono text-[0.68rem] tracking-[0.18em] text-muted-foreground uppercase">
              Loading globe…
            </p>
          ) : (
            <p className="max-w-md text-sm text-muted-foreground">
              The map could not start. {errorMessage}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
