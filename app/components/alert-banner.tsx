import { Megaphone } from "lucide-react";
import { getPublishedAlerts } from "@/lib/directus";

export async function AlertBanner() {
  const alerts = await getPublishedAlerts();

  if (alerts.length === 0) return null;

  return (
    <aside
      className="border-b border-border bg-primary text-primary-foreground"
      aria-label="Site announcements"
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-start gap-2.5 px-4 py-2.5 sm:px-6 lg:px-8">
        <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
        <ul className="grid gap-1 text-sm font-medium">
          {alerts.map((alert) => (
            <li key={alert.id}>{alert.label}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
