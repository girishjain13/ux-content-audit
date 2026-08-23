/**
 * Direct port of the reference's analyzers/journey.py. Same honesty
 * note as the source, worth repeating: none of this is real behavioral
 * data. A crawler has no access to analytics, session recordings, or
 * task-completion rates. This is an inference — where the site's
 * structure most likely puts each stage of a goal-driven visit for a
 * given persona, and how discoverable (click depth) that stage is.
 * Treat it as "what the structure suggests," worth validating against
 * real analytics, not a replacement for that data.
 */

export type JourneyStageDef = {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  /**
   * Keywords that disqualify an otherwise-matching page. Added to fix a
   * real, confirmed bug: plain substring matching had zero domain
   * scoping, so "service" (a Consideration-stage keyword) matched
   * "investor-services" — an investor-relations contact page — for the
   * Prospective Customer journey. A page matching a positive keyword
   * but also containing an exclude keyword is treated as not matching
   * this stage at all.
   */
  excludeKeywords?: string[];
  /** If set, a page must fall under one of these URL path prefixes to
   * be eligible for this stage at all, checked before keyword matching.
   * Scopes a persona's journey to the site sections it actually
   * belongs in (e.g. a "Prospective Customer" journey shouldn't ever
   * resolve to a page under /investors/, regardless of what words
   * happen to appear in its title). */
  restrictToPathPrefixes?: string[];
};
export type JourneyDef = { id: string; name: string; description: string; stages: JourneyStageDef[] };

export const JOURNEYS: JourneyDef[] = [
  {
    id: "prospective_customer",
    name: "Prospective Customer",
    description: "A new visitor evaluating whether to become a customer — the classic top-of-funnel to conversion path.",
    stages: [
      { id: "awareness", name: "Awareness", description: "Content someone finds before they know your product/company — top-of-funnel, informational.", keywords: ["blog", "article", "insight", "guide", "resource", "news", "learn"], excludeKeywords: ["investor", "shareholder"] },
      { id: "consideration", name: "Consideration", description: "Pages that help someone evaluate fit — services, products, case studies.", keywords: ["about", "service", "product", "feature", "solution", "case-study", "case_study", "portfolio", "work"], excludeKeywords: ["investor", "shareholder", "press-release", "media-centre"] },
      { id: "decision", name: "Decision", description: "Pages aimed at someone close to choosing — pricing, plans, demos, comparisons.", keywords: ["pricing", "plans", "demo", "trial", "quote", "compare", "vs"], excludeKeywords: ["investor", "shareholder"] },
      { id: "action", name: "Action / Conversion", description: "Where the actual conversion happens — signup, checkout, booking, contact.", keywords: ["signup", "sign-up", "register", "checkout", "cart", "book", "apply", "contact", "buy", "shop"], excludeKeywords: ["investor", "media-contact", "press-contact"] },
    ],
  },
  {
    id: "job_seeker",
    name: "Job Seeker",
    description: "Someone evaluating the company as a potential employer and trying to apply.",
    stages: [
      { id: "discover_careers", name: "Discover Careers", description: "The landing point for anyone checking whether the company is hiring at all.", keywords: ["careers", "jobs", "join-us", "join_us", "work-with-us", "we-are-hiring"] },
      { id: "browse_openings", name: "Browse Openings", description: "Actual job listings — specific open positions, not just a generic careers page.", keywords: ["position", "opening", "vacancy", "job-listing", "job_listing", "openings"], excludeKeywords: ["ward opening", "unit opening", "department opening", "clinic opening", "new opening"] },
      { id: "apply", name: "Apply", description: "Where someone actually submits an application.", keywords: ["apply", "application", "submit-resume", "submit_resume"] },
    ],
  },
  {
    id: "existing_customer",
    name: "Existing Customer / Support",
    description: "Someone who already has a relationship with the company and needs to sign in, self-serve, or get help.",
    stages: [
      { id: "sign_in", name: "Sign In", description: "Where a returning user authenticates.", keywords: ["login", "signin", "sign-in", "account", "my-account", "my_account"] },
      { id: "self_service", name: "Self-Service Help", description: "Documentation, FAQs, or a knowledge base someone can use without contacting a human.", keywords: ["faq", "help", "docs", "documentation", "knowledge-base", "knowledgebase", "kb"] },
      { id: "contact_support", name: "Contact Support", description: "Where someone goes when self-service isn't enough and they need a real person.", keywords: ["support", "help-desk", "helpdesk", "ticket", "contact-support"] },
    ],
  },
  {
    id: "press_investor",
    name: "Press / Investor",
    description: "Journalists, analysts, or investors researching the company rather than its product.",
    stages: [
      { id: "company_info", name: "Company Info", description: "Background on who the company is — leadership, mission, history.", keywords: ["about", "company", "who-we-are", "leadership", "our-team", "our_team"] },
      { id: "news_press", name: "News & Press", description: "Press releases, media coverage, or company announcements.", keywords: ["press", "media", "newsroom", "press-release", "press_release", "announcement"] },
      {
        id: "investor_relations",
        name: "Investor Relations",
        description: "Financial reports, shareholder information — relevant only to publicly-relevant or funded companies.",
        keywords: ["investor", "investors", "shareholder", "financial-report", "financial_report", "/ir/", "ir-"],
        // Restricting to an actual /investors/ (or /corporate/) path
        // prefix, rather than relying on keyword matching alone, is
        // what prevents an unrelated page that happens to mention
        // "growth" or "capital" in a clinical/product context from
        // ever being eligible for this stage in the first place.
        restrictToPathPrefixes: ["/investors", "/investor", "/corporate/investor", "/ir"],
      },
      { id: "media_contact", name: "Media Contact", description: "A dedicated way for press/investors to reach out, distinct from general customer contact.", keywords: ["media-contact", "media_contact", "press-contact", "press_contact"] },
    ],
  },
];

