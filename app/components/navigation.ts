import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  LayoutDashboard,
  LayoutTemplate,
  Map,
  Settings,
  SquareChartGantt,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navigation: NavGroup[] = [
  {
    label: "Operations",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Live occupancy, revenue and alert signals at a glance.",
      },
      {
        title: "Map",
        href: "/map",
        icon: Map,
        description: "Spatial view of every managed site and its live state.",
      },
      {
        title: "Reports",
        href: "/reports",
        icon: SquareChartGantt,
        description: "Scheduled and ad-hoc reporting across the portfolio.",
      },
      {
        title: "Layouts",
        href: "/layouts",
        icon: LayoutTemplate,
        description: "Floor plans, zones and stall definitions per site.",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        title: "Journal",
        href: "/",
        icon: BookOpen,
        description: "Published notes served from Directus and indexed in Qdrant.",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Workspace, theme and integration preferences.",
      },
    ],
  },
];

export const navItems: NavItem[] = navigation.flatMap((group) => group.items);

export function isNavItemActive(item: NavItem, pathname: string) {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname.startsWith("/blog")) {
    return navItems.find((item) => item.href === "/");
  }
  return navItems.find((item) => isNavItemActive(item, pathname));
}
