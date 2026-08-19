import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/directus";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { images: [post.cover_url] },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="article-shell">
      <Link className="back-link" href="/">
        Back to journal
      </Link>
      <article className="article">
        <header>
          <time dateTime={post.published_at}>
            {new Intl.DateTimeFormat("en", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(post.published_at))}
          </time>
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
        </header>
        <div className="article-cover">
          <Image src={post.cover_url} alt="" fill priority unoptimized sizes="100vw" />
        </div>
        <div className="article-body">
          {post.content
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((paragraph) => (
              <p key={paragraph.slice(0, 64)}>{paragraph}</p>
            ))}
        </div>
      </article>
    </main>
  );
}
