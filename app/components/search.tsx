"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
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
    <section className="search-section" aria-labelledby="search-title">
      <div>
        <h2 id="search-title">Find an idea, not a keyword</h2>
        <p>Qdrant ranks posts by meaning using a local deterministic embedding.</p>
      </div>
      <form className="search-form" onSubmit={handleSubmit}>
        <label htmlFor="semantic-search">Search the journal</label>
        <div className="search-controls">
          <input
            id="semantic-search"
            name="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: parallel development environments"
            autoComplete="off"
          />
          <button type="submit" disabled={state === "loading"}>
            {state === "loading" ? "Searching" : "Search"}
          </button>
        </div>
        {state === "error" && (
          <p className="form-message error" role="alert">
            Search is unavailable. Check the Qdrant service and index.
          </p>
        )}
      </form>

      {state === "success" && (
        <div className="search-results" aria-live="polite">
          {results.length === 0 ? (
            <p className="empty-message">No related posts found.</p>
          ) : (
            results.map((post) => (
              <Link className="search-result" href={`/blog/${post.slug}`} key={post.id}>
                <Image
                  src={post.cover_url}
                  alt=""
                  width={160}
                  height={110}
                  sizes="96px"
                />
                <span>
                  <strong>{post.title}</strong>
                  <small>{post.excerpt}</small>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </section>
  );
}

