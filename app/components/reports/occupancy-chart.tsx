"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { OccupancyPoint, OccupancyResolution } from "@/lib/reports";
import { axisStyle, chartBase, EChart, useChartTokens } from "./echart";
import { formatHour, formatTimestamp } from "./format";

/**
 * Peak vehicles on site per bucket, with the lot's capacity as a reference
 * line so a full lot is readable without doing the division in your head.
 */
export function OccupancyChart({
  points,
  resolution,
  capacity,
}: {
  points: OccupancyPoint[];
  resolution: OccupancyResolution;
  capacity: number | null;
}) {
  const tokens = useChartTokens();

  const option = useMemo<EChartsOption>(() => {
    const data = points.map((point) => [point.bucket, point.occupancy] as [string, number]);
    const rateByBucket = new Map(points.map((point) => [point.bucket, point.occupancyRate]));

    return {
      ...chartBase(tokens),
      useUTC: true,
      legend: { show: false },
      grid: { left: 8, right: 12, top: 12, bottom: 4, containLabel: true },
      tooltip: {
        ...chartBase(tokens).tooltip,
        axisPointer: { type: "line", lineStyle: { color: tokens.border } },
        formatter: (params) => {
          const first = Array.isArray(params) ? params[0] : params;
          const value = first?.value as [string, number] | undefined;
          if (!value) return "";
          const rate = rateByBucket.get(value[0]);
          const when =
            resolution === "hour" ? formatTimestamp(value[0]) : formatTimestamp(value[0]).slice(0, 6);
          const share = rate === null || rate === undefined ? "" : ` · ${Math.round(rate * 100)}%`;
          return `<div style="font-size:11px;opacity:.7">${when}</div><strong>${value[1]}</strong> vehicles${share}`;
        },
      },
      xAxis: {
        type: "time",
        ...axisStyle(tokens),
        splitLine: { show: false },
        axisLabel: {
          color: tokens.mutedForeground,
          fontSize: 11,
          hideOverlap: true,
          formatter: {
            year: "{yyyy}",
            month: "{MMM}",
            day: "{d} {MMM}",
            hour: resolution === "hour" ? "{HH}:{mm}" : "{d} {MMM}",
            minute: "{HH}:{mm}",
            second: "{HH}:{mm}",
            millisecond: "{HH}:{mm}",
            none: "{d} {MMM}",
          },
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        ...axisStyle(tokens),
        axisLine: { show: false },
      },
      series: [
        {
          type: "line",
          name: "Vehicles on site",
          data,
          showSymbol: false,
          smooth: 0.2,
          lineStyle: { width: 2, color: tokens.brand },
          itemStyle: { color: tokens.brand },
          areaStyle: {
            opacity: 0.9,
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${tokens.brand}59` },
                { offset: 1, color: `${tokens.brand}05` },
              ],
            },
          },
          ...(capacity
            ? {
                markLine: {
                  silent: true,
                  symbol: "none",
                  lineStyle: { color: tokens.mutedForeground, type: "dashed", width: 1 },
                  label: {
                    formatter: `Capacity ${capacity}`,
                    color: tokens.mutedForeground,
                    fontSize: 10,
                    position: "insideEndTop",
                  },
                  data: [{ yAxis: capacity }],
                },
              }
            : {}),
        },
      ],
    };
  }, [capacity, points, resolution, tokens]);

  const busiest = points.reduce(
    (peak, point) => (point.occupancy > peak.occupancy ? point : peak),
    points[0] ?? { bucket: "", occupancy: 0, occupancyRate: null },
  );

  return (
    <EChart
      option={option}
      height={280}
      label={`Occupancy over time, ${resolution === "hour" ? "hourly" : "daily"} peak vehicles on site. Busiest bucket ${
        busiest.bucket ? `${formatTimestamp(busiest.bucket)} at ${busiest.occupancy} vehicles` : "none"
      }.${resolution === "hour" && busiest.bucket ? ` (${formatHour(busiest.bucket)} UTC)` : ""}`}
    />
  );
}
