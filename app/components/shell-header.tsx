"use client";

import { usePathname } from "next/navigation";
import { findNavItem } from "@/components/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function ShellHeader() {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const isArticle = pathname.startsWith("/blog/");

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-5">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-sm font-semibold tracking-tight">
          {item?.title ?? "Maci Control"}
        </h2>
        {isArticle ? (
          <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
            Article
          </Badge>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[0.65rem] tracking-widest text-muted-foreground uppercase md:inline-flex">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          Live
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
