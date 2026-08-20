import type { CrawledPage } from "./crawler.js";

/**
 * Groups pages by the first path segment of their URL — e.g.
 * /investors/investor-resources and /investors/investor-contacts both
 * count under "investors". A rough proxy for how content is organized
 * at the top level, not a substitute for the site's real IA.
 */
export function groupByTopLevelSection(pages: CrawledPage[]): { section: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of pages) {
    let section = "(root)";
    try {
      const segments = new URL(p.url).pathname.split("/").filter(Boolean);
      if (segments.length > 0) section = segments[0];
    } catch {
      /* skip unparseable */
    }
    counts.set(section, (counts.get(section) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => b.count - a.count);
}

export type TreeNode = {
  name: string;
  count: number;
  children: Map<string, TreeNode>;
};

/**
 * Builds a nested tree of URL path segments across every crawled page —
 * e.g. sites -> default -> files -> 2023-07 -> some-report.pdf. Each
 * node's count is how many crawled URLs pass through it. Rendered as a
 * collapsible <details> tree in the report, capped in depth/breadth to
 * stay readable on a site with thousands of files.
 */
export function buildSiteTree(pages: CrawledPage[], maxDepth = 6, maxChildrenPerNode = 30): TreeNode {
  const root: TreeNode = { name: "site", count: 0, children: new Map() };

  for (const p of pages) {
    let segments: string[];
    try {
      segments = new URL(p.url).pathname.split("/").filter(Boolean);
    } catch {
      continue;
    }
    root.count++;
    let node = root;
    for (const seg of segments.slice(0, maxDepth)) {
      if (!node.children.has(seg)) {
        if (node.children.size >= maxChildrenPerNode) continue; // cap breadth
        node.children.set(seg, { name: seg, count: 0, children: new Map() });
      }
      const next = node.children.get(seg);
      if (!next) break;
      next.count++;
      node = next;
    }
  }

  return root;
}
