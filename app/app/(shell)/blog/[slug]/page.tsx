import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/page-header";
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
    <PageContainer className="max-w-3xl">
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        href="/"
      >
        <ArrowLeft className="size-4" />
        Back to journal
      </Link>

      <article className="mt-8">
        <header>
          <time
            dateTime={post.published_at}
            className="font-mono text-[0.68rem] tracking-[0.18em] text-muted-foreground uppercase"
          >
            {new Intl.DateTimeFormat("en", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(post.published_at))}
          </time>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
            {post.excerpt}
          </p>
        </header>

        <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
          <Image
            src={post.cover_url}
            alt=""
            fill
            priority
            unoptimized
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>

        <div className="mt-10 space-y-6 text-base leading-8 text-pretty">
          {post.content
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((paragraph) => (
              <p key={paragraph.slice(0, 64)}>{paragraph}</p>
            ))}
        </div>
      </article>
    </PageContainer>
  );
}
