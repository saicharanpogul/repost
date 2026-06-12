import Link from "next/link";
import SearchForm from "./components/SearchForm";
import { listBriefs } from "@/lib/brief";
import type { Brief } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let briefs: Brief[] = [];
  try {
    briefs = await listBriefs(24);
  } catch {
    briefs = []; // Supabase not configured yet — render the page anyway.
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-14">
      <section className="max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
          What has someone said about a topic on X?
        </h1>
        <p className="mt-4 text-lg text-muted leading-relaxed">
          repost reads a person&apos;s posts and writes a sourced summary of their views on a topic,
          over time. Readable here, and queryable by AI agents that need who-said-what context.
        </p>
        <div className="mt-7">
          <SearchForm />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Recent briefs</h2>
        {briefs.length === 0 ? (
          <p className="mt-4 text-muted">
            No briefs yet. Search above to write the first one.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {briefs.map((b) => (
              <li key={b.slug}>
                <Link href={`/${b.slug}`} className="block py-4 group">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium group-hover:text-accent">
                      @{b.person} · {b.topic}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {new Date(b.asOf).toISOString().slice(0, 10)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
