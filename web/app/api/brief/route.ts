// Open API + UI generation endpoint.
//   GET  /api/brief?person=paulg&topic=ai%20agents   → agent-friendly JSON
//   POST /api/brief  { person, topic, window?, force? }
//
// Generation (fetch X + synthesize) runs server-side on the operator's keys.

import { NextRequest, NextResponse } from "next/server";
import { getOrGenerateBrief } from "@/lib/brief";
import { env } from "@/lib/env";
import type { BriefWindow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // synthesis can take ~20-40s on a cold brief

function normalizeWindow(w: string | null | undefined): BriefWindow {
  return w === "recent" || w === "archive" ? w : "both";
}

async function handle(person?: string, topic?: string, window?: string | null, force?: boolean) {
  if (!person || !topic) {
    return NextResponse.json({ ok: false, reason: "person and topic are required" }, { status: 400 });
  }
  try {
    const result = await getOrGenerateBrief({ person, topic, window: normalizeWindow(window), force: Boolean(force) });
    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }
    const b = result.brief;
    return NextResponse.json({
      ok: true,
      generated: result.generated,
      brief: {
        person: b.person,
        topic: b.topic,
        slug: b.slug,
        url: `${env.siteUrl}/${b.slug}`,
        summary_md: b.summaryMd,
        sources: b.sources,
        counts: b.counts,
        model: b.model,
        as_of: b.asOf,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e.message || "generation failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handle(sp.get("person") || undefined, sp.get("topic") || undefined, sp.get("window"), sp.get("force") === "1");
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  return handle(body.person, body.topic, body.window, body.force);
}
