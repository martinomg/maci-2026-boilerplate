import type { Metadata } from "next";
import { ArrowLeft, CircleGauge, Receipt, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import {
  formatCount,
  formatDayLong,
  formatMoney,
  formatPercent,
  formatTimestamp,
} from "@/components/reports/format";
import { LeakChart } from "@/components/reports/leak-chart";
import { OccupancyChart } from "@/components/reports/occupancy-chart";
import { RangePresets } from "@/components/reports/range-presets";
import { SummaryTiles } from "@/components/reports/summary-tiles";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildOperationsReport, latestActivityDay, resolveRange } from "@/lib/reports";
import { fetchLot, fetchSessions, fetchTransactions } from "../queries";
import { readDaysParam, readRangeParams, type SearchParams } from "../range-params";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const lot = await fetchLot(id);
  if (!lot) return { title: "Report" };
  return {
    title: `${lot.name} · Report`,
    description: `Occupancy and unpaid-exit report for ${lot.name}.`,
  };
}

export default async function LotReportPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const lot = await fetchLot(id);
  if (!lot) notFound();

  const [sessions, transactions] = await Promise.all([
    fetchSessions(id),
    fetchTransactions(id),
  ]);

  const days = readDaysParam(query);
  const range = resolveRange({
    days,
    ...readRangeParams(query),
    anchor: latestActivityDay(sessions),
  });
  const report = buildOperationsReport({ lot, sessions, transactions, range });
  const { totals } = report;

  return (
    <PageContainer>
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        href={`/reports?days=${range.days}`}
      >
        <ArrowLeft className="size-4" />
        All reports
      </Link>

      <div className="mt-6">
        <PageHeader
          eyebrow={[lot.city, lot.address].filter(Boolean).join(" · ") || "Operations"}
          title={lot.name}
          description={`Peak occupancy against capacity, and every vehicle exit matched to the transaction that settled it. Stays are billed by started hour at ${formatMoney(report.hourlyRate)} per hour.`}
        />
      </div>

      <div className="pb-6">
        <RangePresets basePath={`/reports/${lot.id}`} range={range} activeDays={days} />
      </div>

      <SummaryTiles
        tiles={[
          {
            label: "Exits",
            value: formatCount(totals.exits),
            hint: `${formatCount(totals.entries)} entries in range`,
            icon: CircleGauge,
          },
          {
            label: "Transactions",
            value: formatCount(totals.transactions),
            hint: `${formatCount(totals.paidExits)} exits settled`,
            icon: Receipt,
          },
          {
            label: "Unpaid exits",
            value: formatCount(totals.unpaidExits),
            hint:
              totals.exits > 0
                ? `${formatPercent(totals.unpaidExits / totals.exits)} of exits`
                : "No exits in range",
            icon: TriangleAlert,
            tone: totals.unpaidExits > 0 ? "alert" : "default",
          },
          {
            label: "Estimated leak",
            value: formatMoney(totals.unpaidAmount),
            hint: `At ${formatMoney(report.hourlyRate)} per started hour`,
            icon: Wallet,
            tone: totals.unpaidAmount > 0 ? "alert" : "default",
          },
        ]}
      />

      <div className="mt-4 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Occupancy over time</CardTitle>
            <CardDescription>
              Peak vehicles on site per {report.occupancy.resolution}, against a capacity of{" "}
              {report.capacity ? formatCount(report.capacity) : "—"}. Busiest bucket reached{" "}
              {formatCount(totals.peakOccupancy)} vehicles ({formatPercent(totals.peakOccupancyRate)}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OccupancyChart
              points={report.occupancy.points}
              resolution={report.occupancy.resolution}
              capacity={report.capacity}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transactions vs. vehicle exits</CardTitle>
            <CardDescription>
              Payments are counted on the day their vehicle left, so the highlighted series is exactly
              the gap between exits and transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeakChart rows={report.daily} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Unpaid exits
              {totals.unpaidExits > 0 ? (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  {formatMoney(totals.unpaidAmount)}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              Every vehicle that left between {formatDayLong(range.from)} and{" "}
              {formatDayLong(range.to)} without a matching transaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.unpaid.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No unpaid exits in this range.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["Plate", "Entered", "Exited", "Billed", "Estimated"].map((heading) => (
                        <th
                          key={heading}
                          className="pb-2 font-mono text-[0.62rem] font-medium tracking-[0.16em] text-muted-foreground uppercase last:text-right"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.unpaid.map((exit) => (
                      <tr key={String(exit.sessionId)}>
                        <td className="py-2.5 font-mono text-xs">{exit.plate ?? "—"}</td>
                        <td className="py-2.5 text-muted-foreground tabular-nums">
                          {formatTimestamp(exit.enteredAt)}
                        </td>
                        <td className="py-2.5 text-muted-foreground tabular-nums">
                          {formatTimestamp(exit.exitedAt)}
                        </td>
                        <td className="py-2.5 tabular-nums">
                          {formatCount(exit.billedHours)} h
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({exit.hours.toFixed(1)} h stay)
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-medium text-destructive tabular-nums">
                          {formatMoney(exit.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
