"use client";

import { ArrowUpRight, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { isNavItemActive, navigation } from "@/components/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

function activeHref(pathname: string) {
  return pathname.startsWith("/blog") ? "/" : pathname;
}

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const current = activeHref(pathname);
  const { setOpenMobile, isMobile } = useSidebar();
  const directusUrl =
    process.env.NEXT_PUBLIC_DIRECTUS_URL ?? "http://localhost:18707";

  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="Maci Control"
              className="hover:bg-transparent active:bg-transparent"
            >
              <Link href="/dashboard" onClick={closeOnMobile}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Zap className="size-4" strokeWidth={2.5} />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold tracking-tight">
                    Maci Control
                  </span>
                  <span className="truncate font-mono text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                    Parking OS
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-mono text-[0.65rem] tracking-[0.16em] uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isNavItemActive(item, current);
                  return (
                    <SidebarMenuItem
                      key={item.href}
                      className="before:pointer-events-none before:absolute before:top-1/2 before:-left-2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-transparent has-[[data-active=true]]:before:bg-primary"
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                      >
                        <Link href={item.href} onClick={closeOnMobile}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Open Directus">
              <a href={directusUrl} target="_blank" rel="noreferrer">
                <ArrowUpRight />
                <span>Directus admin</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
