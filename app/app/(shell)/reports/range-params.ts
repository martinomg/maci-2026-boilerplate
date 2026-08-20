import { DEFAULT_RANGE_DAYS, RANGE_PRESETS, type RangePreset } from "@/lib/reports";

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads the `days` preset from the URL.
 *
 * Returns `null` when the caller passed an explicit `from`/`to` window instead,
 * so the preset buttons can render as unselected, and falls back to the default
 * preset for anything unrecognized.
 */
export function readDaysParam(params: SearchParams): RangePreset | null {
  if (first(params.from) && first(params.to)) return null;

  const raw = Number(first(params.days));
  const preset = RANGE_PRESETS.find((candidate) => candidate === raw);
  return preset ?? DEFAULT_RANGE_DAYS;
}

/** Explicit `from`/`to` day keys, when both are present. */
export function readRangeParams(params: SearchParams): { from?: string; to?: string } {
  const from = first(params.from);
  const to = first(params.to);
  return from && to ? { from, to } : {};
}
