export type Source = { url: string; date: string | null; kind: string };

export type Brief = {
  id?: string;
  person: string;
  topic: string;
  slug: string; // "handle/topic-slug"
  summaryMd: string;
  sources: Source[];
  terms: string[];
  counts: Record<string, number>;
  model: string;
  window: BriefWindow;
  asOf: string; // ISO timestamp of the underlying data
  createdAt?: string;
  updatedAt?: string;
};

export type BriefWindow = "recent" | "archive" | "both";
