import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:18708",
  ),
  title: {
    default: "Maci Journal",
    template: "%s | Maci Journal",
  },
  description: "A working Next.js, Directus Sync and Qdrant starter.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable}`}>
        <header className="site-header">
          <Link className="wordmark" href="/">
            Maci Journal
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/#writing">Writing</Link>
            <a href={process.env.NEXT_PUBLIC_DIRECTUS_URL ?? "http://localhost:18707"}>
              Directus
            </a>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>Built with Next.js, Directus Sync and Qdrant.</p>
          <a href="https://github.com">Source on GitHub</a>
        </footer>
      </body>
    </html>
  );
}

