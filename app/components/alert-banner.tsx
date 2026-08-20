import { getPublishedAlerts } from "@/lib/directus";

export async function AlertBanner() {
  const alerts = await getPublishedAlerts();

  if (alerts.length === 0) return null;

  return (
    <aside className="alert-banner" aria-label="Site announcements">
      <ul>
        {alerts.map((alert) => (
          <li key={alert.id}>{alert.label}</li>
        ))}
      </ul>
    </aside>
  );
}
