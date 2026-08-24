import type { Finding, Scorecard } from "./types";

const PILLAR: Record<string, string> = {
  iaHealthScore: "Information Architecture",
  contentQualityScore: "Content Quality",
  accessibilityScore: "Accessibility",
  seoScore: "SEO / Findability",
};

function strongestWeakest(scorecard: Scorecard) {
  const pillars: [string, number][] = [
    ["iaHealthScore", scorecard.iaHealthScore],
    ["contentQualityScore", scorecard.contentQualityScore],
    ["accessibilityScore", scorecard.accessibilityScore],
    ["seoScore", scorecard.seoScore],
  ];
  pillars.sort((a, b) => b[1] - a[1]);
  return { strongest: PILLAR[pillars[0][0]], weakest: PILLAR[pillars[pillars.length - 1][0]] };
}

export function generateInPlainTerms(opts: {
  scorecard: Scorecard;
  totalPages: number;
  findings: Finding[];
  cookieGatedPages: number;
  truncated: boolean;
}): string[] {
  const bullets: string[] = [];
  bullets.push(
    `Overall UX maturity scores ${opts.scorecard.uxMaturityScore}/100 (${opts.scorecard.uxMaturityBand}) from ${opts.totalPages} rendered pages.`,
  );
  if (opts.truncated) {
    bullets.push("The crawl hit its page cap — treat IA completeness as a sample, not a census.");
  }
  const p0 = opts.findings.filter((f) => f.sprintPriority === "P0");
  if (p0.length) {
    bullets.push(`${p0.length} P0 issue(s) sit on a conversion or access path (cookie wall, duplicate chrome, language, booking).`);
  }
  if (opts.cookieGatedPages > 0) {
    bullets.push(`${opts.cookieGatedPages} page(s) hide primary content behind a cookie / CMP gate — including, on some sites, the booking widget.`);
  }
  const a11y = opts.findings.find((f) => f.findingType === "accessibility_summary");
  if (a11y) bullets.push(a11y.title + " Automated axe is a floor, not a WCAG clearance.");
  return bullets;
}

export function generateUxLeadAssessment(opts: {
  scorecard: Scorecard;
  findings: Finding[];
  totalPages: number;
}): string[] {
  const { strongest, weakest } = strongestWeakest(opts.scorecard);
  const p0 = opts.findings.filter((f) => f.sprintPriority === "P0");
  const paragraphs: string[] = [];
  paragraphs.push(
    `This site lands at ${opts.scorecard.uxMaturityScore}/100 — ${opts.scorecard.uxMaturityBand.toLowerCase()}. ${strongest} is the strongest of the four crawlable pillars; ${weakest} is the weakest. Scores are directional. They are not a substitute for task-based testing.`,
  );
  if (p0.length) {
    paragraphs.push(
      `Start with conversion and access, not orphans. The highest-leverage items in this run: ${p0.map((f) => f.title.replace(/\.$/, "")).slice(0, 3).join("; ")}.`,
    );
  } else {
    paragraphs.push("No P0 conversion blockers were detected in this sample. Next, work through P1 findings in severity order — duplicate titles, thin templates, and assistive-tech issues.");
  }
  paragraphs.push(
    "A crawl still cannot watch a form submit, a slot picker, or a screen reader. Treat H1/H3/H5/H7 as unassessed unless a human walked the flow.",
  );
  return paragraphs;
}

export function nextSprintFromFindings(findings: Finding[]): string[] {
  const ordered = [...findings].sort((a, b) => {
    const p = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const s = { critical: 0, high: 1, medium: 2, low: 3 };
    return p[a.sprintPriority] - p[b.sprintPriority] || s[a.severity] - s[b.severity];
  });
  const steps = ordered.slice(0, 6).map((f, i) => `${i + 1}. [${f.sprintPriority}] ${f.title}`);
  if (!steps.length) return ["No blocking findings in this sample. Re-run with a higher page cap and walk booking / search by hand."];
  return steps;
}
