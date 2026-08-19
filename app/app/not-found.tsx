import Link from "next/link";

export default function NotFound() {
  return (
    <main className="error-state">
      <h1>Article not found</h1>
      <p>The post may be a draft, archived or no longer available.</p>
      <Link className="button-link" href="/">
        Return home
      </Link>
    </main>
  );
}

