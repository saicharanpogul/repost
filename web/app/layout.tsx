import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://repost.blog"),
  title: {
    default: "repost — what people said on X, for AI agents",
    template: "%s · repost",
  },
  description:
    "Sourced summaries of what specific people have said about a topic on X/Twitter. Readable blogs, plus an open API for AI agents that need who-said-what context.",
  openGraph: { siteName: "repost", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-line">
          <div className="mx-auto w-full max-w-3xl px-5 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              repost<span className="text-accent">.blog</span>
            </Link>
            <a
              href="/api/brief?person=paulg&topic=ai%20agents"
              className="text-sm text-muted hover:text-foreground"
            >
              API
            </a>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-3xl px-5 py-6 text-sm text-muted flex flex-wrap gap-x-4 gap-y-1">
            <span>repost.blog</span>
            <span>·</span>
            <span>Summaries cite X; they don&apos;t reproduce posts.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
