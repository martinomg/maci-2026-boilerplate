"use client";

import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BlogPost } from "@/lib/directus";

type SearchResult = BlogPost & { score: number };

export function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    setState("loading");
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(normalizedQuery)}`,
      );
      if (!response.ok) throw new Error("Search failed");
      const payload = (await response.json()) as { data: SearchResult[] };
      setResults(payload.data);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <Card className="mt-4" aria-labelledby="search-title">
      <CardContent className="grid gap-6 py-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10">
        <div>
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" strokeWidth={2.2} />
          </span>
          <h2
            id="search-title"
            className="mt-3 text-xl font-semibold tracking-tight text-balance"
          >
            Find an idea, not a keyword
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Qdrant ranks posts by meaning using a local deterministic embedding.
          </p>
        </div>

        <div>
          <form onSubmit={handleSubmit}>
            <label
              htmlFor="semantic-search"
              className="mb-2 block text-sm font-medium"
            >
              Search the journal
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="semantic-search"
                name="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try: parallel development environments"
                autoComplete="off"
                className="sm:flex-1"
              />
              <Button type="submit" size="lg" disabled={state === "loading"}>
                {state === "loading" ? "Searching" : "Search"}
              </Button>
            </div>
            {state === "error" && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                Search is unavailable. Check the Qdrant service and index.
              </p>
            )}
          </form>

          {state === "success" && (
            <div className="mt-4 divide-y divide-border" aria-live="polite">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No related posts found.
                </p>
              ) : (
                results.map((post) => (
                  <Link
                    className="flex items-center gap-3 py-3 transition-colors first:pt-0 hover:text-foreground"
                    href={`/blog/${post.slug}`}
                    key={post.id}
                  >
                    <Image
                      src={post.cover_url}
                      alt=""
                      width={160}
                      height={110}
                      sizes="80px"
                      unoptimized
                      className="h-14 w-20 shrink-0 rounded-md object-cover"
                    />
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-medium">
                        {post.title}
                      </strong>
                      <small className="line-clamp-2 text-sm text-muted-foreground">
                        {post.excerpt}
                      </small>
                    </span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
