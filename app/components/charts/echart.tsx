"use client";

import type { EChartsOption } from "echarts";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal surface of an ECharts instance this wrapper drives. Declaring it
 * locally keeps the module free of a top-level `echarts` import, so the library
 * only ever arrives through the dynamic import inside the effect.
 */
type ChartInstance = {
  setOption: (option: EChartsOption, notMerge?: boolean) => void;
  resize: () => void;
  dispose: () => void;
};

export type EChartProps = {
  /** Plain, server-serialisable ECharts option. Data only, no theming. */
  option: EChartsOption;
  /** Described to assistive tech, which cannot read the canvas. */
  ariaLabel: string;
  className?: string;
  /** CSS height for the chart surface. */
  height?: string;
};

type ThemeTokens = {
  palette: string[];
  foreground: string;
  muted: string;
  border: string;
  card: string;
  fontFamily: string;
};

const THEME_NAME = "maci";

/**
 * Reads the design tokens as resolved for `element`. Custom properties inherit,
 * so the chart container sees whichever palette `:root` or `.dark` currently
 * defines, plus the real resolved font stack from the body.
 */
function readCssTokens(element: HTMLElement): ThemeTokens {
  const styles = getComputedStyle(element);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    // The five shadcn chart slots already carry the yellow accent as chart-1.
    palette: [
      token("--chart-1", "#facc15"),
      token("--chart-2", "#1c1917"),
      token("--chart-3", "#a16207"),
      token("--chart-4", "#78716c"),
      token("--chart-5", "#d6d3d1"),
    ],
    foreground: token("--foreground", "#1c1917"),
    muted: token("--muted-foreground", "#57534e"),
    border: token("--border", "#e7e5e4"),
    card: token("--card", "#ffffff"),
    fontFamily: styles.fontFamily || "sans-serif",
  };
}

/** ECharts theme object built from the live design tokens. */
function buildTheme(tokens: ThemeTokens) {
  const axisLabel = { color: tokens.muted, fontSize: 11 };
  const splitLine = {
    lineStyle: { color: tokens.border, type: "dashed" as const },
  };

  return {
    color: tokens.palette,
    backgroundColor: "transparent",
    textStyle: { fontFamily: tokens.fontFamily, color: tokens.muted },
    categoryAxis: {
      axisLine: { lineStyle: { color: tokens.border } },
      axisTick: { show: false },
      axisLabel,
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel,
      splitLine,
    },
    legend: { textStyle: { color: tokens.muted } },
    tooltip: {
      backgroundColor: tokens.card,
      borderColor: tokens.border,
      borderWidth: 1,
      textStyle: { color: tokens.foreground, fontSize: 12 },
      extraCssText: "box-shadow: 0 8px 24px rgb(0 0 0 / 0.12); border-radius: 10px;",
    },
    grid: { containLabel: true },
  };
}

/**
 * Client-only ECharts surface.
 *
 * The library is pulled in with a dynamic `import()` from inside the effect, so
 * it never reaches the server bundle and only downloads once a chart is
 * actually mounted. Only the tree-shaken `echarts/core` entry points are
 * loaded — line and bar charts with the canvas renderer.
 *
 * Colours come from the CSS custom properties on `<html>`, so the chart follows
 * the yellow accent and flips with the `dark` class that next-themes toggles.
 */
export function EChart({
  option,
  ariaLabel,
  className,
  height = "16rem",
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartInstance | null>(null);
  const optionRef = useRef(option);
  const [ready, setReady] = useState(false);
  // Bumped whenever the `dark` class flips so the effect rebuilds the theme.
  const [themeEpoch, setThemeEpoch] = useState(0);

  // Watch the root element for the class next-themes swaps on theme change.
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setThemeEpoch((epoch) => epoch + 1));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let chart: ChartInstance | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void (async () => {
      const [core, charts, components, renderers] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/renderers"),
      ]);

      if (disposed) return;

      core.use([
        charts.BarChart,
        charts.LineChart,
        components.GridComponent,
        components.TooltipComponent,
        components.LegendComponent,
        renderers.CanvasRenderer,
      ]);

      core.registerTheme(THEME_NAME, buildTheme(readCssTokens(container)));
      chart = core.init(container, THEME_NAME, {
        renderer: "canvas",
      }) as unknown as ChartInstance;
      chartRef.current = chart;
      chart.setOption(optionRef.current, true);
      setReady(true);

      resizeObserver = new ResizeObserver(() => chart?.resize());
      resizeObserver.observe(container);
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chart?.dispose();
      chartRef.current = null;
    };
    // `themeEpoch` forces a full re-init so the registered theme is re-read.
  }, [themeEpoch]);

  // Data-only updates reuse the live instance instead of rebuilding it. The
  // ref keeps the newest option available to a later theme re-init.
  useEffect(() => {
    optionRef.current = option;
    chartRef.current?.setOption(option, true);
  }, [option]);

  return (
    <div
      className={cn("relative w-full", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <div ref={containerRef} className="h-full w-full" />
      {ready ? null : (
        <div
          aria-hidden
          className="absolute inset-0 animate-pulse rounded-lg bg-muted/60"
        />
      )}
    </div>
  );
}
