import ExcelJS from "exceljs";
import type { AnalysisResult } from "./analyze.js";
import type { CrawledPage } from "../lib/crawler.js";

/**
 * Builds the actual downloadable Excel file — this app never had one
 * before (only JSON/CSV existed); this brings back the multi-sheet
 * XLSX export the original Vercel version had, now including embedded
 * screenshots for template/component examples, which the Vercel
 * version never had either.
 *
 * Uses exceljs rather than the plain `xlsx` (SheetJS) package used
 * elsewhere in this project's history — SheetJS's free tier has weak
 * image-embedding support, while exceljs handles it natively and
 * simply via workbook.addImage() + worksheet.addImage().
 */
export async function buildExcelReport(input: {
  startUrl: string;
  clientName: string;
  crawledAt: string;
  pages: CrawledPage[];
  analysis: AnalysisResult;
  screenshots: Map<string, Buffer>;
}): Promise<ExcelJS.Buffer> {
  const { startUrl, clientName, crawledAt, pages, analysis, screenshots } = input;
  const { scorecard, findings, templateAnalysis, componentAnalysis, featureMatrix, externalLinkHealth, keywords, phrases, integrations, journeyMap } = analysis;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UX & Content Strategist Audit";
  workbook.created = new Date();

  // --- Overview ---
  const overview = workbook.addWorksheet("Overview");
  overview.columns = [{ width: 28 }, { width: 60 }];
  overview.addRows([
    ["Client", clientName],
    ["Site audited", startUrl],
    ["Pages crawled", pages.length],
    ["Findings", findings.length],
    ["Crawled at", crawledAt],
    [],
    ["Overall UX Maturity", `${scorecard.uxMaturityScore} / 100 (${scorecard.uxMaturityBand})`],
    ["Information Architecture", `${scorecard.iaHealthScore} / 100`],
    ["Content Quality", `${scorecard.contentQualityScore} / 100`],
    ["Accessibility", `${scorecard.accessibilityScore} / 100`],
    ["SEO / Findability", `${scorecard.seoScore} / 100`],
  ]);

  // --- Findings ---
  const findingsSheet = workbook.addWorksheet("Findings");
  findingsSheet.columns = [
    { header: "Type", key: "type", width: 24 },
    { header: "Title", key: "title", width: 50 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "Effort Bucket", key: "effort", width: 14 },
    { header: "Personas", key: "personas", width: 16 },
    { header: "Affected Pages", key: "affected", width: 14 },
    { header: "Description", key: "description", width: 60 },
    { header: "Detection Method", key: "detection", width: 50 },
  ];
  for (const f of findings) {
    findingsSheet.addRow({
      type: f.findingType, title: f.title, severity: f.severity, effort: f.effortBucket,
      personas: f.personas.join(", "), affected: f.affectedPageCount, description: f.description, detection: f.detectionMethod,
    });
  }
  findingsSheet.getRow(1).font = { bold: true };

  // --- Page Templates, with embedded screenshots ---
  const templatesSheet = workbook.addWorksheet("Templates");
  templatesSheet.columns = [
    { header: "Template Name", key: "name", width: 24 },
    { header: "Layout Grid", key: "layout", width: 22 },
    { header: "Avg Confidence", key: "confidence", width: 14 },
    { header: "Page Count", key: "count", width: 12 },
    { header: "Example URL", key: "url", width: 55 },
    { header: "Screenshot", key: "screenshot", width: 32 },
  ];
  templatesSheet.getRow(1).font = { bold: true };
  let templateRowIndex = 2;
  for (const t of templateAnalysis.templates) {
    const row = templatesSheet.addRow({ name: t.name, layout: t.layoutGrid, confidence: t.avgConfidence, count: t.pageCount, url: t.exampleUrl });
    row.height = 120;
    // Keyed per template so rows don't share one homepage screenshot
    const shot = screenshots.get(`template:${t.name}::${t.layoutGrid}`);
    if (shot) {
      // exceljs's type declarations predate newer @types/node making Buffer
      // generic (Buffer<ArrayBufferLike>) — this is a type-declaration
      // mismatch only; a real Buffer works correctly with exceljs at
      // runtime, which is all that matters here.
      const imageId = workbook.addImage({ buffer: Buffer.from(shot), extension: "png" } as any);
      templatesSheet.addImage(imageId, {
        tl: { col: 5, row: templateRowIndex - 1 },
        ext: { width: 220, height: 140 },
      });
    }
    templateRowIndex++;
  }

  // --- Reusable Components, with embedded screenshots ---
  const componentsSheet = workbook.addWorksheet("Components");
  componentsSheet.columns = [
    { header: "Component", key: "name", width: 28 },
    { header: "Type", key: "type", width: 18 },
    { header: "Detected Elements", key: "elements", width: 40 },
    { header: "Reusability", key: "reusability", width: 12 },
    { header: "Page Count", key: "count", width: 12 },
    { header: "Coverage %", key: "coverage", width: 12 },
    { header: "Example URL", key: "url", width: 55 },
    { header: "Screenshot", key: "screenshot", width: 32 },
  ];
  componentsSheet.getRow(1).font = { bold: true };
  let componentRowIndex = 2;
  for (const c of componentAnalysis.components) {
    const row = componentsSheet.addRow({
      name: c.standardName, type: c.type, elements: c.detectedElements.join(", "),
      reusability: c.reusabilityScore, count: c.pageCount, coverage: c.pageCoveragePct, url: c.exampleUrl,
    });
    row.height = 120;
    // Keyed per component; capture may be an element crop via domSelector
    const shot = screenshots.get(`component:${c.standardName}`);
    if (shot) {
      // exceljs's type declarations predate newer @types/node making Buffer
      // generic (Buffer<ArrayBufferLike>) — this is a type-declaration
      // mismatch only; a real Buffer works correctly with exceljs at
      // runtime, which is all that matters here.
      const imageId = workbook.addImage({ buffer: Buffer.from(shot), extension: "png" } as any);
      componentsSheet.addImage(imageId, {
        tl: { col: 7, row: componentRowIndex - 1 },
        ext: { width: 220, height: 140 },
      });
    }
    componentRowIndex++;
  }

  // --- Journey Maps ---
  const journeySheet = workbook.addWorksheet("Journey Maps");
  journeySheet.columns = [
    { header: "Persona", key: "persona", width: 24 },
    { header: "Stage", key: "stage", width: 24 },
    { header: "Present", key: "present", width: 10 },
    { header: "Page Count", key: "count", width: 12 },
    { header: "Example URL", key: "url", width: 55 },
    { header: "Click Depth", key: "depth", width: 12 },
  ];
  journeySheet.getRow(1).font = { bold: true };
  for (const j of journeyMap.journeys) {
    for (const s of j.stages) {
      journeySheet.addRow({
        persona: j.name, stage: s.name, present: s.present ? "Yes" : "No",
        count: s.pageCount, url: s.exampleUrl ?? "", depth: s.clickDepth ?? "",
      });
    }
  }

  // --- Keywords ---
  const keywordsSheet = workbook.addWorksheet("Keywords");
  keywordsSheet.columns = [
    { header: "Keyword", key: "keyword", width: 24 },
    { header: "Occurrences", key: "occ", width: 14 },
    { header: "Pages Found On", key: "pages", width: 16 },
    { header: "", key: "spacer", width: 4 },
    { header: "Top Phrase", key: "phrase", width: 30 },
    { header: "Occurrences ", key: "phraseOcc", width: 14 },
  ];
  keywordsSheet.getRow(1).font = { bold: true };
  const kwRows = Math.max(keywords.length, phrases.length);
  for (let i = 0; i < kwRows; i++) {
    keywordsSheet.addRow({
      keyword: keywords[i]?.keyword ?? "", occ: keywords[i]?.occurrences ?? "", pages: keywords[i]?.pagesFoundOn ?? "",
      phrase: phrases[i]?.phrase ?? "", phraseOcc: phrases[i]?.occurrences ?? "",
    });
  }

  // --- Feature Matrix ---
  const featureSheet = workbook.addWorksheet("Feature Matrix");
  featureSheet.columns = [
    { header: "Feature", key: "feature", width: 30 },
    { header: "Detected?", key: "detected", width: 12 },
    { header: "Pages Found On", key: "pages", width: 16 },
  ];
  featureSheet.getRow(1).font = { bold: true };
  for (const f of featureMatrix) {
    featureSheet.addRow({ feature: f.feature, detected: f.detected ? "Yes" : "No", pages: f.detected ? f.pagesFoundOn : "" });
  }

  // --- Integrations ---
  const integrationsSheet = workbook.addWorksheet("Integrations");
  integrationsSheet.columns = [
    { header: "Integration", key: "name", width: 30 },
    { header: "Category", key: "category", width: 18 },
    { header: "Pages Found On", key: "pages", width: 16 },
    { header: "", key: "spacer", width: 4 },
    { header: "Unrecognized Domain", key: "domain", width: 30 },
    { header: "References", key: "refs", width: 14 },
  ];
  integrationsSheet.getRow(1).font = { bold: true };
  const intRows = Math.max(integrations.recognized.length, integrations.unrecognized.length);
  for (let i = 0; i < intRows; i++) {
    integrationsSheet.addRow({
      name: integrations.recognized[i]?.name ?? "", category: integrations.recognized[i]?.category ?? "",
      pages: integrations.recognized[i]?.pagesFoundOn ?? "",
      domain: integrations.unrecognized[i]?.domain ?? "", refs: integrations.unrecognized[i]?.references ?? "",
    });
  }

  // --- External Link Health ---
  const linkHealthSheet = workbook.addWorksheet("External Link Health");
  linkHealthSheet.columns = [
    { header: "Broken URL", key: "url", width: 55 },
    { header: "Status", key: "status", width: 14 },
    { header: "Linked From (count)", key: "count", width: 18 },
  ];
  linkHealthSheet.getRow(1).font = { bold: true };
  for (const r of externalLinkHealth) {
    linkHealthSheet.addRow({ url: r.url, status: String(r.status), count: r.linkedFromCount });
  }

  // --- Page Inventory ---
  const pageInventorySheet = workbook.addWorksheet("Page Inventory");
  pageInventorySheet.columns = [
    { header: "URL", key: "url", width: 55 },
    { header: "Status", key: "status", width: 10 },
    { header: "Title", key: "title", width: 40 },
    { header: "Words", key: "words", width: 10 },
    { header: "Depth", key: "depth", width: 10 },
    { header: "Error", key: "error", width: 40 },
  ];
  pageInventorySheet.getRow(1).font = { bold: true };
  for (const p of pages) {
    pageInventorySheet.addRow({ url: p.url, status: p.statusCode ?? "", title: p.title ?? "", words: p.wordCount, depth: p.depth, error: p.error ?? "" });
  }

  return workbook.xlsx.writeBuffer();
}
