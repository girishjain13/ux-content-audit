export type Severity = "critical" | "high" | "medium" | "low";

export type Finding = {
  id: string;
  findingType: string;
  title: string;
  description: string;
  severity: Severity;
  effortBucket: "ootb" | "config" | "custom_dev";
  affectedPageCount: number;
  affectedUrlsSample: string[];
  detectionMethod: string;
  sprintPriority: "P0" | "P1" | "P2" | "P3";
};

export type PageSignals = {
  htmlLang: string | null;
  htmlDir: string | null;
  cookieBannerVisible: boolean;
  cookieGatingCopy: boolean;
  cookieDismissed: boolean;
  iframeSrcs: string[];
  iframeGatedCount: number;
  duplicateNavLabels: string[];
  cmsLeftovers: string[];
  chatWidget: boolean;
  searchPlaceholder: string | null;
  emptyAltCount: number;
  imageCount: number;
  navLabels: string[];
  hydrationWaitedMs: number;
  wordCountBeforeConsent: number;
};

export type CrawledPage = {
  url: string;
  finalUrl: string;
  statusCode: number | null;
  responseTimeMs: number;
  depth: number;
  title: string | null;
  metaDescription: string | null;
  h1Text: string | null;
  canonical: string | null;
  wordCount: number;
  htmlLang: string | null;
  isClientRendered: boolean;
  internalLinks: string[];
  externalLinks: string[];
  accessibilityViolations: {
    id: string;
    impact: string;
    description: string;
    nodesCount: number;
  }[];
  detectedGlobals: string[];
  nonFunctionalHrefs: string[];
  error: string | null;
  signals: PageSignals;
  visibleTextSample: string;
};

export type Scorecard = {
  iaHealthScore: number;
  contentQualityScore: number;
  accessibilityScore: number;
  seoScore: number;
  uxMaturityScore: number;
  uxMaturityBand: "Strong" | "Adequate" | "Needs Improvement" | "Critical";
};

export type FeatureResult = { feature: string; detected: boolean; pagesFoundOn: number; evidence?: string };

export type JourneyStageResult = {
  id: string;
  name: string;
  description: string;
  present: boolean;
  pageCount: number;
  exampleUrl: string | null;
  exampleTitle: string | null;
  clickDepth: number | null;
  confidence: "strong" | "weak" | "none";
  note?: string;
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

export type HeuristicCard = {
  id: string;
  name: string;
  description: string;
  assessed: boolean;
  status: string;
  bullets: string[];
  notAssessedReason?: string;
};

export type CrawlMeta = {
  jsHeavyPages: number;
  cookieBanners: number;
  cookieGatedPages: number;
  cookiesDismissed: number;
  spaHydrationPages: number;
  truncated: boolean;
};

export type AuditReport = {
  id: string;
  startUrl: string;
  host: string;
  crawledAt: string;
  durationSeconds: number;
  pageCount: number;
  pages: Array<Pick<CrawledPage, "url" | "title" | "statusCode" | "depth" | "wordCount" | "h1Text" | "error" | "signals">>;
  scorecard: Scorecard;
  findings: Finding[];
  plainTerms: string[];
  uxLeadAssessment: string[];
  nextSprint: string[];
  heuristics: HeuristicCard[];
  featureMatrix: FeatureResult[];
  journeys: JourneyResult[];
  keywords: { term: string; count: number }[];
  crawlMeta: CrawlMeta;
  orphanPageCount: number;
  thinContentCount: number;
  duplicateTitlePageCount: number;
  missingH1Count: number;
  pagesWithA11yIssues: number;
  maxClickDepth: number;
  avgClickDepth: number;
  isSample?: boolean;
};
