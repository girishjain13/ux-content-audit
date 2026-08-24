import type { Scorecard } from "./scoring";

/**
 * Deliberately NOT an LLM call — per an explicit decision earlier in
 * this project to keep audit generation rule-based rather than
 * AI-judgment-based. These read like prose because they're built from
 * template sentences filled in with real numbers, in the same spirit as
 * a mail-merge — not because anything here is inferring or reasoning
 * about the site. The optional AI executive summary in lib/aiInsights.ts
 * is the one place actual model-generated text exists, and it's
 * clearly separate and off by default.
 */

export type NarrativeInputs = {
  scorecard: Scorecard;
  totalPages: number;
  orphanPageCount: number;
  brokenLinkCount: number;
  missingH1Count: number;
  missingTitleCount: number;
  missingMetaDescriptionCount: number;
  accessibilityIssuePages: number;
  duplicateContentCount: number;
  thinContentCount: number;
  maxClickDepth: number;
  /** Consent banner still visible after dismissal attempts. */
  stickyCookieWallCount: number;
  /** Any cookie/consent banner detected (dismissed or not). */
  cookieWallPageCount: number;
  /** Pages where booking/appointment lives inside an iframe. */
  bookingIframePageCount: number;
  /** Pages with a live chat / messaging widget. */
  chatWidgetPageCount: number;
};

const PILLAR_LABELS: Record<string, string> = {
  iaHealthScore: "Information Architecture",
  contentQualityScore: "Content Quality",
  accessibilityScore: "Accessibility",
  seoScore: "SEO & Findability",
};

function strongestAndWeakestPillar(scorecard: Scorecard): { strongest: string; weakest: string } {
  const pillars: [string, number][] = [
    ["iaHealthScore", scorecard.iaHealthScore],
    ["contentQualityScore", scorecard.contentQualityScore],
    ["accessibilityScore", scorecard.accessibilityScore],
    ["seoScore", scorecard.seoScore],
  ];
  pillars.sort((a, b) => b[1] - a[1]);
  return { strongest: PILLAR_LABELS[pillars[0][0]], weakest: PILLAR_LABELS[pillars[pillars.length - 1][0]] };
}

function maturityAdjective(score: number): string {
  if (score >= 85) return "strong";
  if (score >= 70) return "solid, if uneven,";
  if (score >= 50) return "inconsistent";
  return "in need of foundational work";
}

export function generateInPlainTerms(input: NarrativeInputs): string[] {
  const bullets: string[] = [];
  bullets.push(
    `Overall UX maturity scores ${input.scorecard.uxMaturityScore}/100 (${input.scorecard.uxMaturityBand}), based on ${input.totalPages} crawled pages.`,
  );
  // Conversion / JS gates first — highest leverage for real users
  if (input.stickyCookieWallCount > 0) {
    bullets.push(
      `${input.stickyCookieWallCount} page(s) still showed a cookie/consent wall after dismissal attempts — this can hide primary CTAs and distort content metrics.`,
    );
  }
  if (input.bookingIframePageCount > 0) {
    bullets.push(
      `Appointment booking appears inside an iframe on ${input.bookingIframePageCount} page(s) — a common healthcare pattern that limits accessibility scanning and analytics fidelity.`,
    );
  }
  if (input.orphanPageCount > 0) {
    bullets.push(`${input.orphanPageCount} page(s) have no internal links pointing to them — effectively invisible to normal site navigation.`);
  }
  if (input.thinContentCount > 0) {
    bullets.push(`${input.thinContentCount} page(s) have under 150 words — thin enough to raise both content-quality and SEO concerns.`);
  }
  if (input.duplicateContentCount > 0) {
    bullets.push(`${input.duplicateContentCount} page(s) are exact or near-duplicates of other pages on the site.`);
  }
  if (input.accessibilityIssuePages > 0) {
    bullets.push(
      `Automated accessibility scanning flagged issues on ${input.accessibilityIssuePages} of ${input.totalPages} pages — a starting point for a WCAG review, not a full compliance audit.`,
    );
  } else {
    bullets.push("No automated accessibility violations were detected — a good sign, though this covers only what a scanner can check, not a full manual WCAG review.");
  }
  if (input.brokenLinkCount > 0) {
    bullets.push(`${input.brokenLinkCount} page(s) returned an error status during the crawl.`);
  }
  return bullets;
}

