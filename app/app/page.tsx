import Image from "next/image";
import Link from "next/link";
import { Search } from "@/components/search";
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
    <main>
      <section className="intro">
        <p className="eyebrow">Notes from a working stack</p>
        <h1>Build in parallel. Keep the system legible.</h1>
        <p className="intro-copy">
          A small publication powered by schema migrations and searchable vectors.
        </p>
      </section>

      <section className="writing" id="writing" aria-labelledby="writing-title">
        <h2 id="writing-title" className="visually-hidden">
          Latest writing
        </h2>
        {!featured ? (
          <div className="empty-state">
            <h2>No published posts yet</h2>
            <p>Apply the Directus Sync migration and seed to populate this journal.</p>
          </div>
        ) : (
          <>
            <article className="featured-post">
              <Link className="featured-image" href={`/blog/${featured.slug}`}>
                <Image
                  src={featured.cover_url}
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 62vw"
                />
              </Link>
              <div className="featured-copy">
                <time dateTime={featured.published_at}>
                  {dateFormatter.format(new Date(featured.published_at))}
                </time>
                <h2>
                  <Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
                </h2>
                <p>{featured.excerpt}</p>
                <Link className="text-link" href={`/blog/${featured.slug}`}>
                  Read article
                </Link>
              </div>
            </article>

            <div className="post-list">
              {rest.map((post) => (
                <article className="post-row" key={post.id}>
                  <div>
                    <time dateTime={post.published_at}>
                      {dateFormatter.format(new Date(post.published_at))}
                    </time>
                    <h3>
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h3>
                    <p>{post.excerpt}</p>
                  </div>
                  <Link className="post-image" href={`/blog/${post.slug}`} tabIndex={-1}>
                    <Image
                      src={post.cover_url}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 30vw"
                    />
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <Search />
    </main>
  );
}
