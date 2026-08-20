import {
  runTemplateAnalysis,
  structuralFingerprint,
} from "../lib/templates.js";
import {
  extractComponentSignatures,
  runComponentAnalysis,
} from "../lib/components.js";
import {
  extractVisibleText,
  countImagesAndMissingAlt,
  extractScripts,
  fleschReadingEase,
  findNearDuplicateClusters,
  classifyIntegrations,
  topKeywords,
  topPhrases,
} from "../lib/reportAnalysis.js";
import { extractLocaleSignals } from "../lib/locale.js";
import { checkExternalLinkHealth } from "../lib/externalLinkHealth.js";
import { runVarianceAnalysis } from "../lib/variance.js";
import { buildScorecard } from "../lib/scoring.js";
import { generateInPlainTerms, generateUxLeadAssessment } from "../lib/narrative.js";
import { detectFeaturesAcrossSite } from "../lib/featureMatrix.js";
import {
  detectCms,
  detectJsFrameworks,
  hasMixedContent,
  looksLikeExposedStaging,
  hasPiiFormWithoutPrivacyLink,
} from "../lib/techFingerprint.js";
import type { CrawledPage } from "../lib/crawler.js";

export type Finding = {
  id: string;
  findingType: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  effortBucket: "ootb" | "config" | "custom_dev";
  personas: ("ux" | "content" | "business")[];
  affectedPageCount: number;
  affectedUrlsSample: string[];
  detectionMethod: string;
};

let findingCounter = 0;
function makeFinding(f: Omit<Finding, "id">): Finding {
  return { id: `f${findingCounter++}`, ...f };
}

export type AnalysisResult = {
  scorecard: ReturnType<typeof buildScorecard>;
  findings: Finding[];
  templateAnalysis: ReturnType<typeof runTemplateAnalysis>;
  componentAnalysis: ReturnType<typeof runComponentAnalysis>;
  featureMatrix: ReturnType<typeof detectFeaturesAcrossSite>;
  externalLinkHealth: Awaited<ReturnType<typeof checkExternalLinkHealth>>;
  keywords: ReturnType<typeof topKeywords>;
  phrases: ReturnType<typeof topPhrases>;
  integrations: ReturnType<typeof classifyIntegrations>;
  plainTerms: string[];
  uxLeadAssessment: string[];
};

/**
 * Every finding-generation function here mirrors the Vercel app's
 * app/api/analyze/[auditId]/route.ts almost line for line — same
 * detection logic, just reading from an in-memory array of crawled
 * pages instead of a database. Accessibility (axe-core) findings are
 * intentionally NOT included here — see README for why.
 */