export function generateUxLeadAssessment(input: NarrativeInputs): string[] {
  const { strongest, weakest } = strongestAndWeakestPillar(input.scorecard);
  const paragraphs: string[] = [];

  paragraphs.push(
    `This site's UX maturity comes in at ${input.scorecard.uxMaturityScore} out of 100 — ${maturityAdjective(input.scorecard.uxMaturityScore)} ` +
      `overall. ${strongest} is the strongest of the four pillars measured here; ${weakest} is the one that would benefit most from ` +
      `attention next. That gap is usually the fastest place to look for quick, high-leverage wins.`,
  );

  // Conversion / JS gates — surface before structural notes
  const conversionSentences: string[] = [];
  if (input.stickyCookieWallCount > 0) {
    conversionSentences.push(
      `A consent banner remained after automated dismissal on ${input.stickyCookieWallCount} page(s). ` +
        `For real visitors that often means an extra interaction before they can see “Book appointment” or “Find a doctor” — treat it as a conversion friction item, not only a crawl artifact.`,
    );
  } else if (input.cookieWallPageCount > 0) {
    conversionSentences.push(
      `A consent banner was detected on ${input.cookieWallPageCount} page(s) and successfully cleared during the crawl. ` +
        `Confirm it does not delay or cover primary CTAs on first paint.`,
    );
  }
  if (input.bookingIframePageCount > 0) {
    conversionSentences.push(
      `Booking is iframe-hosted on ${input.bookingIframePageCount} page(s). That is normal for many hospital groups, ` +
        `but it means axe-core cannot fully audit the flow and attribution can break when third-party cookies are restricted.`,
    );
  }
  if (conversionSentences.length) {
    paragraphs.push(`On conversion paths: ${conversionSentences.join(" ")}`);
  }

  const iaSentences: string[] = [];
  if (input.orphanPageCount > 0) {
    iaSentences.push(
      `${input.orphanPageCount} orphan page(s) exist with zero inbound internal links — content that's technically live but ` +
        "practically unreachable through normal browsing, which is worth checking against analytics before assuming it's safe to leave as-is.",
    );
  }
  if (input.maxClickDepth > 3) {
    iaSentences.push(
      `The deepest page found sits ${input.maxClickDepth} clicks from the homepage — beyond the usual 3-click guideline for ` +
        "primary content, which tends to correlate with lower discoverability and engagement.",
    );
  }
  if (iaSentences.length) {
    paragraphs.push(`On structure: ${iaSentences.join(" ")}`);
  }

  const contentSentences: string[] = [];
  if (input.missingH1Count > 0) {
    contentSentences.push(`${input.missingH1Count} page(s) are missing an H1 heading entirely.`);
  }
  if (input.thinContentCount > 0) {
    contentSentences.push(`${input.thinContentCount} page(s) read as thin content (under 150 words).`);
  }
  if (input.duplicateContentCount > 0) {
    contentSentences.push(`${input.duplicateContentCount} page(s) substantially duplicate content found elsewhere on the site.`);
  }
  if (contentSentences.length) {
    paragraphs.push(`On content quality: ${contentSentences.join(" ")}`);
  } else {
    paragraphs.push("Content quality checks came back clean — no heading, thin-content, or duplication issues detected in this crawl.");
  }

  if (input.accessibilityIssuePages > 0) {
    paragraphs.push(
      `On accessibility: automated scanning surfaced issues on ${input.accessibilityIssuePages} of ${input.totalPages} pages. ` +
        "This is a floor, not a ceiling — automated tools like axe-core catch roughly a third of real WCAG issues, so treat this as a starting checklist rather than a clearance.",
    );
  } else {
    paragraphs.push(
      "On accessibility: no automated violations were flagged. Worth stress-testing that finding with real keyboard/screen-reader " +
        "walkthroughs before calling it clean, since automated scanners only catch a subset of real accessibility problems.",
    );
  }

  const seoSentences: string[] = [];
  if (input.missingTitleCount > 0) seoSentences.push(`${input.missingTitleCount} page(s) are missing a title tag.`);
  if (input.missingMetaDescriptionCount > 0) seoSentences.push(`${input.missingMetaDescriptionCount} page(s) are missing a meta description.`);
  if (seoSentences.length) {
    paragraphs.push(`On findability: ${seoSentences.join(" ")}`);
  }

  // Priority: sticky cookie wall > booking iframe > a11y > thin content > orphans
  const nextStep =
    input.stickyCookieWallCount > 0
      ? "clearing the sticky cookie/consent wall so primary CTAs are immediately usable"
      : input.bookingIframePageCount > 0
        ? "validating the iframe booking flow for load reliability, keyboard access, and analytics"
        : input.accessibilityIssuePages > 0
          ? "working through the automated accessibility findings"
          : input.thinContentCount > 0
            ? "addressing the thin-content pages"
            : input.orphanPageCount > 0
              ? `resolving the ${input.orphanPageCount} orphan page(s)`
              : "reviewing the full findings list for the next round of polish";
  paragraphs.push(`Where to start next sprint: ${nextStep} — the highest-leverage, most concretely actionable item in this audit.`);

  return paragraphs;
}
