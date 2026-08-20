import type { Metadata } from "next";
import { Database, Palette, Search } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Settings",
  description: "Workspace, theme and integration preferences.",
};

const integrations = [
  {
    icon: Database,
    name: "Directus",
    detail: "Content, schema and permissions source of truth.",
    env: "NEXT_PUBLIC_DIRECTUS_URL",
  },
  {
    icon: Search,
    name: "Qdrant",
    detail: "Derived semantic index, rebuilt with pnpm search:index.",
    env: "QDRANT_URL",
  },
];

export default function SettingsPage() {
  const directusUrl =
    process.env.NEXT_PUBLIC_DIRECTUS_URL ?? "http://localhost:18707";

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Preferences for this workspace. Appearance is stored locally; service endpoints come from the environment."
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4 text-muted-foreground" />
              Appearance
            </CardTitle>
            <CardDescription>
              Light, dark or follow the operating system. The yellow accent stays
              constant across both themes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4 rounded-lg bg-muted/60 p-3">
            <div>
              <p className="text-sm font-medium">Color theme</p>
              <p className="text-sm text-muted-foreground">
                Applied instantly, remembered per browser.
              </p>
            </div>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected services</CardTitle>
            <CardDescription>
              Read-only. Change these through the worktree environment file.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <integration.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{integration.name}</p>
                    <Badge variant="secondary" className="font-normal">
                      Connected
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {integration.detail}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {integration.env}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Admin</CardTitle>
            <CardDescription>
              Structure and content are edited in Directus, then pulled back into
              versioned snapshot files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              href={directusUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Directus admin
            </a>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
