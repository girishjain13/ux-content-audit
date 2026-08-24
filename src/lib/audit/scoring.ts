import type { Scorecard } from "./types";

function pctScore(bad: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round(100 * (1 - Math.min(bad, total) / total) * 10) / 10;
}

export type ScoreInputs = {
  totalPages: number;
  orphanPageCount: number;
  pagesOverThreeClicks: number;
  thinContentCount: number;
  duplicateContentPageCount: number;
  missingH1Count: number;
  imageAltCoveragePct: number;
  pagesWithAccessibilityIssues: number;
  accessibilityViolationsByImpact: { critical: number; serious: number; moderate: number; minor: number };
  missingTitleCount: number;
  missingMetaDescriptionCount: number;
  canonicalMissingCount: number;
  duplicateTitlePageCount: number;
  conversionBlockers: number;
  cmsLeftoverPages: number;
  cookieGatedPages: number;
};

function band(score: number): Scorecard["uxMaturityBand"] {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Adequate";
  if (score >= 50) return "Needs Improvement";
  return "Critical";
}

export function scoreIa(inputs: ScoreInputs): number {
  const total = Math.max(inputs.totalPages, 1);
  const orphanScore = pctScore(inputs.orphanPageCount, total);
  // 3-click is a weak heuristic — weight it lightly. Conversion/CMS structure matters more.
  const depthScore = pctScore(inputs.pagesOverThreeClicks, total);
  const leftoverScore = pctScore(inputs.cmsLeftoverPages, total);
  return Math.round((orphanScore * 0.35 + depthScore * 0.15 + leftoverScore * 0.5) * 10) / 10;
}

export function scoreContent(inputs: ScoreInputs): number {
  const total = Math.max(inputs.totalPages, 1);
  const thinScore = pctScore(inputs.thinContentCount, total);
  const dupScore = pctScore(inputs.duplicateContentPageCount, total);
  const headingScore = pctScore(inputs.missingH1Count, total);
  const altScore = inputs.imageAltCoveragePct;
  return Math.round((thinScore * 0.2 + dupScore * 0.35 + headingScore * 0.2 + altScore * 0.25) * 10) / 10;
}

/**
 * Severity-weighted, then capped. A site with a minor contrast nit on
 * every page must not score 0. Critical/serious density drives the score.
 */
export function scoreAccessibility(inputs: ScoreInputs): number {
  const { critical, serious, moderate, minor } = inputs.accessibilityViolationsByImpact;
  const total = Math.max(inputs.totalPages, 1);
  const criticalPerPage = critical / total;
  const seriousPerPage = serious / total;
  const moderatePerPage = moderate / total;
  const minorPerPage = minor / total;
  const penalty =
    Math.min(criticalPerPage, 8) * 6 +
    Math.min(seriousPerPage, 12) * 2.2 +
    Math.min(moderatePerPage, 20) * 0.6 +
    Math.min(minorPerPage, 40) * 0.15;
  let score = 100 - penalty;
  if (inputs.cookieGatedPages / total > 0.3) score -= 8;
  return Math.max(18, Math.min(100, Math.round(score * 10) / 10));
}

export function scoreSeo(inputs: ScoreInputs): number {
  const total = Math.max(inputs.totalPages, 1);
  const titleScore = pctScore(inputs.missingTitleCount, total);
  const descScore = pctScore(inputs.missingMetaDescriptionCount, total);
  const canonicalScore = pctScore(inputs.canonicalMissingCount, total);
  const dupTitleScore = pctScore(inputs.duplicateTitlePageCount, total);
  return Math.round((titleScore * 0.25 + descScore * 0.25 + canonicalScore * 0.15 + dupTitleScore * 0.35) * 10) / 10;
}

export function buildScorecard(inputs: ScoreInputs): Scorecard {
  const iaHealthScore = scoreIa(inputs);
  const contentQualityScore = scoreContent(inputs);
  const accessibilityScore = scoreAccessibility(inputs);
  const seoScore = scoreSeo(inputs);
  let uxMaturityScore = (iaHealthScore + contentQualityScore + accessibilityScore + seoScore) / 4;
  if (inputs.conversionBlockers > 0) uxMaturityScore = Math.min(uxMaturityScore, 68);
  uxMaturityScore = Math.round(uxMaturityScore * 10) / 10;
  return {
    iaHealthScore,
    contentQualityScore,
    accessibilityScore,
    seoScore,
    uxMaturityScore,
    uxMaturityBand: band(uxMaturityScore),
  };
}
