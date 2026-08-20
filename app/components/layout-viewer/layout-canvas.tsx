"use client";

import * as React from "react";
import { CarFront, MousePointerClick, TriangleAlert } from "lucide-react";
import type { MappedSpot } from "@/lib/layout-status";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LAYOUT_CANVAS_CSS,
  SPOT_VISUALS,
  VISUAL_STATE_ORDER,
  formatSpotType,
  type VisualState,
} from "@/components/layout-viewer/spot-visuals";

export type LayoutCanvasProps = {
  /** Sanitized SVG markup. Never pass raw file content here. */
  markup: string;
  /** Spot state keyed by the SVG element id it maps to. */
  spotsByElementId: Record<string, MappedSpot>;
  /** Shape ids drawn in the SVG that no spot claims. */
  orphanElements: string[];
  /** Accessible name for the drawing. */
  title: string;
};

type HoverState = {
  elementId: string;
  x: number;
  y: number;
};

function visualStateOf(
  elementId: string,
  spots: Record<string, MappedSpot>,
  orphans: Set<string>,
): VisualState | null {
  const spot = spots[elementId];
  if (spot) return spot.state;
  return orphans.has(elementId) ? "unmapped" : null;
}

/**
 * Renders the sanitized layout and drives interaction from the DOM.
 *
 * The SVG is injected as markup, so React does not own those nodes. State is
 * applied after mount by looking each element up by id and stamping
 * `data-spot-state`; pointer and keyboard events are handled through delegation
 * on the wrapper, which keeps a single listener no matter how many spots the
 * drawing has.
 */
