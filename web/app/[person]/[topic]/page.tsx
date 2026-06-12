import type { Metadata } from "next";
import Link from "next/link";
import BriefBody from "@/app/components/BriefBody";
import GenerateCTA from "@/app/components/GenerateCTA";
import { getBriefBySlug, isStale } from "@/lib/brief";
import { normalizeHandle, deslugTopic } from "@/lib/slug";
import type { Brief } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { person: string; topic: string };

async function load(p: Params): Promise<{ person: string; brief: Brief | null }> {
  const person = normalizeHandle(p.person);
  const slug = `${person}/${p.topic}`;
  try {
    return { person, brief: await getBriefBySlug(slug) };
  } catch {
    return { person, brief: null };
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const { person, brief } = await load(p);
  const topic = brief?.topic || deslugTopic(p.topic);
  const title = `@${person} on ${topic}`;
  const description = brief
    ? `What @${person} has said about ${topic} on X — a sourced summary over time.`
    : `A sourced summary of what @${person} has said about ${topic} on X.`;
  return { title, description, openGraph: { title, description } };
}

export default async function BriefPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const { person, brief } = await load(p);
  const topicGuess = deslugTopic(p.topic);

  if (!brief) {
    return (
      <article className="mx-auto w-full max-w-3xl px-5 py-12">
        <BackLinks person={person} />
        <h1 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight">
          @{person} · {topicGuess}
        </h1>
        <div className="mt-6">
          <GenerateCTA person={person} topic={topicGuess} />
        </div>
      </article>
    );
  }

  const asOf = new Date(brief.asOf).toISOString().slice(0, 10);
  const stale = isStale(brief);

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-12">
      <BackLinks person={person} />
      <header className="mt-4">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
          What <Link href={`/${person}`} className="text-accent hover:underline">@{person}</Link>{" "}
          has said about {brief.topic}
        </h1>
        <p className="mt-2 text-sm text-muted">
          As of {asOf} · {brief.model} · {sourceLine(brief)}
          {stale && " · may be outdated"}
        </p>
      </header>

      <div className="mt-8">
        <BriefBody markdown={brief.summaryMd} />
      </div>

      {brief.sources.length > 0 && (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Sources</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {brief.sources.map((s, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="shrink-0 text-muted tabular-nums">{(s.date || "").slice(0, 10) || "—"}</span>
                <span className="shrink-0 text-xs text-muted">[{s.kind}]</span>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline break-all">
                  {s.url.replace(/^https:\/\//, "")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-xs text-muted">
        A transformed summary that cites X. It paraphrases posts; it does not reproduce them.
      </p>
    </article>
  );
}

function sourceLine(b: Brief): string {
  const total = b.sources.length;
  const authored = b.counts.authored || 0;
  return `${total} posts (${authored} authored)`;
}

function BackLinks({ person }: { person: string }) {
  return (
    <div className="flex gap-3 text-sm text-muted">
      <Link href="/" className="hover:text-foreground">← repost</Link>
      <Link href={`/${person}`} className="hover:text-foreground">@{person}</Link>
    </div>
  );
}
