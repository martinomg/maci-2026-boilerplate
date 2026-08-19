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
