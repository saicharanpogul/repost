import type { MetadataRoute } from "next";
import { listBriefs } from "@/lib/brief";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl;
  let briefs: Awaited<ReturnType<typeof listBriefs>> = [];
  try {
    briefs = await listBriefs(2000);
  } catch {
    briefs = [];
  }
  return [
    { url: base, lastModified: new Date() },
    ...briefs.map((b) => ({
      url: `${base}/${b.slug}`,
      lastModified: new Date(b.updatedAt || b.asOf),
    })),
  ];
}
