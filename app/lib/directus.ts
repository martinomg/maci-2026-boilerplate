export type BlogPost = {
  id: string | number;
  status: "draft" | "published" | "archived";
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_url: string;
  published_at: string;
  date_created: string;
  date_updated: string | null;
};

/** A published alert reduced to what the site-wide banner renders. */
export type SiteAlert = {
  id: string | number;
  label: string;
  sort: number | null;
};

/** The raw `/items/alerts` record the public policy exposes. */
export type AlertRecord = {
  id?: string | number;
  status?: string;
  label?: string | null;
  sort?: number | null;
};

type DirectusListResponse<T> = {
  data: T[];
};

const postFields = [
  "id",
  "status",
  "title",
  "slug",
  "excerpt",
  "content",
  "cover_url",
  "published_at",
  "date_created",
  "date_updated",
].join(",");

const alertFields = ["id", "status", "label", "sort"].join(",");

export function getDirectusUrl() {
  return (
    process.env.DIRECTUS_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_DIRECTUS_URL ??
    "http://localhost:18707"
  ).replace(/\/$/, "");
}

async function directusFetch<T>(pathname: string): Promise<T> {
  const response = await fetch(`${getDirectusUrl()}${pathname}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Directus request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const query = new URLSearchParams({
    fields: postFields,
    filter: JSON.stringify({ status: { _eq: "published" } }),
    sort: "-published_at",
  });
  const response = await directusFetch<DirectusListResponse<BlogPost>>(
    `/items/posts?${query.toString()}`,
  );
  return response.data;
}

/**
 * Normalizes the anonymous `/items/alerts` payload into banner-ready alerts.
 *
 * The public policy already restricts reads to `status = published`; this
 * repeats the check locally, drops records without a usable label and applies
 * a stable order so the banner never depends on API ordering alone.
 */
export function toSiteAlerts(
  items: AlertRecord[] | null | undefined,
): SiteAlert[] {
  if (!Array.isArray(items)) return [];

  return items
    .filter(
      (item): item is AlertRecord & { label: string } =>
        (item?.status === undefined || item.status === "published") &&
        typeof item?.label === "string" &&
        item.label.trim().length > 0,
    )
    .map((item) => ({
      id: item.id ?? item.label,
      label: item.label.trim(),
      sort: typeof item.sort === "number" ? item.sort : null,
    }))
    .sort(
      (a, b) =>
        (a.sort ?? Number.MAX_SAFE_INTEGER) - (b.sort ?? Number.MAX_SAFE_INTEGER),
    );
}

/**
 * Reads published alerts anonymously. A banner is decoration, so an
 * unavailable Directus degrades to no banner instead of failing the layout.
 */
export async function getPublishedAlerts(): Promise<SiteAlert[]> {
  const query = new URLSearchParams({
    fields: alertFields,
    filter: JSON.stringify({ status: { _eq: "published" } }),
    sort: "sort",
  });

  try {
    const response = await directusFetch<DirectusListResponse<AlertRecord>>(
      `/items/alerts?${query.toString()}`,
    );
    return toSiteAlerts(response.data);
  } catch {
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const query = new URLSearchParams({
    fields: postFields,
    filter: JSON.stringify({
      _and: [{ slug: { _eq: slug } }, { status: { _eq: "published" } }],
    }),
    limit: "1",
  });
  const response = await directusFetch<DirectusListResponse<BlogPost>>(
    `/items/posts?${query.toString()}`,
  );
  return response.data[0] ?? null;
}
