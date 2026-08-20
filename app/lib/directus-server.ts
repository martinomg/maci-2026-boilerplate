const DIRECTUS_URL =
  process.env.DIRECTUS_INTERNAL_URL ?? process.env.NEXT_PUBLIC_DIRECTUS_URL ?? "http://localhost:18707";

/**
 * Server-only fetch against Directus authenticated as the seeded app service
 * user (Internal User role). Parking collections have no anonymous access, so
 * every server-side parking read must go through this helper.
 */
export async function directusServerFetch<T>(
  pathname: string,
  searchParams?: Record<string, string>,
): Promise<T> {
  const token = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!token) {
    throw new Error(
      "DIRECTUS_SERVICE_TOKEN is not set. Run bin/env.init.command.sh and pnpm schema:apply to provision the app service user.",
    );
  }

  const url = new URL(pathname, DIRECTUS_URL);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Directus request failed (${response.status}): ${url.pathname}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}
