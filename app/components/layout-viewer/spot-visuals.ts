import type { SpotState } from "@/lib/layout-status";

/**
 * Visual vocabulary for the layout canvas.
 *
 * State colours are deliberately outside the brand yellow: #FACC15 is reserved
 * for selection and hover, so an operator never confuses "this spot is picked"
 * with "this spot is in a given state". The drawing itself keeps its light
 * paper surface in both themes, so one palette works for light and dark.
 */

export type VisualState = SpotState | "unmapped";

export type SpotVisual = {
  label: string;
  description: string;
  fill: string;
  stroke: string;
  dashed?: boolean;
};

export const SPOT_VISUALS: Record<VisualState, SpotVisual> = {
  occupied: {
    label: "Occupied",
    description: "An open session is parked on this spot.",
    fill: "#fca5a5",
    stroke: "#b91c1c",
  },
  free: {
    label: "Free",
    description: "Available capacity, no open session.",
    fill: "#86efac",
    stroke: "#15803d",
  },
  out_of_service: {
    label: "Out of service",
    description: "Maintenance or closed: not bookable capacity.",
    fill: "#d6d3d1",
    stroke: "#57534e",
    dashed: true,
  },
  unmapped: {
    label: "Unmapped",
    description: "Drawn in the SVG but no parking spot claims it.",
    fill: "#ddd6fe",
    stroke: "#6d28d9",
    dashed: true,
  },
};

export const VISUAL_STATE_ORDER: VisualState[] = [
  "occupied",
  "free",
  "out_of_service",
  "unmapped",
];

/** Selection and hover colour: the brand accent, never a state colour. */
export const SELECTION_STROKE = "#facc15";

function stateRule(state: VisualState): string {
  const visual = SPOT_VISUALS[state];
  return [
    `.layout-canvas [data-spot-state="${state}"] {`,
    `  fill: ${visual.fill};`,
    `  stroke: ${visual.stroke};`,
    `  stroke-width: 2;`,
    visual.dashed ? "  stroke-dasharray: 6 4;" : "",
    `}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Styling is applied through `data-spot-state` attributes rather than inline
 * styles: an attribute selector outranks the class rules that ship inside the
 * uploaded SVG, and the markup stays inspectable.
 */
export const LAYOUT_CANVAS_CSS = `
.layout-canvas svg {
  display: block;
  width: 100%;
  height: auto;
}
.layout-canvas text {
  pointer-events: none;
  user-select: none;
}
.layout-canvas [data-spot-state] {
  cursor: pointer;
  transition: fill 120ms ease, stroke 120ms ease, stroke-width 120ms ease;
}
${VISUAL_STATE_ORDER.map(stateRule).join("\n")}
.layout-canvas [data-spot-state]:hover,
.layout-canvas [data-spot-state]:focus-visible,
.layout-canvas [data-spot-state][data-selected="true"] {
  stroke: ${SELECTION_STROKE};
  stroke-width: 5;
  stroke-dasharray: none;
  outline: none;
}
@media (prefers-reduced-motion: reduce) {
  .layout-canvas [data-spot-state] {
    transition: none;
  }
}
`.trim();

/** Readable label for a `parking_spots.type` value. */
export function formatSpotType(type: string | null): string {
  if (!type) return "Unspecified";
  return type
    .split(/[_\s-]+/)
    .map((part) => (part.length <= 2 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}
