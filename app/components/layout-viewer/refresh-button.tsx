"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Manual refresh for the layout state.
 *
 * Occupancy is read at request time, so refreshing is a server round trip
 * (`router.refresh()`), not a websocket subscription: the viewer never holds an
 * open connection and every read goes through the authenticated server route.
 */
export function RefreshButton({
  label = "Refresh state",
  size = "lg",
}: {
  label?: string;
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      size={size}
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={cn("size-4", pending && "animate-spin")} />
      {pending ? "Refreshing…" : label}
    </Button>
  );
}
