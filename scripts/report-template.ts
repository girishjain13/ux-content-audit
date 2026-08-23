import type { AnalysisResult, Finding } from "./analyze.js";
import type { CrawledPage } from "../lib/crawler.js";
import type { TreeNode } from "../lib/siteTree.js";

import type { JourneyStageResult } from "../lib/journey.js";
import { isPageError } from "../lib/crawler.js";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tierClass(score: number): string {
  if (score >= 70) return "tier-good";
  if (score >= 50) return "tier-warn";
  return "tier-bad";
}

function renderTreeNode(node: TreeNode, depth: number): string {
  if (depth > 5 || node.children.size === 0) {
    return node.children.size === 0 ? "" : "";
  }
  const children = [...node.children.values()].sort((a, b) => b.count - a.count);
  return children
    .map((child) => {
      if (child.children.size === 0) {
        return `<li>${esc(child.name)} <span class="tree-count">(${child.count})</span></li>`;
      }
      return `<li><details><summary>${esc(child.name)} <span class="tree-count">(${child.count})</span></summary><ul>${renderTreeNode(child, depth + 1)}</ul></details></li>`;
    })
    .join("");
}

function renderHeuristicCard(h: AnalysisResult["heuristics"][number]): string {
  const statusClass = !h.assessed ? "status-na" : h.status === "No issues found" ? "status-clean" : "status-issue";
  return `<div class="card heuristic-card ${!h.assessed ? "not-assessed" : ""}">
    <div class="heuristic-head">
      <strong>${esc(h.name)}</strong>
      <span class="pill ${statusClass}">${esc(h.status)}</span>
    </div>
    <p class="muted small">${esc(h.description)}</p>
    ${
      h.bullets.length
        ? `<ul class="plain small">${h.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
        : h.notAssessedReason
          ? `<p class="muted small italic">${esc(h.notAssessedReason)}</p>`
          : ""
    }
  </div>`;
}

function renderJourneyStage(stage: JourneyStageResult): string {
  const badge = stage.present ? `<span class="pill status-clean">FOUND</span>` : `<span class="pill status-issue">MISSING</span>`;
  const depthText = stage.clickDepth == null ? "None" : stage.clickDepth;
  return `<div class="journey-stage">
    <div class="journey-stage-head">${badge} <strong>${esc(stage.name)}</strong></div>
    <div class="small">${esc(stage.description)}</div>
    ${
      stage.present
        ? `<div class="muted small">${stage.pageCount} page(s) · closest example: <span class="mono">${esc(stage.exampleUrl)}</span> (${depthText} clicks from home)</div>`
        : `<div class="muted small italic">No content matched for: ${esc(stage.name)}. That doesn't necessarily mean it doesn't exist — it may just use different wording — but worth confirming a visitor could actually find it.</div>`
    }
  </div>`;
}

function renderLinkingMap(pages: CrawledPage[]): string {
  const inbound = new Map<string, number>();
  for (const p of pages) for (const link of p.internalLinks) inbound.set(link, (inbound.get(link) ?? 0) + 1);

  // A real, confirmed pattern from external review: dozens of
  // semantically unrelated pages showed identical inbound-link counts
  // in clusters (e.g. exactly 837, 811, 890 repeated site-wide) —
  // because a link present in the global nav/footer gets counted as
  // "inbound" from every single page, which says nothing about real
  // content relationships between pages. Anything linked from more
  // than 75% of all crawled pages is almost certainly template-wide
  // chrome, not a genuine content signal — cap its visual size rather
  // than let it dominate/distort the rest of the map.
  const totalPages = Math.max(pages.length, 1);
  const chromeThreshold = totalPages * 0.75;
  let chromeLinkCount = 0;

  const nodes = pages.slice(0, 250).map((p) => {
    const rawCount = inbound.get(p.url) ?? 0;
    const isLikelyChrome = rawCount > chromeThreshold;
    if (isLikelyChrome) chromeLinkCount++;
    return { url: p.url, count: rawCount, isLikelyChrome };
  });
  const contentNodes = nodes.filter((n) => !n.isLikelyChrome);
  const maxCount = Math.max(1, ...contentNodes.map((n) => n.count));
  const cols = 25;
  const cells = nodes
    .map((n, i) => {
      const r = n.isLikelyChrome ? 3 : 3 + (n.count / maxCount) * 9;
      const cx = (i % cols) * 24 + 12;
      const cy = Math.floor(i / cols) * 24 + 12;
      const color = n.count === 0 ? "#94a3b8" : n.isLikelyChrome ? "#c9c2b4" : "#c1531f";
      const label = n.isLikelyChrome ? `${esc(n.url)} — likely global nav/footer link, excluded from sizing` : `${esc(n.url)} — ${n.count} inbound link(s)`;
      return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="${color}" opacity="0.75"><title>${label}</title></circle>`;
    })
    .join("");
  const rows = Math.ceil(nodes.length / cols);
  const caption =
    chromeLinkCount > 0
      ? `<p class="muted small" style="margin-top:8px">${chromeLinkCount} page(s) linked from more than 75% of the site (almost certainly global navigation/footer chrome, not genuine content relationships) are shown at a fixed minimum size, in gray, rather than sized by raw inbound count.</p>`
      : "";
  return `<svg viewBox="0 0 ${cols * 24} ${rows * 24}" width="100%" style="max-height:340px">${cells}</svg>${caption}`;
}

