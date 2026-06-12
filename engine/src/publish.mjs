// Publish a locally-generated brief to the shared corpus (repost.blog).
//
// The website is read-only; generation happens here on the user's own keys.
// Publishing requires a contributor token (allowlist) — this is the
// "authenticated contributor" provenance: every brief is attributed to whoever
// the token belongs to, and is revocable.

export async function publishBrief(result, { url, token, client = "repost-cli/0.1.0" }) {
  if (!token) throw new Error("REPOST_PUBLISH_TOKEN is not set — you need a contributor token to publish.");
  if (!result.answer) throw new Error("Nothing to publish: this result has no synthesized summary (run with synthesis).");

  const endpoint = `${url.replace(/\/$/, "")}/api/contribute`;
  const payload = {
    person: result.person,
    topic: result.topic,
    summary_md: result.answer,
    sources: (result.posts || []).map((p) => ({ url: p.url, date: p.date, kind: p.kind })),
    terms: result.terms,
    counts: result.counts,
    model: result.model,
    window: result.window,
    as_of: result.generatedAt,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-repost-client": client,
    },
    body: JSON.stringify(payload),
  });

  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !data.ok) {
    throw new Error(data.reason || `publish failed (HTTP ${res.status})`);
  }
  return data; // { ok, slug, url, contributed_by }
}
