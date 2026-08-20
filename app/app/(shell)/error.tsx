"use client";

import { TriangleAlert } from "lucide-react";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <PageContainer className="max-w-2xl">
      <Card className="mt-10">
        <CardContent className="flex flex-col items-start gap-4 py-10">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <TriangleAlert className="size-5" strokeWidth={2.2} />
          </span>
          <div>
            <p className="font-mono text-[0.68rem] tracking-[0.18em] text-muted-foreground uppercase">
              Content service unavailable
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              This surface could not be loaded.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Confirm Directus is running and the schema migration has been
              applied.
            </p>
          </div>
          <Button size="lg" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
