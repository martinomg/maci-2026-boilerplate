import type { LucideIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SectionPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tracking: string;
  planned: { title: string; detail: string }[];
};

export function SectionPlaceholder({
  eyebrow,
  title,
  description,
  icon: Icon,
  tracking,
  planned,
}: SectionPlaceholderProps) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <Badge variant="outline" className="font-mono text-[0.68rem] uppercase">
            {tracking}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card className="relative justify-center overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 size-52 rounded-full bg-primary/15 blur-3xl"
          />
          <CardContent className="relative flex flex-col items-start gap-4 py-10">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Icon className="size-5" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-base font-medium">Surface reserved</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                The shell, theme and navigation for this section are in place. The
                feature screen lands with {tracking}.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planned in this surface</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {planned.map((entry) => (
              <div
                key={entry.title}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                />
                <div>
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {entry.detail}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