export function LayoutCanvas({
  markup,
  spotsByElementId,
  orphanElements,
  title,
}: LayoutCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<HoverState | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear anything a previous refresh stamped, then re-apply.
    for (const node of Array.from(container.querySelectorAll("[data-spot-state]"))) {
      node.removeAttribute("data-spot-state");
      node.removeAttribute("data-spot-selected");
      node.removeAttribute("tabindex");
      node.removeAttribute("role");
      node.removeAttribute("aria-label");
    }

    const decorate = (elementId: string, state: VisualState, label: string) => {
      const node = container.querySelector(`[id="${CSS.escape(elementId)}"]`);
      if (!node) return;
      node.setAttribute("data-spot-state", state);
      node.setAttribute("data-element-id", elementId);
      node.setAttribute("tabindex", "0");
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", label);
    };

    for (const spot of Object.values(spotsByElementId)) {
      const detail =
        spot.state === "occupied"
          ? `occupied by ${spot.plate ?? "an unidentified vehicle"}`
          : SPOT_VISUALS[spot.state].label.toLowerCase();
      decorate(spot.elementId, spot.state, `Spot ${spot.code}, ${detail}`);
    }
    for (const elementId of orphanElements) {
      decorate(elementId, "unmapped", `Unmapped layout element ${elementId}`);
    }
  }, [markup, spotsByElementId, orphanElements]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    for (const node of Array.from(container.querySelectorAll("[data-selected]"))) {
      node.removeAttribute("data-selected");
    }
    if (!selectedId) return;
    const node = container.querySelector(`[id="${CSS.escape(selectedId)}"]`);
    node?.setAttribute("data-selected", "true");
  }, [selectedId, markup, spotsByElementId]);

  const elementIdFrom = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    const node = target.closest("[data-element-id]");
    return node?.getAttribute("data-element-id") ?? null;
  };

  const pointFor = (event: { clientX: number; clientY: number }) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const elementId = elementIdFrom(event.target);
    if (!elementId) {
      setHover(null);
      return;
    }
    setHover({ elementId, ...pointFor(event) });
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const elementId = elementIdFrom(event.target);
    setSelectedId((current) => (elementId && current !== elementId ? elementId : null));
  };

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const elementId = elementIdFrom(event.target);
    if (!elementId || !(event.target instanceof Element)) return;
    const containerRect = containerRef.current?.getBoundingClientRect();
    const nodeRect = event.target.getBoundingClientRect();
    setHover({
      elementId,
      x: nodeRect.left + nodeRect.width / 2 - (containerRect?.left ?? 0),
      y: nodeRect.top - (containerRect?.top ?? 0),
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setSelectedId(null);
      setHover(null);
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const elementId = elementIdFrom(event.target);
    if (!elementId) return;
    event.preventDefault();
    setSelectedId((current) => (current === elementId ? null : elementId));
  };

  const orphanSet = React.useMemo(() => new Set(orphanElements), [orphanElements]);
  const hoveredSpot = hover ? (spotsByElementId[hover.elementId] ?? null) : null;
  const hoveredState = hover
    ? visualStateOf(hover.elementId, spotsByElementId, orphanSet)
    : null;
  const detail = selectedId
    ? (spotsByElementId[selectedId] ?? null)
    : (hoveredSpot ?? null);
  const detailElementId = selectedId ?? hover?.elementId ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Live layout</CardTitle>
          <CardDescription>
            Hover a spot for a quick read, click to pin it. Press Escape to clear.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <style dangerouslySetInnerHTML={{ __html: LAYOUT_CANVAS_CSS }} />
          <div
            ref={containerRef}
            role="group"
            aria-label={title}
            className="layout-canvas relative rounded-xl border border-border bg-[#f4f4f2] p-2"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHover(null)}
            onClick={handleClick}
            onFocus={handleFocus}
            onBlur={() => setHover(null)}
            onKeyDown={handleKeyDown}
          >
            <div
              // The markup is sanitized server-side by lib/svg-sanitize.
              dangerouslySetInnerHTML={{ __html: markup }}
            />
            {hover && hoveredState ? (
              <div
                role="tooltip"
                className="pointer-events-none absolute z-50 w-max max-w-xs -translate-x-1/2 -translate-y-[calc(100%+0.75rem)] rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-lg"
                style={{ left: hover.x, top: hover.y }}
              >
                {hoveredSpot ? (
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{hoveredSpot.code}</span>
                    <span className="opacity-80">
                      {SPOT_VISUALS[hoveredSpot.state].label}
                    </span>
                    {hoveredSpot.state === "occupied" ? (
                      <span className="opacity-80">
                        {hoveredSpot.plate ?? "—"} · {hoveredSpot.elapsedLabel ?? "—"}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{hover.elementId}</span>
                    <span className="opacity-80">Unmapped element</span>
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {detail ? `Spot ${detail.code}` : "Spot detail"}
            </CardTitle>
            <CardDescription>
              {detail
                ? selectedId
                  ? "Pinned selection."
                  : "Hovered spot."
                : "Pick a spot on the layout."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {detail ? (
              <dl className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">State</dt>
                  <dd>
                    <StateBadge state={detail.state} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{formatSpotType(detail.type)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Element</dt>
                  <dd className="font-mono text-xs">{detail.elementId}</dd>
                </div>
                {detail.state === "occupied" ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Plate</dt>
                      <dd className="font-mono font-semibold">{detail.plate ?? "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Elapsed</dt>
                      <dd className="font-medium tabular-nums">
                        {detail.elapsedLabel ?? "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Entered</dt>
                      <dd className="font-mono text-xs">
                        {detail.enteredAt ? detail.enteredAt.replace("T", " ").slice(0, 16) : "—"}
                      </dd>
                    </div>
                  </>
                ) : (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <CarFront className="mt-0.5 size-4 shrink-0" />
                    No vehicle on this spot right now.
                  </p>
                )}
              </dl>
            ) : detailElementId ? (
              <p className="flex items-start gap-2 text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="font-mono">{detailElementId}</span> is drawn in the layout
                  but no spot record claims it.
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-2 text-muted-foreground">
                <MousePointerClick className="mt-0.5 size-4 shrink-0" />
                Hover or click a spot to read its code, type, plate and dwell time.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {VISUAL_STATE_ORDER.map((state) => (
              <div key={state} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 rounded-[3px] border-2"
                  style={{
                    backgroundColor: SPOT_VISUALS[state].fill,
                    borderColor: SPOT_VISUALS[state].stroke,
                    borderStyle: SPOT_VISUALS[state].dashed ? "dashed" : "solid",
                  }}
                />
                <div className="min-w-0">
                  <p className="text-sm leading-tight font-medium">
                    {SPOT_VISUALS[state].label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {SPOT_VISUALS[state].description}
                  </p>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2.5 border-t border-border pt-2.5">
              <span
                aria-hidden
                className="mt-0.5 size-4 shrink-0 rounded-[3px] border-2 border-primary bg-transparent"
              />
              <div className="min-w-0">
                <p className="text-sm leading-tight font-medium">Selected or hovered</p>
                <p className="text-xs text-muted-foreground">
                  The yellow accent marks focus, never a state.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: VisualState }) {
  const visual = SPOT_VISUALS[state];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium")}
      // The state palette is a light "paper" palette, so it always carries the
      // dark ink of the brand instead of following the theme's foreground.
      style={{
        backgroundColor: visual.fill,
        borderColor: visual.stroke,
        color: "#1c1917",
      }}
    >
      {visual.label}
    </Badge>
  );
}
