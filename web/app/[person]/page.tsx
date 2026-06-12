import type { Metadata } from "next";
import Link from "next/link";
import { listBriefsByPerson } from "@/lib/brief";
import { normalizeHandle } from "@/lib/slug";
import type { Brief } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { person: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { person } = await params;
  const h = normalizeHandle(person);
  return { title: `@${h}`, description: `Sourced summaries of what @${h} has said on X, by topic.` };
}

export default async function PersonPage({ params }: { params: Promise<Params> }) {
  const { person } = await params;
  const h = normalizeHandle(person);
  let briefs: Brief[] = [];
  try {
    briefs = await listBriefsByPerson(h);
  } catch {
    briefs = [];
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12">
      <Link href="/" className="text-sm text-muted hover:text-foreground">← repost</Link>
      <h1 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight">@{h}</h1>
      <p className="mt-2 text-muted">Topics this person has been summarized on.</p>

      {briefs.length === 0 ? (
        <p className="mt-8 text-muted">
          No briefs for @{h} yet.{" "}
          <Link href="/" className="text-accent hover:underline">Write one</Link>.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {briefs.map((b) => (
            <li key={b.slug}>
              <Link href={`/${b.slug}`} className="block py-4 group">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium group-hover:text-accent">{b.topic}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {new Date(b.asOf).toISOString().slice(0, 10)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
