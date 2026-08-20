import type { Metadata } from "next";
import { ArrowUpRight, CarFront, CircleGauge, Receipt, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { formatCount, formatMoney, formatPercent } from "@/components/reports/format";
import { RangePresets } from "@/components/reports/range-presets";
import { SummaryTiles } from "@/components/reports/summary-tiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { latestActivityDay, resolveRange, summarizeLots } from "@/lib/reports";
import { fetchLots, fetchSessions, fetchTransactions } from "./queries";
import { readDaysParam, readRangeParams, type SearchParams } from "./range-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reports",
  description: "Occupancy and revenue-leak reports for every parking lot.",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const days = readDaysParam(params);

  const [lots, sessions, transactions] = await Promise.all([
    fetchLots(),
    fetchSessions(),
    fetchTransactions(),
  ]);

  const range = resolveRange({
    days,
    ...readRangeParams(params),
    anchor: latestActivityDay(sessions),
  });
  const summaries = summarizeLots({ lots, sessions, transactions, range });
  const rows = lots.map((lot) => ({ lot, summary: summaries.get(String(lot.id))! }));

  const portfolio = rows.reduce(
    (totals, row) => ({
      exits: totals.exits + row.summary.exits,
      transactions: totals.transactions + row.summary.transactions,
      unpaidExits: totals.unpaidExits + row.summary.unpaidExits,
      unpaidAmount: totals.unpaidAmount + row.summary.unpaidAmount,
      onSite: totals.onSite + row.summary.onSite,
    }),
    { exits: 0, transactions: 0, unpaidExits: 0, unpaidAmount: 0, onSite: 0 },
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations"
        title="Reports"
        description="Occupancy over time and payments against vehicle exits, per lot. Every exit without a transaction is revenue that left the barrier unbilled."
      />

      <div className="pb-6">
        <RangePresets basePath="/reports" range={range} activeDays={days} />
      </div>

      <SummaryTiles
        tiles={[
          {
            label: "Vehicles on site",
            value: formatCount(portfolio.onSite),
            hint: `Across ${lots.length} lots`,
            icon: CarFront,
            tone: "brand",
          },
          {
            label: "Exits",
            value: formatCount(portfolio.exits),
            hint: "Vehicles that left in range",
            icon: CircleGauge,
          },
          {
            label: "Transactions",
            value: formatCount(portfolio.transactions),
            hint: "Payments settling those exits",
            icon: Receipt,
          },
          {
            label: "Unpaid exits",
            value: formatCount(portfolio.unpaidExits),
            hint: `${formatMoney(portfolio.unpaidAmount)} estimated`,
            icon: TriangleAlert,
            tone: portfolio.unpaidExits > 0 ? "alert" : "default",
          },
        ]}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ lot, summary }) => (
          <Card key={lot.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-start justify-between gap-3">
                <span className="min-w-0 truncate">{lot.name}</span>
                {summary.unpaidExits > 0 ? (
                  <Badge variant="outline" className="shrink-0 border-destructive/40 text-destructive">
                    {formatCount(summary.unpaidExits)} unpaid
                  </Badge>
                ) : null}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {[lot.city, lot.address].filter(Boolean).join(" · ")}
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Figure label="On site" value={formatCount(summary.onSite)} hint={formatPercent(summary.occupancyRate)} />
                <Figure label="Exits" value={formatCount(summary.exits)} />
                <Figure label="Transactions" value={formatCount(summary.transactions)} />
                <Figure
                  label="Unpaid"
                  value={formatMoney(summary.unpaidAmount)}
                  hint={`${formatCount(summary.unpaidExits)} exits`}
                  alert={summary.unpaidExits > 0}
                />
              </dl>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/reports/${lot.id}?days=${range.days}`}>
                  Open report
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No published parking lots yet. Run <code className="font-mono">pnpm dev</code> to apply the
            Directus schema and seed.
          </CardContent>
        </Card>
      ) : null}
    </PageContainer>
  );
}

function Figure({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 truncate text-lg font-semibold tabular-nums ${alert ? "text-destructive" : ""}`}
      >
        {value}
        {hint ? (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </dd>
    </div>
  );
}
