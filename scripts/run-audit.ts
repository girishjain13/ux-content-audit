import { writeFileSync, mkdirSync } from "fs";
import { crawlSite } from "../lib/crawler.js";
import { analyzeSite } from "./analyze.js";
import { renderReportHtml } from "./report-template.js";

/**
 * Entrypoint run by GitHub Actions (see .github/workflows/audit.yml).
 * Inputs come from environment variables set by the workflow's
 * workflow_dispatch inputs — no server, no queue, no database: this is
 * one process, start to finish, writing its result straight to files
 * that get published to GitHub Pages.
 */
async function main() {
  const startUrl = process.env.AUDIT_URL;
  if (!startUrl) {
    console.error("AUDIT_URL environment variable is required.");
    process.exit(1);
  }
  const clientName = process.env.AUDIT_CLIENT_NAME || new URL(startUrl).hostname;
  const maxPages = Number(process.env.AUDIT_MAX_PAGES || "500");
  const maxDepth = Number(process.env.AUDIT_MAX_DEPTH || "12");
  const respectRobots = process.env.AUDIT_RESPECT_ROBOTS !== "false";
  const concurrency = Number(process.env.AUDIT_CONCURRENCY || "4");
  const clientStatedPageCount = process.env.AUDIT_CLIENT_STATED_PAGE_COUNT
    ? Number(process.env.AUDIT_CLIENT_STATED_PAGE_COUNT)
    : null;

  // This app is scoped to UX Lead + Content Strategist only — the
  // Business Analyst app is a separate repo with its own crawl and its
  // own persona scope, per the person's explicit request for two fully
  // independent applications.
  const personas: ("ux" | "content" | "business")[] = ["ux", "content"];
  const personaLabel = "UX Lead & Content Strategist";

  console.log(`Starting crawl: ${startUrl} (max ${maxPages} pages, depth ${maxDepth})`);
  const started = Date.now();

  const pages = await crawlSite({
    startUrl,
    maxPages,
    maxDepth,
    respectRobots,
    concurrency,
    onProgress: (crawled, queued) => console.log(`  ${crawled} crawled, ${queued} queued...`),
  });

  console.log(`Crawl finished: ${pages.length} pages in ${Math.round((Date.now() - started) / 1000)}s`);
  console.log("Running analysis...");

  const rootHost = new URL(startUrl).host;
  const crawlTruncated = pages.length >= maxPages;
  const analysis = await analyzeSite(pages, startUrl, clientStatedPageCount, crawlTruncated, rootHost, personas);

  console.log(`Analysis complete: ${analysis.findings.length} findings.`);

  const outDir = process.env.AUDIT_OUTPUT_DIR || "docs";
  mkdirSync(outDir, { recursive: true });

  const html = renderReportHtml({
    startUrl,
    clientName,
    crawledAt: new Date().toISOString(),
    pages,
    analysis,
    personaLabel,
  });
  writeFileSync(`${outDir}/index.html`, html);

  // Raw JSON alongside the HTML report, for anyone who wants to build
  // their own view on top of the same data.
  writeFileSync(
    `${outDir}/audit-data.json`,
    JSON.stringify({ startUrl, clientName, crawledAt: new Date().toISOString(), pages, analysis }, null, 2),
  );

  console.log(`Report written to ${outDir}/index.html`);
}

main().catch((err) => {
  console.error("Audit run failed:", err);
  process.exit(1);
});
