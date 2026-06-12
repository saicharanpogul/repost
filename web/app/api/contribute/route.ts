// Validated write path. Clients (the repost MCP/engine) publish a brief they
// generated locally on their own keys. The server does NOT generate — it
// authenticates the contributor, validates the payload, and stores it.
//
//   POST /api/contribute
//   Authorization: Bearer <publish-token>      (allowlisted; identifies the contributor)
//   X-Repost-Client: repost-mcp/0.1.0          (provenance)
//   body: { person, topic, summary_md, sources:[{url,date,kind}], terms?, counts?, model?, window?, as_of? }

import { NextRequest, NextResponse } from "next/server";
import { createBriefFromContribution, ValidationError, type Contribution } from "@/lib/brief";
import { labelForToken, env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const label = labelForToken(token);
  if (!label) {
    return NextResponse.json(
      { ok: false, reason: "not authorized to publish — missing or unknown publish token" },
      { status: 401 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid JSON body" }, { status: 400 });
  }

  const client = (req.headers.get("x-repost-client") || body.client || "unknown").toString();

  try {
    const brief = await createBriefFromContribution(body as Contribution, label, client);
    return NextResponse.json({
      ok: true,
      slug: brief.slug,
      url: `${env.siteUrl}/${brief.slug}`,
      contributed_by: brief.contributedBy,
    });
  } catch (e: any) {
    const status = e instanceof ValidationError ? 422 : 500;
    return NextResponse.json({ ok: false, reason: e.message || "publish failed" }, { status });
  }
}
