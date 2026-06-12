// Open READ API for agents.
//   GET /api/brief?person=paulg&topic=ai%20agents  → the brief if it exists
//
// The server never generates. If a brief isn't in the corpus yet, this 404s
// with a hint to generate it locally (via the MCP / engine) and publish.

import { NextRequest, NextResponse } from "next/server";
import { getBriefBySlug } from "@/lib/brief";
import { briefSlug } from "@/lib/slug";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const person = sp.get("person") || "";
  const topic = sp.get("topic") || "";
  if (!person || !topic) {
    return NextResponse.json({ ok: false, reason: "person and topic are required" }, { status: 400 });
  }

  const slug = briefSlug(person, topic);
  let brief;
  try {
    brief = await getBriefBySlug(slug);
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e.message || "lookup failed" }, { status: 500 });
  }

  if (!brief) {
    return NextResponse.json(
      {
        ok: false,
        reason: "not in the corpus yet",
        hint: "Generate it locally with the repost MCP/CLI and publish it.",
        slug,
        url: `${env.siteUrl}/${slug}`,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    brief: {
      person: brief.person,
      topic: brief.topic,
      slug: brief.slug,
      url: `${env.siteUrl}/${brief.slug}`,
      summary_md: brief.summaryMd,
      sources: brief.sources,
      counts: brief.counts,
      model: brief.model,
      as_of: brief.asOf,
      contributed_by: brief.contributedBy,
    },
  });
}
