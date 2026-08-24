import type { AuditReport, CrawledPage, Finding, HeuristicCard } from "./types";
import { buildScorecard } from "./scoring";
import { detectFeatures } from "./features";
import { buildJourneyMap } from "./journeys";
import { generateInPlainTerms, generateUxLeadAssessment, nextSprintFromFindings } from "./narrative";
import { normalizeCrawlUrl } from "./url";

function makeFinding(
  n: number,
  f: Omit<Finding, "id">,
): Finding {
  return { id: `f${n}`, ...f };
}

const STOP_KEYWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "your", "are", "was", "were",
  "cookie", "cookies", "settings", "accept", "privacy", "notice", "please",
  "hirslanden", "home", "page", "click", "here", "more", "learn",
]);

function topKeywords(pages: CrawledPage[], limit = 18) {
  const counts = new Map<string, number>();
  for (const p of pages) {
    const words = p.visibleTextSample.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
    for (const w of words) {
      if (STOP_KEYWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function heuristicCards(findings: Finding[]): HeuristicCard[] {
  const bullets = (types: string[]) =>
    findings.filter((f) => types.includes(f.findingType)).map((f) => f.title);
  const card = (
    id: string,
    name: string,
    description: string,
    types: string[] | null,
    reason?: string,
  ): HeuristicCard => {
    if (!types) {
      return { id, name, description, assessed: false, status: "Not assessed", bullets: [], notAssessedReason: reason };
    }
    const b = bullets(types);
    if (!b.length) return { id, name, description, assessed: true, status: "No issues found", bullets: [] };
    return { id, name, description, assessed: true, status: `${b.length} finding(s)`, bullets: b };
  };
  return [
    card("h1", "H1 · Visibility of system status", "Loading, confirmation, progress.", null, "Needs watching real interactions — a crawl sees HTML, not a submit."),
    card("h2", "H2 · Match between system and the real world", "Visitor language, conventions, mental models.", ["cms_leftover", "awkward_copy", "rtl_mismatch"]),
    card("h3", "H3 · User control and freedom", "Undo, back out, escape.", null, "Needs a human on forms, booking, and wizards."),
    card("h4", "H4 · Consistency and standards", "Same conventions across pages.", ["duplicate_title", "missing_title", "duplicate_nav"]),
    card("h5", "H5 · Error prevention", "Clear fields, sensible defaults.", ["cookie_gate"], "Forms still need a human. Cookie-gating a booking widget is treated as prevention failure."),
    card("h6", "H6 · Recognition rather than recall", "Find by browsing.", ["orphan_page", "weak_search"]),
    card("h7", "H7 · Flexibility and efficiency of use", "Shortcuts, filters, saved state.", null, "Needs usage data or task testing."),
    card("h8", "H8 · Aesthetic and minimalist design", "Focus, not filler. Not a word-count test.", ["duplicate_nav", "cookie_banner_cover"]),
    card("h9", "H9 · Error recovery", "Broken links, failed search.", ["broken_page"]),
    card("h10", "H10 · Help and documentation", "Help when stuck.", null, "Qualitative — not a crawl signal."),
  ];
}

export function analyzeSite(
  pages: CrawledPage[],
  startUrl: string,
  opts: { truncated: boolean; durationSeconds: number; id: string; isSample?: boolean },
): AuditReport {
  let n = 0;
  const findings: Finding[] = [];
  const push = (f: Omit<Finding, "id">) => findings.push(makeFinding(++n, f));

  const ok = pages.filter((p) => !p.error);
  const startNorm = normalizeCrawlUrl(startUrl);

  const inbound = new Map<string, number>();
  for (const p of ok) {
    for (const link of p.internalLinks) {
      const k = normalizeCrawlUrl(link);
      inbound.set(k, (inbound.get(k) ?? 0) + 1);
    }
  }
  const orphans = ok.filter((p) => p.url !== startNorm && !inbound.get(normalizeCrawlUrl(p.url)));
  if (orphans.length) {
    push({
      findingType: "orphan_page",
      title: `${orphans.length} orphan page(s) with no inbound internal links in this crawl`,
      description: "Live, but not linked from other crawled pages. Check analytics before treating as a sprint-one item — conversion blockers outrank orphans.",
      severity: orphans.length > 20 ? "high" : "low",
      effortBucket: "config",
      affectedPageCount: orphans.length,
      affectedUrlsSample: orphans.slice(0, 8).map((p) => p.url),
      detectionMethod: "Normalized inbound-link count across the crawl",
      sprintPriority: "P3",
    });
  }

  const broken = pages.filter((p) => p.statusCode !== null && p.statusCode >= 400);
  if (broken.length) {
    push({
      findingType: "broken_page",
      title: `${broken.length} page(s) returned an error status`,
      description: "HTTP 4xx/5xx during the rendered crawl.",
      severity: broken.length > 5 ? "high" : "medium",
      effortBucket: "config",
      affectedPageCount: broken.length,
      affectedUrlsSample: broken.slice(0, 8).map((p) => p.url),
      detectionMethod: "HTTP status after Playwright navigation",
      sprintPriority: "P1",
    });
  }

  const missingH1 = ok.filter((p) => !p.h1Text);
  if (missingH1.length) {
    push({
      findingType: "missing_h1",
      title: `${missingH1.length} page(s) missing an H1`,
      description: "Affects accessibility and SEO.",
      severity: "medium",
      effortBucket: "config",
      affectedPageCount: missingH1.length,
      affectedUrlsSample: missingH1.slice(0, 8).map((p) => p.url),
      detectionMethod: "querySelector('h1') after hydration",
      sprintPriority: "P2",
    });
  }

  const missingTitle = ok.filter((p) => !p.title);
  if (missingTitle.length) {
    push({
      findingType: "missing_title",
      title: `${missingTitle.length} page(s) missing a title tag`,
      description: "Hurts SEO and tab usability.",
      severity: "high",
      effortBucket: "config",
      affectedPageCount: missingTitle.length,
      affectedUrlsSample: missingTitle.slice(0, 8).map((p) => p.url),
      detectionMethod: "document.title after render",
      sprintPriority: "P2",
    });
  }

  const missingMeta = ok.filter((p) => !p.metaDescription);
  if (missingMeta.length) {
    push({
      findingType: "missing_meta_description",
      title: `${missingMeta.length} page(s) missing a meta description`,
      description: "Search engines will invent a snippet.",
      severity: "low",
      effortBucket: "config",
      affectedPageCount: missingMeta.length,
      affectedUrlsSample: missingMeta.slice(0, 8).map((p) => p.url),
      detectionMethod: "meta[name=description]",
      sprintPriority: "P3",
    });
  }

  const byTitle = new Map<string, CrawledPage[]>();
  for (const p of ok) {
    if (!p.title) continue;
    if (!byTitle.has(p.title)) byTitle.set(p.title, []);
    byTitle.get(p.title)!.push(p);
  }
  const dupTitleGroups = [...byTitle.values()].filter((g) => g.length > 1);
  const dupTitlePages = dupTitleGroups.flat();
  if (dupTitleGroups.length) {
    push({
      findingType: "duplicate_title",
      title: `${dupTitleGroups.length} title(s) reused across ${dupTitlePages.length} pages`,
      description: "Usually pagination, cloned facility templates, or a missing title pattern. This is a real SEO issue — it is not a 99 SEO score.",
      severity: dupTitlePages.length > 20 ? "high" : "medium",
      effortBucket: "config",
      affectedPageCount: dupTitlePages.length,
      affectedUrlsSample: dupTitlePages.slice(0, 8).map((p) => p.url),
      detectionMethod: "Exact title match after render",
      sprintPriority: "P1",
    });
  }

  const thin = ok.filter((p) => p.wordCount > 0 && p.wordCount < 150);
  if (thin.length) {
    push({
      findingType: "thin_content",
      title: `${thin.length} page(s) under 150 words`,
      description: "May be pagination shells or location stubs. Word count is not an aesthetic heuristic.",
      severity: "low",
      effortBucket: "config",
      affectedPageCount: thin.length,
      affectedUrlsSample: thin.slice(0, 8).map((p) => p.url),
      detectionMethod: "Visible innerText word count after hydration and cookie dismiss",
      sprintPriority: "P3",
    });
  }

  const cookieGated = ok.filter((p) => p.signals.cookieGatingCopy || p.signals.iframeGatedCount > 0);
  if (cookieGated.length) {
    const onBooking = cookieGated.filter((p) => /book|appoint|doctor|emergenc/i.test(p.url));
    push({
      findingType: "cookie_gate",
      title: `${cookieGated.length} page(s) hide content behind a cookie / CMP gate`,
      description: onBooking.length
        ? "Primary conversion (booking, doctor, emergency) is gated on 'functional' cookies. Classify those as strictly necessary and never cover the widget."
        : "CMP overlay or 'accept cookies to see this content' is replacing real UI. Dismissing the banner is part of a JS-aware crawl; users still hit this wall.",
      severity: onBooking.length ? "critical" : "high",
      effortBucket: "config",
      affectedPageCount: cookieGated.length,
      affectedUrlsSample: cookieGated.slice(0, 8).map((p) => p.url),
      detectionMethod: "Rendered copy + iframe parent text after first paint, before and after consent",
      sprintPriority: "P0",
    });
  }

  const cookieCover = ok.filter((p) => p.signals.cookieBannerVisible);
  if (cookieCover.length / Math.max(ok.length, 1) > 0.4) {
    push({
      findingType: "cookie_banner_cover",
      title: `Cookie banner present on ${cookieCover.length} of ${ok.length} pages`,
      description: "A CMP that covers the H1, filters, or booking iframe is an access issue, not a legal footnote.",
      severity: "high",
      effortBucket: "config",
      affectedPageCount: cookieCover.length,
      affectedUrlsSample: cookieCover.slice(0, 6).map((p) => p.url),
      detectionMethod: "OneTrust / Cookiebot / Osano selectors + banner copy",
      sprintPriority: "P0",
    });
  }

  const dupNav = ok.filter((p) => p.signals.duplicateNavLabels.length > 0);
  if (dupNav.length) {
    const labels = [...new Set(dupNav.flatMap((p) => p.signals.duplicateNavLabels))].slice(0, 8);
    push({
      findingType: "duplicate_nav",
      title: `Primary navigation labels repeat on ${dupNav.length} page(s)`,
      description: `Repeated labels: ${labels.join(", ") || "—"}. Usually two header partials composing in a CMS (AEM / Sitecore / inherited parent brand). Doubles tab stops and looks broken on mobile.`,
      severity: "high",
      effortBucket: "custom_dev",
      affectedPageCount: dupNav.length,
      affectedUrlsSample: dupNav.slice(0, 6).map((p) => p.url),
      detectionMethod: "Frequency of header/nav link text after hydration",
      sprintPriority: "P0",
    });
  }

  const leftovers = ok.filter((p) => p.signals.cmsLeftovers.length > 0);
  if (leftovers.length) {
    const tokens = [...new Set(leftovers.flatMap((p) => p.signals.cmsLeftovers))];
    push({
      findingType: "cms_leftover",
      title: `CMS / parent-brand leftovers on ${leftovers.length} page(s)`,
      description: `Detected: ${tokens.join(", ")}. German pagination ("Seite"), parent-brand home labels, and placeholder copy are trust failures — a title-tag crawler will never rank them.`,
      severity: "high",
      effortBucket: "config",
      affectedPageCount: leftovers.length,
      affectedUrlsSample: leftovers.slice(0, 6).map((p) => p.url),
      detectionMethod: "Rendered text + HTML needle match (Hirslanden, Seite, Key word/name, Lorem…)",
      sprintPriority: "P0",
    });
  }

  const rtl = ok.filter((p) => {
    const lang = (p.signals.htmlLang || p.htmlLang || "").toLowerCase();
    const dir = (p.signals.htmlDir || "").toLowerCase();
    const isRtlLang = /^(ar|he|fa|ur)/.test(lang);
    return isRtlLang && dir !== "rtl";
  });
  if (rtl.length) {
    push({
      findingType: "rtl_mismatch",
      title: `${rtl.length} page(s) declare an RTL language without dir="rtl"`,
      description: "Arabic (and other RTL) pages that keep an LTR layout, English nav, and English cookie/chat chrome are not localised. In the UAE this is an access failure.",
      severity: "critical",
      effortBucket: "custom_dev",
      affectedPageCount: rtl.length,
      affectedUrlsSample: rtl.slice(0, 6).map((p) => p.url),
      detectionMethod: "html lang vs dir after computed style",
      sprintPriority: "P0",
    });
  }

  const weakSearch = ok.filter((p) => /keyword/i.test(p.signals.searchPlaceholder || ""));
  if (weakSearch.length) {
    push({
      findingType: "weak_search",
      title: `Search placeholder is a CMS default ("Keyword…") on ${weakSearch.length} page(s)`,
      description: "Healthcare search should prompt doctor, speciality, or symptom — not 'Keyword'.",
      severity: "medium",
      effortBucket: "config",
      affectedPageCount: weakSearch.length,
      affectedUrlsSample: weakSearch.slice(0, 5).map((p) => p.url),
      detectionMethod: "input placeholder after render",
      sprintPriority: "P2",
    });
  }

  const violationsByImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  let a11yPages = 0;
  for (const p of pages) {
    if ((p.accessibilityViolations ?? []).length) a11yPages += 1;
    for (const v of p.accessibilityViolations ?? []) {
      const k = v.impact as keyof typeof violationsByImpact;
      if (k in violationsByImpact) violationsByImpact[k] += v.nodesCount;
    }
  }
  if (a11yPages) {
    push({
      findingType: "accessibility_summary",
      title: `Automated axe flagged issues on ${a11yPages} of ${pages.length} pages`,
      description: `Node counts — critical ${violationsByImpact.critical}, serious ${violationsByImpact.serious}, moderate ${violationsByImpact.moderate}, minor ${violationsByImpact.minor}. This is a floor (~30% of real WCAG). It is not a 0/100 score.`,
      severity: violationsByImpact.critical > 0 ? "high" : "medium",
      effortBucket: "custom_dev",
      affectedPageCount: a11yPages,
      affectedUrlsSample: pages.filter((p) => p.accessibilityViolations.length).slice(0, 6).map((p) => p.url),
      detectionMethod: "axe-core 4.x on the hydrated DOM",
      sprintPriority: "P1",
    });
  }

  let totalImages = 0;
  let missingAlt = 0;
  for (const p of ok) {
    totalImages += p.signals.imageCount;
    missingAlt += p.signals.emptyAltCount;
  }
  const imageAltCoveragePct = totalImages > 0 ? Math.round((1 - missingAlt / totalImages) * 1000) / 10 : 100;

  const conversionBlockers = findings.filter((f) => f.sprintPriority === "P0" && f.findingType !== "duplicate_nav").length;
  const scorecard = buildScorecard({
    totalPages: pages.length,
    orphanPageCount: orphans.length,
    pagesOverThreeClicks: pages.filter((p) => p.depth > 3).length,
    thinContentCount: thin.length,
    duplicateContentPageCount: dupTitlePages.length,
    missingH1Count: missingH1.length,
    imageAltCoveragePct,
    pagesWithAccessibilityIssues: a11yPages,
    accessibilityViolationsByImpact: violationsByImpact,
    missingTitleCount: missingTitle.length,
    missingMetaDescriptionCount: missingMeta.length,
    canonicalMissingCount: ok.filter((p) => !p.canonical).length,
    duplicateTitlePageCount: dupTitlePages.length,
    conversionBlockers,
    cmsLeftoverPages: leftovers.length,
    cookieGatedPages: cookieGated.length,
  });

  const langs = new Set(ok.map((p) => (p.htmlLang || "").split("-")[0]).filter(Boolean));
  const features = detectFeatures(pages, langs.size > 1);
  const journeys = buildJourneyMap(pages);
  const depths = ok.map((p) => p.depth);
  const avgClickDepth = depths.length ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : 0;

  const narrative = {
    scorecard,
    findings,
    totalPages: pages.length,
    cookieGatedPages: cookieGated.length,
    truncated: opts.truncated,
  };

  return {
    id: opts.id,
    startUrl,
    host: (() => {
      try {
        return new URL(startUrl).hostname;
      } catch {
        return startUrl;
      }
    })(),
    crawledAt: new Date().toISOString(),
    durationSeconds: opts.durationSeconds,
    pageCount: pages.length,
    pages: pages.map((p) => ({
      url: p.url,
      title: p.title,
      statusCode: p.statusCode,
      depth: p.depth,
      wordCount: p.wordCount,
      h1Text: p.h1Text,
      error: p.error,
      signals: p.signals,
    })),
    scorecard,
    findings,
    plainTerms: generateInPlainTerms(narrative),
    uxLeadAssessment: generateUxLeadAssessment(narrative),
    nextSprint: nextSprintFromFindings(findings),
    heuristics: heuristicCards(findings),
    featureMatrix: features,
    journeys,
    keywords: topKeywords(pages),
    crawlMeta: {
      jsHeavyPages: ok.filter((p) => p.isClientRendered || p.signals.hydrationWaitedMs > 1500).length,
      cookieBanners: cookieCover.length,
      cookieGatedPages: cookieGated.length,
      cookiesDismissed: ok.filter((p) => p.signals.cookieDismissed).length,
      spaHydrationPages: ok.filter((p) => p.signals.wordCountBeforeConsent + 40 < p.wordCount).length,
      truncated: opts.truncated,
    },
    orphanPageCount: orphans.length,
    thinContentCount: thin.length,
    duplicateTitlePageCount: dupTitlePages.length,
    missingH1Count: missingH1.length,
    pagesWithA11yIssues: a11yPages,
    maxClickDepth: depths.length ? Math.max(...depths) : 0,
    avgClickDepth,
    isSample: opts.isSample,
  };
}
