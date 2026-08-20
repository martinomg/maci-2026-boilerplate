import Link from "next/link";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ShellNotFound() {
  return (
    <PageContainer className="max-w-2xl">
      <Card className="mt-10">
        <CardContent className="flex flex-col items-start gap-4 py-10">
          <span className="rounded-lg bg-primary px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.18em] text-primary-foreground uppercase">
            404
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Article not found
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The post may be a draft, archived or no longer available.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link href="/">Back to journal</Link>
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
