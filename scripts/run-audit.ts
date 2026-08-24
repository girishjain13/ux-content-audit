import { writeFileSync, mkdirSync } from "fs";
import { crawlSite } from "../lib/crawler.js";
import { captureScreenshots } from "../lib/screenshotCapture.js";
import { analyzeSite } from "./analyze.js";
import { renderReportHtml } from "./report-template.js";
import { buildExcelReport } from "./export-xlsx.js";

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
  const HARD_MAX_PAGES = 5000;
  const maxPages = Math.min(Number(process.env.AUDIT_MAX_PAGES || "500"), HARD_MAX_PAGES);
  const maxDepth = Number(process.env.AUDIT_MAX_DEPTH || "12");
  const respectRobots = process.env.AUDIT_RESPECT_ROBOTS !== "false";
  const concurrency = Number(process.env.AUDIT_CONCURRENCY || "4");
  const clientStatedPageCount = process.env.AUDIT_CLIENT_STATED_PAGE_COUNT
    ? Number(process.env.AUDIT_CLIENT_STATED_PAGE_COUNT)
    : null;
  // AI-enhanced classification is opt-in and driven entirely by a repo
  // secret (ANTHROPIC_API_KEY) — never a plain workflow input — plus
  // this one boolean flag. See lib/aiPageClassifier.ts for why.
  const useAiClassification = process.env.AUDIT_USE_AI_CLASSIFICATION === "true";
  const maxAiPages = Number(process.env.AUDIT_MAX_AI_PAGES || "100");

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
  const analysis = await analyzeSite(pages, startUrl, clientStatedPageCount, crawlTruncated, rootHost, personas, {
    useAiClassification,
    maxAiPages,
  });

  console.log(`Analysis complete: ${analysis.findings.length} findings.`);

  const outDir = process.env.AUDIT_OUTPUT_DIR || "docs";
  mkdirSync(outDir, { recursive: true });

  const durationSeconds = Math.round((Date.now() - started) / 100) / 10;
  const crawledAt = new Date().toISOString();

  const html = renderReportHtml({
    startUrl,
    clientName,
    crawledAt,
    durationSeconds,
    pages,
    analysis,
  });
  writeFileSync(`${outDir}/report.html`, html);

  // Raw JSON alongside the HTML report, for anyone who wants to build
  // their own view on top of the same data. Deliberately strips
  // renderedDomHtml before serializing — that field is the full HTML
  // of every single crawled page (up to 200KB each), which nobody
  // consuming this JSON file actually needs (every genuinely useful
  // extracted field — title, links, word count, etc. — is already
  // present on each page object without it). On a large crawl, keeping
  // it in was enough raw text to exceed V8's ~512MB max string length
  // and crash JSON.stringify entirely — confirmed in production on a
  // multi-thousand-page run that had already spent an hour crawling
  // and analyzing successfully before failing at this exact step.
  try {
    const pagesForJson = pages.map(({ renderedDomHtml, ...rest }) => rest);
    writeFileSync(`${outDir}/audit-data.json`, JSON.stringify({ startUrl, clientName, crawledAt, pages: pagesForJson, analysis }));
  } catch (err) {
    // This export failing should never take the HTML report, CSV, or
    // XLSX down with it — those are independently valuable and don't
    // share this risk. Log clearly and keep going rather than crash
    // the whole run over one non-essential export format.
    console.error("Failed to write audit-data.json (report.html and other exports are unaffected):", err instanceof Error ? err.message : err);
  }

  // CSV of findings, for anyone who wants to drop this straight into a
  // spreadsheet rather than reading the HTML report.
  try {
    const csvEscape = (v: unknown) => {
      const str = v == null ? "" : String(v);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csvHeaders = ["Type", "Title", "Severity", "Effort Bucket", "Personas", "Affected Pages", "Description", "Detection Method"];
    const csvRows = analysis.findings.map((f) =>
      [f.findingType, f.title, f.severity, f.effortBucket, f.personas.join("|"), f.affectedPageCount, f.description, f.detectionMethod]
        .map(csvEscape)
        .join(","),
    );
    writeFileSync(`${outDir}/audit-data.csv`, [csvHeaders.join(","), ...csvRows].join("\n"));
  } catch (err) {
    console.error("Failed to write audit-data.csv (other exports are unaffected):", err instanceof Error ? err.message : err);
  }

  // Screenshots are keyed per template/component (not per URL) so two
  // rows that share a page still get distinct captures — components
  // additionally clip to their DOM selector when available.
  try {
    const targets = [
      ...analysis.templateAnalysis.templates.map((t) => ({
        key: `template:${t.name}::${t.layoutGrid}`,
        url: t.exampleUrl,
      })),
      ...analysis.componentAnalysis.components.map((c) => ({
        key: `component:${c.standardName}`,
        url: c.exampleUrl,
        selector: c.domSelector || undefined,
      })),
    ];
    console.log(`Capturing screenshots for ${targets.length} template/component target(s)...`);
    const screenshots = await captureScreenshots(targets);

    console.log("Building Excel report...");
    const xlsxBuffer = await buildExcelReport({ startUrl, clientName, crawledAt, pages, analysis, screenshots });
    writeFileSync(`${outDir}/audit-data.xlsx`, Buffer.from(xlsxBuffer));
  } catch (err) {
    console.error("Failed to build the Excel export (report.html and other exports are unaffected):", err instanceof Error ? err.message : err);
  }

  console.log(`Report written to ${outDir}/report.html`);
}

main().catch((err) => {
  console.error("Audit run failed:", err);
  process.exit(1);
});
