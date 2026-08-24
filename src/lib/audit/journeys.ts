import type { CrawledPage, JourneyResult, JourneyStageResult } from "./types";

type StageDef = { id: string; name: string; description: string; path: RegExp; title?: RegExp; exclude?: RegExp };
type JourneyDef = { id: string; name: string; description: string; stages: StageDef[] };

const JOURNEYS: JourneyDef[] = [
  {
    id: "prospective_customer",
    name: "Prospective patient / customer",
    description: "A new visitor deciding whether to book or buy — awareness through conversion.",
    stages: [
      { id: "awareness", name: "Awareness", description: "Informational / news content.", path: /\/(news|media|blog|insights|health-knowledge)(\/|$|\.html)/i },
      { id: "consideration", name: "Consideration", description: "Services, specialities, packages.", path: /\/(services|specialit|packages|about)(\/|$|\.html)/i, exclude: /media-and-news/i },
      { id: "decision", name: "Decision", description: "Pricing, offers, insurance.", path: /\/(pricing|plans|special-offers|health-insurance|insurance)(\/|$|\.html)/i },
      { id: "action", name: "Action / Conversion", description: "Booking, contact, checkout.", path: /\/(book|booking|contact|checkout|register)(\/|$|\.html)/i },
    ],
  },
  {
    id: "find_care",
    name: "Find care (healthcare)",
    description: "The jobs most hospital visitors actually have: doctor, appointment, emergency, insurance.",
    stages: [
      { id: "find_doctor", name: "Find a doctor", description: "Directory with filters.", path: /find-a-doctor|\/doctors(\/|$|\.html)/i },
      { id: "book", name: "Book appointment", description: "Working booking flow.", path: /book-an-appointment|\/booking/i },
      { id: "emergency", name: "Emergency", description: "ER / urgent care.", path: /\/emergency(\/|$|\.html)/i },
      { id: "insurance", name: "Insurance", description: "Coverage / network.", path: /\/(health-insurance|insurance)(\/|$|\.html)/i },
    ],
  },
  {
    id: "job_seeker",
    name: "Job seeker",
    description: "Someone evaluating the organisation as an employer.",
    stages: [
      { id: "discover_careers", name: "Discover careers", description: "Careers landing.", path: /\/(careers?|working-with-mediclinic|working-at|jobs-and-careers)(\/|$|\.html)/i },
      { id: "browse_openings", name: "Browse openings", description: "Actual listings — not a news headline containing 'opening'.", path: /\/(vacancies|job-listing|openings|jobs\/)(\/|$)/i, exclude: /media|news|acute-medical-unit/i },
      { id: "apply", name: "Apply", description: "Application form or ATS.", path: /\/(apply|application|full-time-doctor|independent-doctor)(\/|$|\.html)/i },
    ],
  },
  {
    id: "existing_customer",
    name: "Existing customer / support",
    description: "Returning patients who need to sign in or get help.",
    stages: [
      { id: "sign_in", name: "Sign in", description: "Portal / account login.", path: /\/(patient-portal|login|signin|uae-pass)(\/|$|\.html)/i },
      { id: "self_service", name: "Self-service help", description: "FAQ or app help.", path: /\/(faq|help-center|mediclinic-app-faq)(\/|$|\.html)/i },
      { id: "contact_support", name: "Contact support", description: "Dedicated support, not a clinical 'support group'.", path: /\/(contact-us|contact)(\/|$|\.html)/i, exclude: /oncology\/support/i },
    ],
  },
  {
    id: "press_investor",
    name: "Press / investor",
    description: "Journalists and analysts researching the organisation.",
    stages: [
      { id: "company_info", name: "Company info", description: "About, leadership, history.", path: /\/(about|history|management|vision-and-values)(\/|$|\.html)/i, exclude: /stay\/feedback/i },
      { id: "news_press", name: "News & press", description: "Press room.", path: /\/(media-and-news|press-releases|newsroom|media-kit)(\/|$|\.html)/i },
      { id: "investor_relations", name: "Investor relations", description: "IR pages — not product pages that happen to include the word.", path: /\/(investor|shareholder|financial-report|\/ir\/)/i, exclude: /laser-hair|clinic|hospital/i },
      { id: "media_contact", name: "Media contact", description: "Press contact or media kit.", path: /\/(media-kit|media-contact|press-contact)(\/|$|\.html)/i },
    ],
  },
];

function matchStage(page: CrawledPage, stage: StageDef): "strong" | "weak" | "none" {
  if (page.statusCode && page.statusCode >= 400) return "none";
  if (stage.exclude && stage.exclude.test(page.url)) return "none";
  if (stage.path.test(page.url)) return "strong";
  if (stage.title && page.title && stage.title.test(page.title) && !stage.exclude?.test(page.url)) return "weak";
  return "none";
}

export function buildJourneyMap(pages: CrawledPage[]): JourneyResult[] {
  return JOURNEYS.map((j) => {
    const stages: JourneyStageResult[] = j.stages.map((stage) => {
      const strong = pages.filter((p) => matchStage(p, stage) === "strong");
      const weak = pages.filter((p) => matchStage(p, stage) === "weak");
      const pool = strong.length ? strong : weak;
      if (!pool.length) {
        return {
          id: stage.id,
          name: stage.name,
          description: stage.description,
          present: false,
          pageCount: 0,
          exampleUrl: null,
          exampleTitle: null,
          clickDepth: null,
          confidence: "none",
        };
      }
      const best = pool.reduce((a, b) => (a.depth <= b.depth ? a : b));
      return {
        id: stage.id,
        name: stage.name,
        description: stage.description,
        present: true,
        pageCount: pool.length,
        exampleUrl: best.url,
        exampleTitle: best.title,
        clickDepth: best.depth,
        confidence: strong.length ? "strong" : "weak",
        note: strong.length ? undefined : "Title-only match — confirm this is actually the right page.",
      };
    });
    const present = stages.filter((s) => s.present && s.confidence === "strong").length;
    const missing = stages.filter((s) => !s.present).map((s) => s.name);
    const notes: string[] = [];
    if (present === 0) notes.push("No strong path matches for this journey. It may not apply, or the site uses different URL wording.");
    else if (missing.length) notes.push(`No strong match for: ${missing.join(", ")}.`);
    const weakHits = stages.filter((s) => s.confidence === "weak");
    if (weakHits.length) notes.push(`${weakHits.map((s) => s.name).join(", ")} only matched on title — treated as weak, not as proof the journey exists.`);
    return {
      id: j.id,
      name: j.name,
      description: j.description,
      stages,
      stagesPresent: present,
      stagesTotal: j.stages.length,
      notes,
    };
  });
}
