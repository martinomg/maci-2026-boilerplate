"use client";

import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import { EChart } from "@/components/charts/echart";

export type TrendPoint = { label: string; percent: number | null };
export type LotStayPoint = { label: string; minutes: number | null };

/**
 * Citywide occupancy over the trailing window.
 *
 * Props stay plain (label plus number) because they cross the server/client
 * boundary; the option — which carries tooltip formatter functions — is built
 * here, on the client.
 */
export function OccupancyTrendChart({
  points,
  ariaLabel,
}: {
  points: TrendPoint[];
  ariaLabel: string;
}) {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { top: 16, right: 16, bottom: 8, left: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) =>
          value === null || value === undefined ? "—" : `${value}%`,
      },
      xAxis: {
        type: "category",
        data: points.map((point) => point.label),
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        interval: 25,
        axisLabel: { formatter: "{value}%" },
      },
      series: [
        {
          name: "Citywide occupancy",
          type: "line",
          smooth: 0.3,
          showSymbol: true,
          symbolSize: 7,
          lineStyle: { width: 3 },
          areaStyle: { opacity: 0.16 },
          data: points.map((point) => point.percent),
        },
      ],
    }),
    [points],
  );

  return <EChart option={option} ariaLabel={ariaLabel} height="17rem" />;
}

/** Average stay per lot for the trailing window, longest first. */
export function AverageStayChart({
  points,
  ariaLabel,
}: {
  points: LotStayPoint[];
  ariaLabel: string;
}) {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { top: 16, right: 24, bottom: 8, left: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value) =>
          value === null || value === undefined ? "—" : `${value} min`,
      },
      xAxis: { type: "value", axisLabel: { formatter: "{value}m" } },
      yAxis: {
        type: "category",
        data: points.map((point) => point.label),
        axisLabel: { width: 130, overflow: "truncate" },
      },
      series: [
        {
          name: "Average stay",
          type: "bar",
          barMaxWidth: 22,
          itemStyle: { borderRadius: [0, 6, 6, 0] },
          data: points.map((point) => point.minutes),
        },
      ],
    }),
    [points],
  );

  return <EChart option={option} ariaLabel={ariaLabel} height="17rem" />;
}
