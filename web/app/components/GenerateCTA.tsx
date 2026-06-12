"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateCTA({ person, topic }: { person: string; topic: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ person, topic }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.reason || "Could not generate that brief.");
        return;
      }
      // Brief now exists at this URL — re-render the server page.
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-6">
      <p className="text-muted">
        No brief yet for <span className="text-foreground font-medium">@{person}</span> on{" "}
        <span className="text-foreground font-medium">&ldquo;{topic}&rdquo;</span>.
      </p>
      <button
        onClick={generate}
        disabled={loading}
        className="mt-4 rounded-md bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {loading ? "Writing… (~20-40s)" : "Write this brief"}
      </button>
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
    </div>
  );
}
