import type { Metadata } from "next";
import { ArrowUpRight, CarFront, CircleGauge, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
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

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Live occupancy, revenue and alert signals at a glance.",
};

const metrics = [
  {
    label: "Occupancy",
    value: "78%",
    delta: "+4 pts vs. last week",
    icon: CircleGauge,
    accent: true,
  },
  {
    label: "Vehicles on site",
    value: "1,284",
    delta: "Across 6 facilities",
    icon: CarFront,
    accent: false,
  },
  {
    label: "Revenue today",
    value: "$18,340",
    delta: "+2.1% vs. forecast",
    icon: Wallet,
    accent: false,
  },
  {
    label: "Open alerts",
    value: "3",
    delta: "1 requires an operator",
    icon: TriangleAlert,
    accent: false,
  },
];

const activity = [
  { time: "09:42", text: "Zone B reached 95% occupancy", tone: "alert" },
  { time: "09:15", text: "Layout revision published for Central Garage" },
  { time: "08:58", text: "Nightly report delivered to operations" },
  { time: "08:03", text: "Barrier 4 returned to service" },
];

export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="One place to read occupancy, revenue and alert pressure across every managed facility."
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

      <div className="mb-4 flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[0.68rem] uppercase">
          Preview data
        </Badge>
        <p className="text-sm text-muted-foreground">
          Live signals land with #12. The shell, theme and layout are final.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card
            key={metric.label}
            className={
              metric.accent
                ? "relative overflow-hidden ring-2 ring-primary"
                : undefined
            }
          >
            {metric.accent ? (
              <div
                aria-hidden
                className="pointer-events-none absolute -top-14 -right-10 size-40 rounded-full bg-primary/20 blur-3xl"
              />
            ) : null}
            <CardContent className="relative">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[0.68rem] tracking-[0.16em] text-muted-foreground uppercase">
                  {metric.label}
                </p>
                <metric.icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Occupancy by facility</CardTitle>
            <CardDescription>
              Share of stalls currently in use, highest pressure first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { site: "Central Garage", value: 95 },
              { site: "Riverside Deck", value: 81 },
              { site: "Airport Long Stay", value: 74 },
              { site: "Market Street Lot", value: 58 },
              { site: "Depot North", value: 34 },
            ].map((row) => (
              <div key={row.site}>
                <div className="mb-1.5 flex items-baseline justify-between gap-4">
                  <span className="truncate text-sm font-medium">{row.site}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {row.value}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${row.value}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest events across the portfolio.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {activity.map((entry) => (
              <div key={entry.time} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {entry.time}
                </span>
                <p className="flex-1 text-sm">
                  {entry.text}
                  {entry.tone === "alert" ? (
                    <span className="ml-2 inline-block size-1.5 translate-y-[-1px] rounded-full bg-primary align-middle" />
                  ) : null}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