export async function analyzeSite(
  pages: CrawledPage[],
  startUrl: string,
  clientStatedPageCount: number | null,
  crawlTruncated: boolean,
  rootHost: string,
  personas: ("ux" | "content" | "business")[],
): Promise<AnalysisResult> {
  const findings: Finding[] = [];

  const templateFingerprints = new Map<string, string>();
  const componentHits = new Map<string, Set<string>>();
  const localeByUrl = new Map<string, { lang: string | null; hreflang: { locale: string; url: string }[] }>();

  for (const p of pages) {
    if (!p.renderedDomHtml) continue;
    const fp = structuralFingerprint(p.renderedDomHtml);
    if (fp) templateFingerprints.set(p.url, fp);
    for (const sig of extractComponentSignatures(p.renderedDomHtml)) {
      if (!componentHits.has(sig)) componentHits.set(sig, new Set());
      componentHits.get(sig)!.add(p.url);
    }
    localeByUrl.set(p.url, extractLocaleSignals(p.renderedDomHtml));
  }

  const templateAnalysis = runTemplateAnalysis(
    pages.map((p) => ({
      url: p.url,
      title: p.title,
      statusCode: p.statusCode,
      templateFingerprint: templateFingerprints.get(p.url) ?? null,
    })),
  );
  const componentAnalysis = runComponentAnalysis(componentHits, pages.length);

  // --- UX Lead ---
  const brokenPages = pages.filter((p) => p.statusCode !== null && p.statusCode >= 400);
  if (brokenPages.length) {
    findings.push(
      makeFinding({
        findingType: "broken_page",
        title: `${brokenPages.length} page(s) returning an error status`,
        description: "These pages returned an HTTP 4xx/5xx status during the crawl.",
        severity: brokenPages.length > 5 ? "high" : "medium",
        effortBucket: "config",
        personas: ["ux", "business"],
        affectedPageCount: brokenPages.length,
        affectedUrlsSample: brokenPages.slice(0, 10).map((p) => p.url),
        detectionMethod: "HTTP status code >= 400 recorded during crawl",
      }),
    );
  }

  const missingH1 = pages.filter((p) => !p.error && !p.h1Text);
  if (missingH1.length) {
    findings.push(
      makeFinding({
        findingType: "missing_h1",
        title: `${missingH1.length} page(s) missing an H1 heading`,
        description: "No <h1> element was found — affects both accessibility and SEO.",
        severity: "medium",
        effortBucket: "config",
        personas: ["ux", "content"],
        affectedPageCount: missingH1.length,
        affectedUrlsSample: missingH1.slice(0, 10).map((p) => p.url),
        detectionMethod: "querySelector('h1') returned null",
      }),
    );
  }

  const inboundCounts = new Map<string, number>();
  for (const p of pages) for (const link of p.internalLinks) inboundCounts.set(link, (inboundCounts.get(link) ?? 0) + 1);
  const orphanPages = pages.filter((p) => !p.error && p.url !== startUrl && !inboundCounts.get(p.url));
  if (orphanPages.length) {
    findings.push(
      makeFinding({
        findingType: "orphan_page",
        title: `${orphanPages.length} orphan page(s) with no inbound internal links`,
        description: "Reachable during the crawl but not linked to by any other crawled page.",
        severity: "medium",
        effortBucket: "config",
        personas: ["ux", "content"],
        affectedPageCount: orphanPages.length,
        affectedUrlsSample: orphanPages.slice(0, 10).map((p) => p.url),
        detectionMethod: "Zero matching internal inbound links across the crawl",
      }),
    );
  }

  // --- Content Strategist ---
  const missingTitle = pages.filter((p) => !p.error && !p.title);
  if (missingTitle.length) {
    findings.push(
      makeFinding({
        findingType: "missing_title",
        title: `${missingTitle.length} page(s) missing a <title> tag`,
        description: "Hurts SEO ranking and browser-tab/bookmark usability.",
        severity: "high",
        effortBucket: "config",
        personas: ["content", "business"],
        affectedPageCount: missingTitle.length,
        affectedUrlsSample: missingTitle.slice(0, 10).map((p) => p.url),
        detectionMethod: "document.title was empty",
      }),
    );
  }

  const missingMetaDescription = pages.filter((p) => !p.error && !p.metaDescription);
  if (missingMetaDescription.length) {
    findings.push(
      makeFinding({
        findingType: "missing_meta_description",
        title: `${missingMetaDescription.length} page(s) missing a meta description`,
        description: "Search engines fall back to auto-generated snippets.",
        severity: "low",
        effortBucket: "config",
        personas: ["content"],
        affectedPageCount: missingMetaDescription.length,
        affectedUrlsSample: missingMetaDescription.slice(0, 10).map((p) => p.url),
        detectionMethod: "meta[name=description] not found",
      }),
    );
  }

  const byTitle = new Map<string, CrawledPage[]>();
  for (const p of pages) {
    if (!p.title) continue;
    if (!byTitle.has(p.title)) byTitle.set(p.title, []);
    byTitle.get(p.title)!.push(p);
  }
  const duplicateTitleGroups = [...byTitle.values()].filter((g) => g.length > 1);
  if (duplicateTitleGroups.length) {
    const affected = duplicateTitleGroups.flat();
    findings.push(
      makeFinding({
        findingType: "duplicate_title",
        title: `${duplicateTitleGroups.length} title(s) reused across ${affected.length} pages`,
        description: "Usually signals a templating issue or thin/boilerplate content.",
        severity: "medium",
        effortBucket: "config",
        personas: ["content", "business"],
        affectedPageCount: affected.length,
        affectedUrlsSample: affected.slice(0, 10).map((p) => p.url),
        detectionMethod: "Exact string match on title across crawled pages",
      }),
    );
  }

  const pageTexts = pages.filter((p) => p.renderedDomHtml).map((p) => ({ url: p.url, text: extractVisibleText(p.renderedDomHtml) }));
  const nearDupClusters = findNearDuplicateClusters(pageTexts);
  if (nearDupClusters.length) {
    const totalAffected = nearDupClusters.reduce((s, c) => s + c.pages.length, 0);
    findings.push(
      makeFinding({
        findingType: "near_duplicate_content",
        title: `${nearDupClusters.length} cluster(s) of near-duplicate pages (${totalAffected} pages total)`,
        description: "Textually very similar (>=75% shingle overlap) without being byte-identical.",
        severity: "medium",
        effortBucket: "config",
        personas: ["content"],
        affectedPageCount: totalAffected,
        affectedUrlsSample: nearDupClusters[0].pages.slice(0, 10),
        detectionMethod: "8-word shingling + Jaccard similarity, threshold 0.75",
      }),
    );
  }

  const readabilityScores = pageTexts
    .map((pt) => ({ url: pt.url, score: fleschReadingEase(pt.text) }))
    .filter((r): r is { url: string; score: number } => r.score !== null);
  const difficultPages = readabilityScores.filter((r) => r.score < 30);
  if (difficultPages.length) {
    findings.push(
      makeFinding({
        findingType: "low_readability",
        title: `${difficultPages.length} page(s) score as "very difficult to read"`,
        description: "Flesch Reading Ease below 30 — worth a plain-language review.",
        severity: "low",
        effortBucket: "custom_dev",
        personas: ["content"],
        affectedPageCount: difficultPages.length,
        affectedUrlsSample: difficultPages.slice(0, 10).map((p) => p.url),
        detectionMethod: "Flesch Reading Ease formula on extracted visible text",
      }),
    );
  }

  const AXE_IMPACT_TO_SEVERITY: Record<string, Finding["severity"]> = {
    critical: "critical",
    serious: "high",
    moderate: "medium",
    minor: "low",
  };
  const byRuleId = new Map<string, { impact: string; description: string; pages: Set<string> }>();
  for (const p of pages) {
    for (const v of p.accessibilityViolations ?? []) {
      if (!byRuleId.has(v.id)) byRuleId.set(v.id, { impact: v.impact, description: v.description, pages: new Set() });
      byRuleId.get(v.id)!.pages.add(p.url);
    }
  }
  for (const [ruleId, data] of byRuleId) {
    findings.push(
      makeFinding({
        findingType: "accessibility_violation",
        title: `WCAG issue: ${data.description}`,
        description: `axe-core rule "${ruleId}" (${data.impact} impact) triggered on ${data.pages.size} page(s).`,
        severity: AXE_IMPACT_TO_SEVERITY[data.impact] ?? "medium",
        effortBucket: "config",
        personas: ["ux"],
        affectedPageCount: data.pages.size,
        affectedUrlsSample: [...data.pages].slice(0, 10),
        detectionMethod: `axe-core 4.x automated WCAG 2.1 AA scan, rule "${ruleId}"`,
      }),
    );
  }
  const pagesWithA11yIssues = pages.filter((p) => (p.accessibilityViolations ?? []).length > 0).length;

  // --- Business Analyst: tech stack, risk flags, variance ---
  const cmsPages = new Map<string, Set<string>>();
  const frameworkPages = new Map<string, Set<string>>();
  const mixedContentPages: CrawledPage[] = [];
  const stagingPages: CrawledPage[] = [];
  const piiPages: CrawledPage[] = [];

  for (const p of pages) {
    if (!p.renderedDomHtml) continue;
    for (const cms of detectCms(p.renderedDomHtml)) {
      if (!cmsPages.has(cms)) cmsPages.set(cms, new Set());
      cmsPages.get(cms)!.add(p.url);
    }
    for (const fw of detectJsFrameworks(p.renderedDomHtml)) {
      if (!frameworkPages.has(fw)) frameworkPages.set(fw, new Set());
      frameworkPages.get(fw)!.add(p.url);
    }
    if (hasMixedContent(p.renderedDomHtml, p.url)) mixedContentPages.push(p);
    if (looksLikeExposedStaging(p.url)) stagingPages.push(p);
    if (hasPiiFormWithoutPrivacyLink(p.renderedDomHtml)) piiPages.push(p);
  }

  for (const [name, pageSet] of cmsPages) {
    findings.push(
      makeFinding({
        findingType: "cms_detected",
        title: `Detected platform: ${name}`,
        description: `Signatures found on ${pageSet.size} page(s).`,
        severity: "low",
        effortBucket: "ootb",
        personas: ["business"],
        affectedPageCount: pageSet.size,
        affectedUrlsSample: [...pageSet].slice(0, 10),
        detectionMethod: "HTML path/meta-tag signature match",
      }),
    );
  }
  for (const [name, pageSet] of frameworkPages) {
    findings.push(
      makeFinding({
        findingType: "js_framework_detected",
        title: `Detected JS framework: ${name}`,
        description: `Signatures found on ${pageSet.size} page(s).`,
        severity: "low",
        effortBucket: "ootb",
        personas: ["business"],
        affectedPageCount: pageSet.size,
        affectedUrlsSample: [...pageSet].slice(0, 10),
        detectionMethod: "DOM attribute/global-variable signature match",
      }),
    );
  }
  if (mixedContentPages.length) {
    findings.push(
      makeFinding({
        findingType: "mixed_content",
        title: `${mixedContentPages.length} page(s) load insecure (HTTP) resources on HTTPS`,
        description: "Causes browser warnings and can be silently blocked.",
        severity: "high",
        effortBucket: "config",
        personas: ["business", "ux"],
        affectedPageCount: mixedContentPages.length,
        affectedUrlsSample: mixedContentPages.slice(0, 10).map((p) => p.url),
        detectionMethod: "HTTP-scheme src/href found on an HTTPS page",
      }),
    );
  }
  if (stagingPages.length) {
    findings.push(
      makeFinding({
        findingType: "exposed_staging",
        title: `${stagingPages.length} page(s) appear to be on a staging/dev subdomain`,
        description: "Worth confirming these aren't unintentionally public.",
        severity: "medium",
        effortBucket: "config",
        personas: ["business"],
        affectedPageCount: stagingPages.length,
        affectedUrlsSample: stagingPages.slice(0, 10).map((p) => p.url),
        detectionMethod: "Hostname pattern match",
      }),
    );
  }
  if (piiPages.length) {
    findings.push(
      makeFinding({
        findingType: "pii_without_privacy_link",
        title: `${piiPages.length} page(s) collect personal data with no visible privacy link`,
        description: "Heuristic signal — worth a manual check.",
        severity: "medium",
        effortBucket: "config",
        personas: ["business"],
        affectedPageCount: piiPages.length,
        affectedUrlsSample: piiPages.slice(0, 10).map((p) => p.url),
        detectionMethod: "Form field heuristic + absence of a nearby 'privacy' link",
      }),
    );
  }

  const variance = runVarianceAnalysis(clientStatedPageCount, pages.length, crawlTruncated);
  if (variance) {
    findings.push(
      makeFinding({
        findingType: "page_count_variance",
        title: `Crawled ${variance.crawledPageCount} vs. client-stated ${variance.clientStatedPageCount} (${variance.differencePct > 0 ? "+" : ""}${variance.differencePct}%)`,
        description: variance.note,
        severity: Math.abs(variance.differencePct) > 10 ? "medium" : "low",
        effortBucket: "ootb",
        personas: ["business"],
        affectedPageCount: variance.crawledPageCount,
        affectedUrlsSample: [],
        detectionMethod: "Client-stated vs. crawled page count",
      }),
    );
  }

  // --- Scorecard ---
  let totalImages = 0;
  let totalMissingAlt = 0;
  for (const p of pages) {
    if (!p.renderedDomHtml) continue;
    const { total, missing } = countImagesAndMissingAlt(p.renderedDomHtml);
    totalImages += total;
    totalMissingAlt += missing;
  }
  const imageAltCoveragePct = totalImages > 0 ? Math.round((1 - totalMissingAlt / totalImages) * 1000) / 10 : 100;

  const scorecard = buildScorecard({
    totalPages: pages.length,
    orphanPageCount: orphanPages.length,
    pagesOverThreeClicks: pages.filter((p) => p.depth > 3).length,
    thinContentCount: pages.filter((p) => p.wordCount > 0 && p.wordCount < 150).length,
    duplicateContentPageCount: duplicateTitleGroups.flat().length + nearDupClusters.reduce((s, c) => s + c.pages.length, 0),
    missingH1Count: missingH1.length,
    imageAltCoveragePct,
    pagesWithAccessibilityIssues: pagesWithA11yIssues,
    missingTitleCount: missingTitle.length,
    missingMetaDescriptionCount: missingMetaDescription.length,
    canonicalMissingCount: pages.filter((p) => !p.canonical).length,
  });

  // --- Feature matrix, integrations, external link health, keywords ---
  const localePerPage = pages.map((p) => localeByUrl.get(p.url) ?? { lang: null, hreflang: [] });
  const featureMatrix = detectFeaturesAcrossSite(
    pages.map((p, i) => ({
      url: p.url,
      renderedDomHtml: p.renderedDomHtml || null,
      hasMultipleLocales: localePerPage[i].hreflang.length > 0,
    })),
  );

  const perPageDomains = pages.map((p) => ({
    url: p.url,
    domains: p.renderedDomHtml ? extractScripts(p.renderedDomHtml, rootHost).externalDomains : [],
  }));
  const integrations = classifyIntegrations(perPageDomains);

  const allLinksForHealth: { sourceUrl: string; targetUrl: string }[] = [];
  for (const p of pages) for (const ext of p.externalLinks) allLinksForHealth.push({ sourceUrl: p.url, targetUrl: ext });
  const externalLinkHealth = await checkExternalLinkHealth(allLinksForHealth);

  const keywords = topKeywords(pageTexts);
  const phrases = topPhrases(pageTexts);

  const narrativeInputs = {
    scorecard,
    totalPages: pages.length,
    orphanPageCount: orphanPages.length,
    brokenLinkCount: brokenPages.length,
    missingH1Count: missingH1.length,
    missingTitleCount: missingTitle.length,
    missingMetaDescriptionCount: missingMetaDescription.length,
    accessibilityIssuePages: pagesWithA11yIssues,
    duplicateContentCount: duplicateTitleGroups.flat().length,
    thinContentCount: pages.filter((p) => p.wordCount > 0 && p.wordCount < 150).length,
    maxClickDepth: pages.length ? Math.max(...pages.map((p) => p.depth)) : 0,
  };
  const plainTerms = generateInPlainTerms(narrativeInputs);
  const uxLeadAssessment = generateUxLeadAssessment(narrativeInputs);

  const filteredFindings = findings.filter((f) => f.personas.some((p) => personas.includes(p)));

  return {
    scorecard,
    findings: filteredFindings,
    templateAnalysis,
    componentAnalysis,
    featureMatrix,
    externalLinkHealth,
    keywords,
    phrases,
    integrations,
    plainTerms,
    uxLeadAssessment,
  };
}
