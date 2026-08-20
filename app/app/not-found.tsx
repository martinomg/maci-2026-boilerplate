import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="surface-grid flex min-h-svh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <span className="rounded-lg bg-primary px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.18em] text-primary-foreground uppercase">
        404
      </span>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          This page is not here.
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          The article may be a draft, archived or no longer available, or the
          route does not exist yet.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/">Browse the journal</Link>
        </Button>
      </div>
    </main>
  );
}
