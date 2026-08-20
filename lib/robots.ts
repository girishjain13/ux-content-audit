/**
 * Simplified from the Vercel version: that one cached robots.txt in
 * Redis because many separate stateless serverless functions needed to
 * share one fetch. Here, a single Node process runs the whole crawl
 * from start to finish, so an in-memory cache (this module's own
 * variable) is all that's needed — no external cache required.
 */
let cachedRobotsTxt: string | null = null;

export async function loadRobots(startUrl: string): Promise<string> {
  if (cachedRobotsTxt !== null) return cachedRobotsTxt;

  try {
    const robotsUrl = new URL("/robots.txt", startUrl).toString();
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
    cachedRobotsTxt = res.ok ? await res.text() : "";
  } catch {
    cachedRobotsTxt = "";
  }
  return cachedRobotsTxt;
}

/**
 * Minimal disallow-rule check. TODO: this is a placeholder — swap in a
 * real robots.txt parser (e.g. the `robots-parser` npm package) before
 * relying on this for actual client audits; a naive prefix match doesn't
 * handle wildcards, $ end-anchors, or user-agent-specific rule blocks
 * correctly.
 */
export function canFetch(robotsTxt: string, url: string): boolean {
  if (!robotsTxt) return true;
  const path = new URL(url).pathname;
  const disallowLines = robotsTxt
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.toLowerCase().startsWith("disallow:"));
  return !disallowLines.some((line) => {
    const rule = line.split(":").slice(1).join(":").trim();
    return rule && path.startsWith(rule);
  });
}
