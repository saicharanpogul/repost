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
  contributedBy?: string; // authenticated contributor (publish-token label)
  client?: string; // which client published it, e.g. "repost-mcp/0.1.0"
  verified?: boolean; // sources spot-checked against X (future)
  createdAt?: string;
  updatedAt?: string;
};

export type BriefWindow = "recent" | "archive" | "both";
