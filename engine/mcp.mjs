#!/usr/bin/env node
// repost — MCP server (stdio)
//
// Exposes the retrieval path as a tool any MCP client (Claude Code, Codex,
// Cursor, ...) can call. Retrieval-only: returns the relevant posts with source
// links and lets the calling agent synthesize. NO Anthropic key — only the
// server's own X_BEARER_TOKEN.
//
// Wire it up (Claude Code):
//   claude mcp add repost --env X_BEARER_TOKEN=<your token> -- node /abs/path/engine/mcp.mjs
//
// Requires Node 18+.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runEngine } from "./src/engine.mjs";

const server = new McpServer({ name: "repost", version: "0.1.0" });

server.registerTool(
  "repost_search",
  {
    title: "What a person said on X",
    description:
      "Retrieve what a specific person said about a topic on X/Twitter, as sourced posts you then reason over. " +
      "Returns the relevant posts (each labeled authored | retweet | quote, with date and source link) — NOT a finished answer; you synthesize. " +
      "ALWAYS pass `terms`: a list of semantic variants of the topic (synonyms, related phrasings, how the person likely actually phrases it), e.g. for 'ai agents' pass ['ai agents','agentic','autonomous agents','tool use']. Naive keyword search misses most posts without this. " +
      "Treat retweets as amplification, not the person's own position; prefer authored posts.",
    inputSchema: {
      person: z.string().describe("X handle, with or without @ (e.g. 'paulg')"),
      topic: z.string().describe("the topic to research"),
      terms: z.array(z.string()).optional().describe("semantic expansion terms for recall — supply these; naive keywords miss most posts"),
      window: z.enum(["recent", "archive", "both"]).optional().describe("recent (~7d) | archive (all history) | both (default)"),
      authored_only: z.boolean().optional().describe("exclude retweets — the person's own words only"),
    },
  },
  async ({ person, topic, terms, window, authored_only }) => {
    const token = process.env.X_BEARER_TOKEN;
    if (!token) {
      return { isError: true, content: [{ type: "text", text: "repost: X_BEARER_TOKEN is not set in the MCP server's environment." }] };
    }
    try {
      const result = await runEngine({
        person,
        topic,
        token,
        terms: terms ?? null,
        window: window ?? "both",
        authoredOnly: Boolean(authored_only),
        synthesize: false,
        useCache: true,
      });

      const summary = result.posts.length
        ? `@${result.person} on "${result.topic}" — ${result.posts.length} posts ${JSON.stringify(result.counts)}. Synthesize from these; prefer authored over retweets.`
        : `No posts for @${result.person} on "${result.topic}". ${(result.notes || []).join("; ")}`.trim();

      const payload = {
        person: result.person,
        topic: result.topic,
        query: result.query,
        counts: result.counts,
        notes: result.notes,
        posts: result.posts, // [{ date, kind, text, url }]
      };

      return {
        content: [
          { type: "text", text: summary },
          { type: "text", text: JSON.stringify(payload, null, 2) },
        ],
      };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: `repost error: ${e.message}` }] };
    }
  },
);

server.registerTool(
  "repost_publish",
  {
    title: "Publish a brief to repost.blog",
    description:
      "Contribute a synthesized brief to the public corpus at repost.blog, after you've used repost_search and written a summary. " +
      "Requires a contributor token (REPOST_PUBLISH_TOKEN) on the server. " +
      "summary_md must PARAPHRASE (never paste raw tweets) and cite the source links inline. " +
      "Pass the exact x.com status links your summary is based on in `sources` — claims must be checkable.",
    inputSchema: {
      person: z.string().describe("X handle, with or without @"),
      topic: z.string().describe("the topic this brief covers"),
      summary_md: z.string().describe("your synthesized markdown summary (paraphrased, with inline source links)"),
      sources: z
        .array(z.object({ url: z.string(), date: z.string().optional(), kind: z.string().optional() }))
        .describe("the x.com status links the summary is based on"),
      window: z.enum(["recent", "archive", "both"]).optional(),
      terms: z.array(z.string()).optional(),
    },
  },
  async ({ person, topic, summary_md, sources, window, terms }) => {
    const token = process.env.REPOST_PUBLISH_TOKEN;
    const base = (process.env.REPOST_PUBLISH_URL || "https://repost.blog").replace(/\/$/, "");
    if (!token) {
      return { isError: true, content: [{ type: "text", text: "repost: REPOST_PUBLISH_TOKEN not set — cannot publish." }] };
    }
    try {
      const res = await fetch(`${base}/api/contribute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-repost-client": "repost-mcp/0.1.0",
        },
        body: JSON.stringify({ person, topic, summary_md, sources, window, terms, model: "agent" }),
      });
      let data = {};
      try { data = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok || !data.ok) {
        return { isError: true, content: [{ type: "text", text: `repost publish failed: ${data.reason || res.status}` }] };
      }
      return { content: [{ type: "text", text: `Published: ${data.url}` }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: `repost publish error: ${e.message}` }] };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr is safe for logs; stdout is the JSON-RPC channel — never write to it.
process.stderr.write("repost MCP server running on stdio\n");