export function renderReportHtml(input: {
  startUrl: string;
  clientName: string;
  crawledAt: string;
  durationSeconds: number | null;
  pages: CrawledPage[];
  analysis: AnalysisResult;
}): string {
  const { startUrl, clientName, crawledAt, durationSeconds, pages, analysis } = input;
  const {
    scorecard, findings, templateAnalysis, componentAnalysis, featureMatrix, externalLinkHealth,
    keywords, phrases, integrations, plainTerms, uxLeadAssessment, heuristics, crawlHealth,
    topLevelSections, siteTree, avgClickDepth, pagesOverThreeClicks, orphanPageCount, maxClickDepth,
    journeyMap,
  } = analysis;

  const pageErrors = pages.filter((p) => isPageError(p)).length;
  const crawlComplete = pages.length < 5000; // true unless the hard ceiling was hit

  const maxSectionCount = Math.max(1, ...topLevelSections.map((s) => s.count));
  const barRows = topLevelSections
    .slice(0, 15)
    .map((s) => `<div class="bar-row"><span class="bar-label">${esc(s.section)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round((s.count / maxSectionCount) * 100)}%"></div></div></div>`)
    .join("");

  const contentFindingTypes = ["missing_title", "missing_meta_description", "duplicate_title", "near_duplicate_content", "low_readability", "missing_canonical", "missing_og_tags", "thin_content", "case_inconsistent_urls", "non_functional_href"];
  const contentFindings = findings.filter((f) => contentFindingTypes.includes(f.findingType));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(clientName)} — UX & Content Strategist Audit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --paper: #faf7f2; --surface: #fff; --surface-2: #f3eee6; --line: #e7e0d4;
    --ink: #24211d; --ink-dim: #6e6a62; --ink-faint: #9a958a;
    --accent: #c1531f; --sage: #4f7a5c; --amber: #b8862b; --coral: #b23a34;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font-family: "Inter", -apple-system, sans-serif; font-size: 15px; line-height: 1.6; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 40px 24px 80px; }
  h1, h2, h3 { font-family: "Fraunces", Georgia, serif; font-weight: 500; margin: 0; }
  .kicker { font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  h1 { font-size: 30px; line-height: 1.15; word-break: break-all; }
  .sub { color: var(--ink-dim); margin: 8px 0 16px; font-size: 14.5px; }
  .badges { display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; margin-bottom: 8px; }
  .badges b { font-family: "IBM Plex Mono", monospace; }
  .exports a { color: var(--accent); font-size: 13px; margin-right: 16px; text-decoration: none; font-weight: 600; }
  .exports a:hover { text-decoration: underline; }
  section { margin: 40px 0; scroll-margin-top: 24px; }
  h2.section-title { font-size: 22px; margin-bottom: 6px; }
  .section-desc { color: var(--ink-dim); font-size: 13.5px; margin-bottom: 16px; max-width: 760px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 2px rgba(36,33,29,0.03); }
  .grid { display: grid; gap: 12px; }
  .grid-2 { grid-template-columns: 1fr 1fr; }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
  .grid-5 { grid-template-columns: repeat(5, 1fr); }
  .stat-card { text-align: center; border-width: 1px; border-style: solid; border-color: var(--line); transition: transform 0.15s ease; }
  .stat-card .num { font-family: "Fraunces", serif; font-size: 30px; }
  .stat-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-faint); margin-top: 4px; }
  .stat-card.tone-warn { background: #fdf6ec; border-color: #f0dcb8; }
  .stat-card.tone-warn .num { color: var(--amber); }
  .stat-card.tone-bad { background: #fdf1ef; border-color: #f3d3cd; }
  .stat-card.tone-bad .num { color: var(--coral); }
  .stat-card.tone-good { background: #ecf6ef; border-color: #cde8d5; }
  .stat-card.tone-good .num { color: var(--sage); }
  .score-tile { text-align: center; padding: 18px 12px; }
  .score-tile .num { font-family: "Fraunces", serif; font-size: 32px; font-weight: 600; }
  .score-tile .label { font-size: 13px; font-weight: 600; margin-top: 4px; }
  .score-tile .desc { font-size: 11px; color: var(--ink-dim); margin-top: 4px; }
  .tier-good { color: var(--sage); }
  .tier-warn { color: var(--amber); }
  .tier-bad { color: var(--coral); }
  .muted { color: var(--ink-dim); }
  .small { font-size: 13px; }
  .italic { font-style: italic; }
  .mono { font-family: "IBM Plex Mono", monospace; font-size: 12px; }
  ul.plain { padding-left: 20px; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  th { font-size: 10.5px; text-transform: uppercase; color: var(--ink-faint); position: sticky; top: 0; background: var(--surface); z-index: 1; }
  tbody tr:nth-child(even) { background: var(--surface-2); }
  tbody tr:hover { background: #efe7d8; }
  .table-scroll { max-height: 420px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; }
  .pill { display: inline-block; font-family: "IBM Plex Mono", monospace; font-size: 10px; padding: 3px 9px; border-radius: 20px; text-transform: uppercase; white-space: nowrap; }
  .status-clean { background: #ecf6ef; color: var(--sage); }
  .status-issue { background: #f8e9d8; color: var(--amber); }
  .status-na { background: transparent; border: 1px dashed var(--ink-faint); color: var(--ink-faint); }
  .heuristic-card.not-assessed { background: var(--surface-2); }
  .heuristic-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px; }
  .warn-banner { border: 1px solid var(--coral); background: #fdf1ef; border-radius: 12px; padding: 16px 20px; }
  .warn-banner strong { color: var(--coral); }
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-size: 12.5px; }
  .bar-label { width: 160px; text-align: right; color: var(--ink-dim); flex-shrink: 0; }
  .bar-track { flex: 1; background: var(--surface-2); border-radius: 4px; height: 12px; overflow: hidden; }
  .bar-fill { background: var(--accent); height: 100%; }
  .tree-view details summary { cursor: pointer; padding: 2px 0; }
  .tree-view ul { padding-left: 18px; margin: 0; list-style: none; }
  .tree-view li { font-size: 12.5px; padding: 2px 0; }
  .tree-count { color: var(--ink-faint); }
  .list-item { border-bottom: 1px solid var(--line); padding: 8px 0; }
  .list-item:last-child { border-bottom: none; }
  .list-item summary { cursor: pointer; }
  .list-item ul { margin: 8px 0 4px; }
  .list-item a { color: var(--accent); text-decoration: none; }
  .list-item a:hover { text-decoration: underline; }
  .journey-stage { padding: 10px 0; border-bottom: 1px solid var(--line); }
  .journey-stage-head { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
  .tabs { display: flex; gap: 4px; margin: 28px 0 0; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--paper); z-index: 5; padding-top: 4px; }
  .tab-btn { font-family: "IBM Plex Mono", monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; padding: 10px 18px; background: none; border: none; cursor: pointer; color: var(--ink-dim); border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0; }
  .tab-btn:hover { background: var(--surface-2); }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; background: var(--surface); }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  /* Quick-jump section nav — a long report with many distinct sections
     previously had no way to navigate except scrolling the whole thing. */
  .quicknav { display: flex; flex-wrap: wrap; gap: 6px 4px; margin: 18px 0 0; }
  .quicknav a { font-size: 11.5px; font-family: "IBM Plex Mono", monospace; color: var(--ink-dim); text-decoration: none; padding: 5px 10px; border: 1px solid var(--line); border-radius: 20px; background: var(--surface); }
  .quicknav a:hover { color: var(--accent); border-color: var(--accent); }

  @media (max-width: 800px) { .grid-3, .grid-4, .grid-5 { grid-template-columns: repeat(2, 1fr); } }

  /* Print fix: without this, only whichever tab happened to be active
     on screen got included in a "Print / Save as PDF" export — the
     other tab's entire content (Keywords, Feature Matrix, Integrations,
     or all UX Designer content) silently vanished from the PDF with no
     indication anything was missing. A printed report needs to be a
     complete record regardless of which tab was showing. */
  @media print {
    .tab-panel { display: block !important; }
    .tabs, .quicknav, .exports { display: none !important; }
    th { position: static; }
    .table-scroll { max-height: none; overflow: visible; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="kicker">UX &amp; Information Architecture Audit</div>
  <h1>${esc(startUrl)}</h1>
  <div class="sub">A heuristic evaluation generated from a ${pages.length}-page crawl — read it the way you'd read a colleague's design review, not a server log.</div>
  <div class="badges">
    <span>Pages reviewed <b>${pages.length}</b></span>
    <span>Crawled <b>${esc(crawledAt.slice(0, 10))}</b></span>
    ${durationSeconds != null ? `<span>Duration <b>${durationSeconds}s</b></span>` : ""}
  </div>
  <div class="exports">
    <a href="./audit-data.json">Export JSON</a>
    <a href="./audit-data.csv">Export CSV</a>
    <a href="./audit-data.xlsx">Export XLSX</a>
    <a href="#" onclick="window.print();return false;">Print / Save as PDF</a>
  </div>

  <section>
    <h2 class="section-title">Audit Coverage</h2>
    <div class="section-desc">A quick check of how much of the site was actually inspected before interpreting the findings.</div>
    <div class="grid grid-4">
      <div class="card stat-card"><div class="num">${pages.length}</div><div class="label">Pages Crawled</div></div>
      <div class="card stat-card ${pageErrors > 0 ? "tone-warn" : "tone-good"}"><div class="num">${pageErrors}</div><div class="label">Page Errors</div></div>
      <div class="card stat-card"><div class="num">${templateAnalysis.uniqueTemplateCount}</div><div class="label">Unique Templates</div></div>
      <div class="card stat-card"><div class="num">${componentAnalysis.uniqueComponentCount}</div><div class="label">Unique Components</div></div>
    </div>
    <div class="card" style="margin-top:12px">
      ${crawlComplete
        ? "The crawler finished with no discovered pages left waiting. This indicates coverage of the pages discoverable under the current crawl settings."
        : "The crawl stopped at the configured page limit before exhausting all discoverable links — the site likely has more pages than shown here."}
    </div>
  </section>

  ${
    crawlHealth.triggered
      ? `<section><div class="warn-banner"><strong>⚠ This crawl may not have reached real navigation</strong><p class="small" style="margin:8px 0 0">${esc(crawlHealth.message)}</p></div></section>`
      : ""
  }

  <div class="tabs">
    <button class="tab-btn active" onclick="showTab('ux', this)">UX Designer</button>
    <button class="tab-btn" onclick="showTab('content', this)">Content Strategist</button>
  </div>
  <div class="quicknav">
    <a href="#sec-plain-terms" onclick="jumpTo(event,'sec-plain-terms','ux')">In Plain Terms</a>
    <a href="#sec-assessment" onclick="jumpTo(event,'sec-assessment','ux')">Assessment</a>
    <a href="#sec-scorecard" onclick="jumpTo(event,'sec-scorecard','ux')">Scorecard</a>
    <a href="#sec-heuristics" onclick="jumpTo(event,'sec-heuristics','ux')">Heuristics</a>
    <a href="#sec-structure" onclick="jumpTo(event,'sec-structure','ux')">Site Structure</a>
    <a href="#sec-templates" onclick="jumpTo(event,'sec-templates','ux')">Templates</a>
    <a href="#sec-components" onclick="jumpTo(event,'sec-components','ux')">Components</a>
    <a href="#sec-journeys" onclick="jumpTo(event,'sec-journeys','ux')">Journeys</a>
    <a href="#sec-linking-map" onclick="jumpTo(event,'sec-linking-map','ux')">Linking Map</a>
    <a href="#sec-content-findings" onclick="jumpTo(event,'sec-content-findings','content')">Content Findings</a>
    <a href="#sec-keywords" onclick="jumpTo(event,'sec-keywords','content')">Keywords</a>
    <a href="#sec-feature-matrix" onclick="jumpTo(event,'sec-feature-matrix','content')">Feature Matrix</a>
    <a href="#sec-integrations" onclick="jumpTo(event,'sec-integrations','content')">Integrations</a>
    <a href="#sec-link-health" onclick="jumpTo(event,'sec-link-health','content')">Link Health</a>
    <a href="#sec-inventory" onclick="jumpTo(event,'sec-inventory',null)">Page Inventory</a>
  </div>

  <div id="tab-ux" class="tab-panel active">

    <section id="sec-plain-terms">
      <h2 class="section-title">In Plain Terms</h2>
      <ul class="plain">${plainTerms.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    </section>

    <section id="sec-assessment">
      <h2 class="section-title">UX Lead's Assessment</h2>
      <div class="section-desc">A narrative read of the findings below, the way a senior UX lead would actually frame them in a review — not just restated numbers.</div>
      ${uxLeadAssessment.map((p) => `<p class="small">${esc(p)}</p>`).join("")}
    </section>

    <section id="sec-scorecard">
      <h2 class="section-title">Scorecard</h2>
      <div class="section-desc">Each score is 0–100, where higher is healthier.</div>
      <div class="grid grid-5">
        <div class="card score-tile"><div class="num ${tierClass(scorecard.uxMaturityScore)}">${scorecard.uxMaturityScore}</div><div class="label">Overall UX Maturity</div><div class="desc">${esc(scorecard.uxMaturityBand)}</div></div>
        <div class="card score-tile"><div class="num ${tierClass(scorecard.iaHealthScore)}">${scorecard.iaHealthScore}</div><div class="label">Information Architecture</div><div class="desc">Fewer orphans, shorter paths</div></div>
        <div class="card score-tile"><div class="num ${tierClass(scorecard.contentQualityScore)}">${scorecard.contentQualityScore}</div><div class="label">Content Quality</div><div class="desc">Substance, dedup, headings</div></div>
        <div class="card score-tile"><div class="num ${tierClass(scorecard.accessibilityScore)}">${scorecard.accessibilityScore}</div><div class="label">Accessibility</div><div class="desc">Assistive-tech readiness</div></div>
        <div class="card score-tile"><div class="num ${tierClass(scorecard.seoScore)}">${scorecard.seoScore}</div><div class="label">SEO / Findability</div><div class="desc">Titles, meta, canonicals</div></div>
      </div>
    </section>

    <section id="sec-heuristics">
      <h2 class="section-title">Heuristic Evaluation</h2>
      <div class="section-desc">Findings organized against Nielsen's 10 usability heuristics. 5 of 10 can be checked from a page crawl; the other 5 need a human walking through real interactions.</div>
      <div class="grid grid-2">${heuristics.map(renderHeuristicCard).join("")}</div>
    </section>

    <section id="sec-structure">
      <h2 class="section-title">Site Structure</h2>
      <div class="section-desc">How the site is organized, and how many clicks it takes to reach each page from the homepage.</div>
      <div class="grid grid-2">
        <div class="card">
          <strong class="small">Pages per top-level section</strong>
          <div style="margin-top:10px">${barRows}</div>
        </div>
        <div class="card tree-view">
          <strong class="small">Site hierarchy</strong>
          <ul style="margin-top:10px">${renderTreeNode(siteTree, 0)}</ul>
        </div>
      </div>
      <div class="grid grid-4" style="margin-top:12px">
        <div class="card stat-card ${orphanPageCount > 0 ? "tone-warn" : "tone-good"}"><div class="num">${orphanPageCount}</div><div class="label">Orphan Pages</div></div>
        <div class="card stat-card"><div class="num">${maxClickDepth}</div><div class="label">Max Click Depth</div></div>
        <div class="card stat-card"><div class="num">${avgClickDepth}</div><div class="label">Avg Click Depth</div></div>
        <div class="card stat-card"><div class="num">${pagesOverThreeClicks}</div><div class="label">Pages &gt;3 Clicks Deep</div></div>
      </div>
    </section>

    <section id="sec-templates">
      <h2 class="section-title">Page Templates</h2>
      <div class="section-desc">Pages grouped by their actual HTML structure, not by URL pattern or title. Click a template to see every page using it.</div>
      <div class="grid grid-4">
        <div class="card stat-card"><div class="num">${templateAnalysis.uniqueTemplateCount}</div><div class="label">Unique Templates</div></div>
        <div class="card stat-card"><div class="num">${templateAnalysis.templatesWithReuse}</div><div class="label">Used By 2+ Pages</div></div>
        <div class="card stat-card"><div class="num">${templateAnalysis.oneOffCount}</div><div class="label">One-off Pages</div></div>
        <div class="card stat-card"><div class="num">${templateAnalysis.pagesAnalyzed}</div><div class="label">Pages Analyzed</div></div>
      </div>
      <div class="card" style="margin-top:12px">
        ${templateAnalysis.templates
          .map(
            (t) => `<details class="list-item">
          <summary><strong>${esc(t.name)}</strong> <span class="muted small">— ${esc(t.layoutGrid)}, confidence ${t.avgConfidence}, ${t.pageCount} page(s)</span></summary>
          <ul class="plain small mono">${t.sampleUrls.map((u) => `<li><a href="${esc(u)}" target="_blank">${esc(u)}</a></li>`).join("")}${t.pageCount > t.sampleUrls.length ? `<li class="muted">…and ${t.pageCount - t.sampleUrls.length} more</li>` : ""}</ul>
        </details>`,
          )
          .join("")}
      </div>
    </section>

    <section id="sec-components">
      <h2 class="section-title">Reusable UI Components</h2>
      <div class="section-desc">Semantically named recurring components (e.g. "Testimonial Card", "Editorial Teaser Card") — a rough inventory, not a substitute for the real component library. Click a component to see every page using it.</div>
      <div class="grid grid-2">
        <div class="card stat-card"><div class="num">${componentAnalysis.uniqueComponentCount}</div><div class="label">Reusable Components Found</div></div>
        <div class="card stat-card"><div class="num">${componentAnalysis.pagesAnalyzed}</div><div class="label">Pages Analyzed</div></div>
      </div>
      <div class="card" style="margin-top:12px">
        ${componentAnalysis.components
          .map(
            (c) => `<details class="list-item">
          <summary><strong>${esc(c.standardName)}</strong> <span class="pill status-${c.reusabilityScore === "High" ? "clean" : c.reusabilityScore === "Medium" ? "issue" : "na"}">${esc(c.reusabilityScore)}</span> <span class="muted small">— ${c.pageCount} page(s), ${c.pageCoveragePct}% coverage</span>
          <div class="muted small">${esc(c.detectedElements.join(", "))}</div></summary>
          <ul class="plain small mono">${c.sampleUrls.map((u) => `<li><a href="${esc(u)}" target="_blank">${esc(u)}</a></li>`).join("")}${c.pageCount > c.sampleUrls.length ? `<li class="muted">…and ${c.pageCount - c.sampleUrls.length} more</li>` : ""}</ul>
        </details>`,
          )
          .join("")}
      </div>
    </section>

    <section id="sec-journeys">
      <h2 class="section-title">Inferred User Journey Maps</h2>
      <div class="section-desc">Not real behavioral data — a crawler has no access to analytics or session recordings. This infers where each persona's goal-driven path most likely lives in the site's actual structure. Worth validating against real analytics if you have them.</div>
      <div class="card stat-card" style="max-width:200px; margin-bottom:16px"><div class="num">${journeyMap.journeysWithAnyPresence}</div><div class="label">Personas With Any Presence</div></div>
      ${journeyMap.journeys
        .map(
          (j) => `<div class="card" style="margin-bottom:12px">
        <div style="display:flex; justify-content:space-between"><h3 style="font-size:17px">${esc(j.name)}</h3><span class="muted small">${j.stagesPresent} / ${j.stagesTotal} stages found</span></div>
        <div class="muted small" style="margin-bottom:8px">${esc(j.description)}</div>
        ${j.stages.map(renderJourneyStage).join("")}
      </div>`,
        )
        .join("")}
    </section>

    <section id="sec-linking-map">
      <h2 class="section-title">Internal Linking Map</h2>
      <div class="section-desc">A map of how pages link to each other (capped at 250 nodes for legibility). Bigger dots have more inbound links — tiny, disconnected dots are worth a look.</div>
      <div class="card">${renderLinkingMap(pages)}</div>
    </section>

  </div>

  <div id="tab-content" class="tab-panel">

    <section id="sec-content-findings">
      <h2 class="section-title">Content Findings</h2>
      <div class="section-desc">Metadata, duplication, and readability issues detected across the crawl.</div>
      <div class="card">
        ${
          contentFindings.length === 0
            ? "<p>No content findings — clean crawl.</p>"
            : contentFindings
                .map(
                  (f: Finding) => `<div style="display:flex; gap:10px; padding:10px 0; border-bottom:1px solid var(--line);">
            <span class="pill status-issue">${esc(f.severity)}</span>
            <span style="flex:1">${esc(f.title)}.</span>
            <span class="muted small">${f.affectedPageCount} page(s)</span>
          </div>`,
                )
                .join("")
        }
      </div>
    </section>

    <section id="sec-keywords">
      <h2 class="section-title">Keywords &amp; Phrases</h2>
      <div class="card table-scroll">
        <table><thead><tr><th>Keyword</th><th>Occurrences</th><th>Pages</th><th></th><th>Top Phrases</th><th>Occurrences</th></tr></thead>
        <tbody>${Array.from({ length: Math.max(keywords.length, phrases.length) }, (_, i) => {
          const k = keywords[i];
          const p = phrases[i];
          return `<tr><td>${esc(k?.keyword)}</td><td>${k?.occurrences ?? ""}</td><td>${k?.pagesFoundOn ?? ""}</td><td></td><td>${esc(p?.phrase)}</td><td>${p?.occurrences ?? ""}</td></tr>`;
        }).join("")}</tbody></table>
      </div>
    </section>

    <section id="sec-feature-matrix">
      <h2 class="section-title">Feature Matrix</h2>
      <div class="section-desc">Whether common website capabilities appear to be present — a discovery-phase signal, not a definitive functional inventory.</div>
      <div class="card table-scroll">
        <table><thead><tr><th>Feature</th><th>Detected?</th><th>Pages</th></tr></thead>
        <tbody>${featureMatrix.map((f) => `<tr><td>${esc(f.feature)}</td><td>${f.detected ? "Yes" : "No"}</td><td>${f.detected ? f.pagesFoundOn : "—"}</td></tr>`).join("")}</tbody></table>
      </div>
    </section>

    <section id="sec-integrations">
      <h2 class="section-title">Integrations</h2>
      <div class="section-desc">Third-party tools detected two ways: matching known script domains, and checking which global JavaScript variables actually initialized on each rendered page — the second catches tools regardless of which domain served the file from.</div>
      <div class="grid grid-2">
        <div class="card">
          <strong class="small">Recognized</strong>
          <table style="margin-top:8px"><thead><tr><th>Integration</th><th>Category</th><th>Pages</th></tr></thead>
          <tbody>${
            integrations.recognized.length === 0
              ? '<tr><td colspan="3">No recognized integrations detected.</td></tr>'
              : integrations.recognized.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.category)}</td><td>${i.pagesFoundOn}</td></tr>`).join("")
          }</tbody></table>
        </div>
        <div class="card">
          <strong class="small">Unrecognized script domains</strong>
          <table style="margin-top:8px"><thead><tr><th>Domain</th><th>References</th></tr></thead>
          <tbody>${
            integrations.unrecognized.length === 0
              ? '<tr><td colspan="2">No unrecognized third-party script domains found.</td></tr>'
              : integrations.unrecognized.map((u) => `<tr><td class="mono">${esc(u.domain)}</td><td>${u.references}</td></tr>`).join("")
          }</tbody></table>
        </div>
      </div>
    </section>

    <section id="sec-link-health">
      <h2 class="section-title">External Link Health</h2>
      <div class="card table-scroll">
        <table><thead><tr><th>Broken URL</th><th>Status</th><th>Linked From</th></tr></thead>
        <tbody>${
          externalLinkHealth.length === 0
            ? '<tr><td colspan="3">No broken external links found among the checked sample.</td></tr>'
            : externalLinkHealth.map((r) => `<tr><td class="mono">${esc(r.url)}</td><td>${esc(String(r.status))}</td><td>${r.linkedFromCount}</td></tr>`).join("")
        }</tbody></table>
      </div>
    </section>

  </div>

  <section id="sec-inventory">
    <h2 class="section-title">Full Page Inventory</h2>
    <div class="card table-scroll">
      <table><thead><tr><th>URL</th><th>Status</th><th>Title</th><th>Words</th><th>Depth</th><th>Error</th></tr></thead>
      <tbody>${pages.map((p) => `<tr><td class="mono">${esc(p.url)}</td><td>${p.statusCode ?? "—"}</td><td>${esc(p.title)}</td><td>${p.wordCount}</td><td>${p.depth}</td><td class="small">${esc(p.error)}</td></tr>`).join("")}</tbody></table>
    </div>
  </section>

</div>
<script>
  function showTab(id, btn) {
    document.querySelectorAll(".tab-panel").forEach(function(el) { el.classList.remove("active"); });
    document.querySelectorAll(".tab-btn").forEach(function(el) { el.classList.remove("active"); });
    document.getElementById("tab-" + id).classList.add("active");
    btn.classList.add("active");
  }

  function jumpTo(event, sectionId, tabId) {
    event.preventDefault();
    if (tabId) {
      const btnIndex = tabId === "ux" ? 0 : 1;
      const btn = document.querySelectorAll(".tab-btn")[btnIndex];
      showTab(tabId, btn);
    }
    const target = document.getElementById(sectionId);
    if (target && typeof target.scrollIntoView === "function") target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
</script>
</body>
</html>`;
}
