"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-state">
      <p className="eyebrow">Content service unavailable</p>
      <h1>The journal could not be loaded.</h1>
      <p>Confirm Directus is running and the schema migration has been applied.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}

