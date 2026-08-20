"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import type { ECharts } from "echarts/core";
import { cn } from "@/lib/utils";

/**
 * Minimal ECharts binding for the reports surface.
 *
 * ECharts is loaded lazily and tree-shaken (only the chart types and
 * components the reports actually use), so the server-rendered page ships no
 * charting code until it hydrates. Colors come from the shell's CSS custom
 * properties instead of a baked-in palette, which keeps light and dark mode in
 * sync with the rest of the product.
 */

export type ChartTokens = {
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  card: string;
  brand: string;
  brandForeground: string;
  destructive: string;
  neutral: string;
  faint: string;
};

const FALLBACK_TOKENS: ChartTokens = {
  foreground: "#1c1917",
  muted: "#f5f5f4",
  mutedForeground: "#57534e",
  border: "#e7e5e4",
  card: "#ffffff",
  brand: "#facc15",
  brandForeground: "#1c1917",
  destructive: "#c2410c",
  neutral: "#78716c",
  faint: "#d6d3d1",
};

function readTokens(): ChartTokens {
  if (typeof window === "undefined") return FALLBACK_TOKENS;
  const styles = window.getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value === "" ? fallback : value;
  };

  return {
    foreground: read("--foreground", FALLBACK_TOKENS.foreground),
    muted: read("--muted", FALLBACK_TOKENS.muted),
    mutedForeground: read("--muted-foreground", FALLBACK_TOKENS.mutedForeground),
    border: read("--border", FALLBACK_TOKENS.border),
    card: read("--card", FALLBACK_TOKENS.card),
    brand: read("--brand", FALLBACK_TOKENS.brand),
    brandForeground: read("--brand-foreground", FALLBACK_TOKENS.brandForeground),
    destructive: read("--destructive", FALLBACK_TOKENS.destructive),
    neutral: read("--chart-4", FALLBACK_TOKENS.neutral),
    faint: read("--chart-5", FALLBACK_TOKENS.faint),
  };
}

/**
 * Palette tokens for the active theme, re-read whenever `next-themes` swaps the
 * `dark` class on `<html>`.
 */
export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(FALLBACK_TOKENS);

  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return tokens;
}

/** Shared axis, grid and tooltip styling so both charts read as one system. */
export function chartBase(tokens: ChartTokens): EChartsOption {
  return {
    animationDuration: 320,
    textStyle: { fontFamily: "inherit" },
    grid: { left: 8, right: 12, top: 28, bottom: 4, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: tokens.card,
      borderColor: tokens.border,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: tokens.foreground, fontSize: 12 },
      axisPointer: { type: "shadow", shadowStyle: { color: `${tokens.muted}80` } },
    },
    legend: {
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      textStyle: { color: tokens.mutedForeground, fontSize: 11 },
    },
  };
}

export function axisStyle(tokens: ChartTokens) {
  return {
    axisLine: { lineStyle: { color: tokens.border } },
    axisTick: { show: false },
    axisLabel: { color: tokens.mutedForeground, fontSize: 11, hideOverlap: true },
    splitLine: { lineStyle: { color: tokens.border, type: "dashed" as const } },
  };
}

export function EChart({
  option,
  height = 280,
  label,
  className,
}: {
  option: EChartsOption;
  height?: number;
  /** Short description of the chart for assistive technology. */
  label: string;
  className?: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const chart = useRef<ECharts | null>(null);
  const [ready, setReady] = useState(false);
  const style = useMemo(() => ({ height: `${height}px` }), [height]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [core, charts, components, renderers] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/renderers"),
      ]);

      core.use([
        charts.BarChart,
        charts.LineChart,
        components.GridComponent,
        components.LegendComponent,
        components.MarkLineComponent,
        components.TooltipComponent,
        renderers.CanvasRenderer,
      ]);

      if (cancelled || !container.current) return;
      chart.current = core.init(container.current, undefined, { renderer: "canvas" });
      setReady(true);
    })();

    return () => {
      cancelled = true;
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !chart.current) return;
    // `notMerge` keeps a shrinking range from leaving stale series behind.
    chart.current.setOption(option, true);
  }, [option, ready]);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={container}
      role="img"
      aria-label={label}
      style={style}
      className={cn("w-full", !ready && "animate-pulse rounded-md bg-muted/60", className)}
    />
  );
}
