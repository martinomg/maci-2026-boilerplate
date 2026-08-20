"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { DailyActivityRow } from "@/lib/reports";
import { axisStyle, chartBase, EChart, useChartTokens } from "./echart";
import { formatDay, formatDayLong } from "./format";

/**
 * Vehicle exits against the payments that settled them, per day.
 *
 * The third series is the gap between the two — every exit that left without a
 * transaction — drawn in the destructive color so leakage is the first thing
 * the eye lands on.
 */
export function LeakChart({ rows }: { rows: DailyActivityRow[] }) {
  const tokens = useChartTokens();

  const option = useMemo<EChartsOption>(() => {
    const days = rows.map((row) => row.day);

    return {
      ...chartBase(tokens),
      tooltip: {
        ...chartBase(tokens).tooltip,
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params];
          const day = days[Number(list[0]?.dataIndex ?? 0)];
          const lines = list
            .map(
              (item) =>
                `<div style="display:flex;gap:8px;justify-content:space-between"><span>${item.marker ?? ""} ${item.seriesName}</span><strong>${item.value}</strong></div>`,
            )
            .join("");
          return `<div style="font-size:11px;opacity:.7;margin-bottom:4px">${day ? formatDayLong(day) : ""}</div>${lines}`;
        },
      },
      xAxis: {
        type: "category",
        data: days,
        ...axisStyle(tokens),
        splitLine: { show: false },
        axisLabel: {
          color: tokens.mutedForeground,
          fontSize: 11,
          hideOverlap: true,
          formatter: (value: string) => formatDay(value),
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
          type: "bar",
          name: "Exits",
          data: rows.map((row) => row.exits),
          itemStyle: { color: tokens.neutral, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 18,
        },
        {
          type: "bar",
          name: "Transactions",
          data: rows.map((row) => row.transactions),
          itemStyle: { color: tokens.brand, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 18,
        },
        {
          type: "bar",
          name: "Unpaid exits",
          data: rows.map((row) => row.unpaidExits),
          itemStyle: { color: tokens.destructive, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 18,
          label: {
            show: true,
            position: "top",
            fontSize: 10,
            color: tokens.destructive,
            formatter: (params) => (Number(params.value) > 0 ? String(params.value) : ""),
          },
        },
      ],
    };
  }, [rows, tokens]);

  const totalUnpaid = rows.reduce((sum, row) => sum + row.unpaidExits, 0);
  const totalExits = rows.reduce((sum, row) => sum + row.exits, 0);
  const totalTransactions = rows.reduce((sum, row) => sum + row.transactions, 0);

  return (
    <EChart
      option={option}
      height={280}
      label={`Transactions versus vehicle exits per day: ${totalExits} exits, ${totalTransactions} transactions and ${totalUnpaid} unpaid exits over the selected range.`}
    />
  );
}
