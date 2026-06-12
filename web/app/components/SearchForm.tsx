"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { briefSlug } from "@/lib/slug";

export default function SearchForm() {
  const router = useRouter();
  const [person, setPerson] = useState("");
  const [topic, setTopic] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!person.trim() || !topic.trim()) return;
    router.push(`/${briefSlug(person.trim(), topic.trim())}`);
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
      <button type="submit" className="rounded-md bg-accent px-4 py-2.5 font-medium text-white">
        Find the brief
      </button>
    </form>
  );
}
