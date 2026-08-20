import type { Metadata } from "next";
import { ArrowUpRight, CarFront, CircleGauge, Clock, Wallet } from "lucide-react";
import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  computeAverageStayByLot,
  computeAverageStayMinutes,
  computeCitywideOccupancy,
  computeLotOccupancy,
  computeLotOccupancyTrend,
  computeOccupancyTrend,
  computeRevenue,
  formatClp,
  formatDayLabel,
  formatMinutes,
  formatPercent,
  occupancyBandLabel,
  stripSharedNamePrefix,
  type OccupancyBand,
} from "@/lib/metrics";
import { AverageStayChart, OccupancyTrendChart } from "./charts";
import { HISTORY_DAYS, TREND_DAYS, loadDashboardData } from "./data";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Live occupancy, average stay and revenue across the city.",
};

// Every metric is derived from the current server clock, so the page can never
// be prerendered or cached.
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

/**
 * Yellow is only ever used as a surface with dark ink, so the busiest band gets
 * the primary fill and calmer bands step down through the neutral variants.
 */
const BAND_VARIANT: Record<OccupancyBand, "default" | "secondary" | "outline"> = {
  high: "default",
  elevated: "secondary",
  moderate: "secondary",
  low: "outline",
};

export default async function DashboardPage() {
  const data = await loadDashboardData();
  const now = new Date(data.now);
  const historyStart = new Date(now.getTime() - HISTORY_DAYS * DAY_MS);

  const lotOccupancy = computeLotOccupancy(data.lots, data.sessions, now);
  const citywide = computeCitywideOccupancy(data.lots, data.sessions, now);
  const averageStay = computeAverageStayMinutes(data.sessions, {
    since: historyStart,
    until: now,
  });
  const revenue = computeRevenue(data.transactions, { now, days: TREND_DAYS });
  const trend = computeOccupancyTrend(data.lots, data.sessions, now, TREND_DAYS);
  const stayByLot = computeAverageStayByLot(data.lots, data.sessions, {
    since: historyStart,
    until: now,
  });
  const stayById = new Map(stayByLot.map((entry) => [entry.lotId, entry]));

  const rows = lotOccupancy
    .map((lot) => {
      const source = data.lots.find((entry) => entry.id === lot.lotId);
      return {
        ...lot,
        averageStayMinutes: stayById.get(lot.lotId)?.averageStayMinutes ?? null,
        closedSessions: stayById.get(lot.lotId)?.closedSessions ?? 0,
        sparkline: source
          ? computeLotOccupancyTrend(source, data.sessions, now, TREND_DAYS).map(
              (point) => (point.rate === null ? null : point.rate * 100),
            )
          : [],
      };
    })
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

  const kpis = [
    {
      label: "Managed lots",
      value: String(citywide.lots),
      detail: `${citywide.capacity} spaces across the city`,
      icon: CarFront,
      accent: false,
    },
    {
      label: "Citywide occupancy",
      value: formatPercent(citywide.rate),
      detail: `${citywide.occupied} of ${citywide.capacity} spaces in use now`,
      icon: CircleGauge,
      accent: true,
    },
    {
      label: "Average stay",
      value: formatMinutes(averageStay),
      detail: `Closed sessions, last ${HISTORY_DAYS} days`,
      icon: Clock,
      accent: false,
    },
    {
      label: `Revenue last ${TREND_DAYS} days`,
      value: formatClp(revenue),
      detail: `${data.transactions.length} payments in the last ${HISTORY_DAYS} days`,
      icon: Wallet,
      accent: false,
    },
  ];

  const trendPoints = trend.map((point) => ({
    label: formatDayLabel(point.date),
    percent: point.rate === null ? null : Number((point.rate * 100).toFixed(1)),
  }));

  // The category axis draws its first entry at the bottom, so ascending order
  // puts the longest stay on top.
  const measuredStay = [...stayByLot]
    .filter((entry) => entry.averageStayMinutes !== null)
    .sort((a, b) => (a.averageStayMinutes ?? 0) - (b.averageStayMinutes ?? 0));
  // Every seeded lot starts with "Estacionamiento", which would eat the axis.
  const stayLabels = stripSharedNamePrefix(measuredStay.map((entry) => entry.name));
  const stayPoints = measuredStay.map((entry, index) => ({
    label: stayLabels[index],
    minutes: Math.round(entry.averageStayMinutes ?? 0),
  }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations"
        title="City dashboard"
        description="Occupancy, average stay and revenue for every managed lot, computed from live parking sessions and transactions."
        actions={
          <>
            <Button variant="outline" size="lg" asChild>
              <Link href="/reports">View reports</Link>
            </Button>
            <Button size="lg" asChild>
              <Link href="/map">
                Open map
                <ArrowUpRight />
              </Link>
            </Button>
          </>
        }
      />

      {data.error ? (
        <Card className="mb-4 ring-destructive/40">
          <CardContent>
            <p className="text-sm font-medium">Parking data is unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Directus did not answer this request, so every metric below reads
              zero. Start the stack with <code className="font-mono">pnpm dev</code>{" "}
              and reload.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className={
              kpi.accent ? "relative overflow-hidden ring-2 ring-primary" : undefined
            }
          >
            {kpi.accent ? (
              <div
                aria-hidden
                className="pointer-events-none absolute -top-14 -right-10 size-40 rounded-full bg-primary/20 blur-3xl"
              />
            ) : null}
            <CardContent className="relative">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[0.68rem] tracking-[0.16em] text-muted-foreground uppercase">
                  {kpi.label}
                </p>
                <kpi.icon className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {kpi.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{kpi.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Citywide occupancy</CardTitle>
            <CardDescription>
              Share of all spaces in use, sampled once per day for the last{" "}
              {TREND_DAYS} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OccupancyTrendChart
              points={trendPoints}
              ariaLabel={`Citywide occupancy over the last ${TREND_DAYS} days, currently ${formatPercent(
                citywide.rate,
              )}.`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average stay per lot</CardTitle>
            <CardDescription>
              Mean minutes between entry and exit for sessions closed in the last{" "}
              {HISTORY_DAYS} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stayPoints.length > 0 ? (
              <AverageStayChart
                points={stayPoints}
                ariaLabel={`Average stay per lot: ${stayPoints
                  .map((point) => `${point.label} ${point.minutes} minutes`)
                  .join(", ")}.`}
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No closed sessions in the window yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Lots</CardTitle>
          <CardDescription>
            Current occupancy, {TREND_DAYS}-day trend and average stay, busiest
            first.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-(--card-spacing) pb-2 font-mono text-[0.68rem] tracking-[0.16em] font-normal text-muted-foreground uppercase">
                    Lot
                  </th>
                  <th className="px-3 pb-2 font-mono text-[0.68rem] tracking-[0.16em] font-normal text-muted-foreground uppercase">
                    Occupancy
                  </th>
                  <th className="px-3 pb-2 font-mono text-[0.68rem] tracking-[0.16em] font-normal text-muted-foreground uppercase">
                    Band
                  </th>
                  <th className="px-3 pb-2 font-mono text-[0.68rem] tracking-[0.16em] font-normal text-muted-foreground uppercase">
                    Trend
                  </th>
                  <th className="px-3 pb-2 text-right font-mono text-[0.68rem] tracking-[0.16em] font-normal text-muted-foreground uppercase">
                    Avg. stay
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.lotId}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-(--card-spacing) py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {row.occupied} of {row.capacity} spaces
                      </p>
                    </td>
                    <td className="w-[34%] px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-full max-w-40 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.round((row.rate ?? 0) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs tabular-nums">
                          {formatPercent(row.rate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={row.band ? BAND_VARIANT[row.band] : "outline"}
                        className="uppercase"
                      >
                        {occupancyBandLabel(row.band)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-primary">
                      <Sparkline
                        values={row.sparkline}
                        ariaLabel={`${row.name} occupancy trend over the last ${TREND_DAYS} days.`}
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatMinutes(row.averageStayMinutes)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-(--card-spacing) py-10 text-center text-sm text-muted-foreground"
                    >
                      No published lots yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
