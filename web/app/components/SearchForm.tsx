"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchForm() {
  const router = useRouter();
  const [person, setPerson] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!person.trim() || !topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ person: person.trim(), topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.reason || "Could not generate that brief.");
        return;
      }
      router.push(`/${data.brief.slug}`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
      <input
        value={person}
        onChange={(e) => setPerson(e.target.value)}
        placeholder="person (e.g. paulg)"
        className="rounded-md border border-line bg-card px-3 py-2.5 outline-none focus:border-accent"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="topic (e.g. ai agents)"
        className="rounded-md border border-line bg-card px-3 py-2.5 outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {loading ? "Writing…" : "Get the brief"}
      </button>
      {error && <p className="sm:col-span-3 text-sm text-accent">{error}</p>}
      {loading && (
        <p className="sm:col-span-3 text-sm text-muted">
          Fetching posts and synthesizing — a fresh brief takes ~20-40s.
        </p>
      )}
    </form>
  );
}
