export function normalizeHandle(h: string): string {
  return h.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "");
}

export function slugifyTopic(topic: string): string {
  return (
    topic
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "topic"
  );
}

export function briefSlug(person: string, topic: string): string {
  return `${normalizeHandle(person)}/${slugifyTopic(topic)}`;
}

// Best-effort reconstruction of a topic phrase from a topic slug, for when a
// brief is generated from a direct URL visit (loses exact phrasing; expansion
// covers the fuzziness).
export function deslugTopic(topicSlug: string): string {
  return topicSlug.replace(/-/g, " ").trim();
}
