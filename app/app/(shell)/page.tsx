import Image from "next/image";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Search } from "@/components/search";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getPublishedPosts } from "@/lib/directus";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function HomePage() {
  const posts = await getPublishedPosts();
  const [featured, ...rest] = posts;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Workspace"
        title="Journal"
        description="Published notes served from Directus at request time and indexed in Qdrant for semantic search."
        actions={
          <Badge variant="outline" className="font-mono text-[0.68rem] uppercase">
            {posts.length} published
          </Badge>
        }
      />

      {!featured ? (
        <Card>
          <div className="flex flex-col items-start gap-3 px-6 py-16">
            <h2 className="text-xl font-semibold tracking-tight">
              No published posts yet
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Apply the Directus Sync migration and seed to populate this journal.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card className="group overflow-hidden py-0">
            <Link href={`/blog/${featured.slug}`} className="block">
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                <Image
                  src={featured.cover_url}
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <Badge className="font-normal">Featured</Badge>
                  <time
                    dateTime={featured.published_at}
                    className="font-mono text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase"
                  >
                    {dateFormatter.format(new Date(featured.published_at))}
                  </time>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {featured.excerpt}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 border-b-2 border-primary pb-0.5 text-sm font-medium">
                  Read article
                </span>
              </div>
            </Link>
          </Card>

          <Card className="divide-y divide-border py-0">
            {rest.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                More posts appear here as they are published.
              </p>
            ) : (
              rest.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group flex gap-4 p-4 transition-colors hover:bg-accent/60 sm:p-5"
                >
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-24">
                    <Image
                      src={post.cover_url}
                      alt=""
                      fill
                      unoptimized
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <time
                      dateTime={post.published_at}
                      className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase"
                    >
                      {dateFormatter.format(new Date(post.published_at))}
                    </time>
                    <h3 className="mt-1 text-base leading-snug font-medium">
                      {post.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {post.excerpt}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </Card>
        </div>
      )}

      <Search />
    </PageContainer>
  );
}