function matchesStage(url: string, title: string | null, stage: JourneyStageDef): boolean {
  if (stage.restrictToPathPrefixes?.length) {
    let path = "";
    try {
      path = new URL(url).pathname.toLowerCase();
    } catch {
      return false;
    }
    if (!stage.restrictToPathPrefixes.some((prefix) => path.startsWith(prefix.toLowerCase()))) return false;
  }
  const haystack = `${url} ${title ?? ""}`.toLowerCase();
  if (stage.excludeKeywords?.some((kw) => haystack.includes(kw.toLowerCase()))) return false;
  return stage.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

export type JourneyStageResult = {
  id: string;
  name: string;
  description: string;
  present: boolean;
  pageCount: number;
  exampleUrl: string | null;
  exampleTitle?: string | null;
  clickDepth: number | null;
};

export type JourneyResult = {
  id: string;
  name: string;
  description: string;
  stages: JourneyStageResult[];
  stagesPresent: number;
  stagesTotal: number;
  notes: string[];
};

function buildSingleJourney(
  journeyDef: JourneyDef,
  pages: { url: string; title: string | null; statusCode: number | null; depth: number }[],
): JourneyResult {
  const stagesOut: JourneyStageResult[] = journeyDef.stages.map((stage) => {
    const matches = pages.filter(
      (p) => p.statusCode !== null && p.statusCode < 400 && matchesStage(p.url, p.title, stage),
    );
    if (!matches.length) {
      return { id: stage.id, name: stage.name, description: stage.description, present: false, pageCount: 0, exampleUrl: null, clickDepth: null };
    }
    const best = matches.reduce((a, b) => (a.depth <= b.depth ? a : b));
    return {
      id: stage.id,
      name: stage.name,
      description: stage.description,
      present: true,
      pageCount: matches.length,
      exampleUrl: best.url,
      exampleTitle: best.title,
      clickDepth: best.depth,
    };
  });

  const presentCount = stagesOut.filter((s) => s.present).length;
  const missing = stagesOut.filter((s) => !s.present).map((s) => s.name);
  const deepStages = stagesOut.filter((s) => s.present && (s.clickDepth ?? 0) > 3);

  const notes: string[] = [];
  if (presentCount === 0) {
    notes.push("No content matched any stage of this journey — it likely isn't a priority for this site, or uses very different wording than the keywords checked here.");
  } else if (missing.length) {
    notes.push(
      `No content matched for: ${missing.join(", ")}. That doesn't necessarily mean it doesn't exist — it may ` +
        "just use different wording — but worth confirming a visitor could actually find it.",
    );
  }
  if (deepStages.length) {
    notes.push(`${deepStages.map((s) => s.name).join(", ")} sit more than 3 clicks from the homepage — a visitor on this journey would need to work to get there.`);
  }
  if (presentCount === journeyDef.stages.length && !deepStages.length) {
    notes.push("Every stage has findable, shallow content — the structure supports this journey well.");
  }

  return {
    id: journeyDef.id,
    name: journeyDef.name,
    description: journeyDef.description,
    stages: stagesOut,
    stagesPresent: presentCount,
    stagesTotal: journeyDef.stages.length,
    notes,
  };
}

export function buildJourneyMap(
  pages: { url: string; title: string | null; statusCode: number | null; depth: number }[],
  customJourneys: JourneyDef[] = [],
): { journeys: JourneyResult[]; journeysWithAnyPresence: number; journeysTotal: number } {
  const all = [...JOURNEYS, ...customJourneys];
  const journeys = all.map((jd) => buildSingleJourney(jd, pages));
  return {
    journeys,
    journeysWithAnyPresence: journeys.filter((j) => j.stagesPresent > 0).length,
    journeysTotal: journeys.length,
  };
}
