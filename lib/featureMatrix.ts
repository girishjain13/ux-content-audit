import * as cheerio from "cheerio";
import { detectForms } from "./formDetection";
import { KNOWN_GLOBALS } from "./knownGlobals";

/**
 * Crawl-unique Feature Matrix.
 *
 * Instead of scoring every site against a fixed checklist (many of which
 * will always be "No"), this builds a capability inventory from what the
 * crawl actually observed: URL structure, forms, media, widgets, nav
 * destinations, and live globals. Only capabilities with evidence are
 * returned — so each report's matrix is unique to that site.
 */

export type FeatureResult = {
  feature: string;
  detected: boolean;
  pagesFoundOn: number;
  /** Optional evidence: how it was inferred + up to a few sample URLs */
  evidence?: string;
  sampleUrls?: string[];
};

const CHAT_WIDGET_DOMAINS = [
  "intercom.io",
  "intercomcdn",
  "drift.com",
  "zdassets.com",
  "livechatinc.com",
  "tawk.to",
  "hubspot.com/conversations",
];
const CHAT_SUPPORT_GLOBALS = new Set(
  KNOWN_GLOBALS.filter((g) => g.category === "Chat / Support").map((g) => g.globalVar),
);
const VIDEO_HOSTING_DOMAINS = [
  "vimeo.com",
  "youtube.com",
  "youtube-nocookie.com",
  "wistia.com",
  "brightcove.com",
  "vidyard.com",
  "player.vimeo.com",
];

/** Named capability detectors — only emitted when evidence is found. */
const NAMED_URL_CAPABILITIES: { feature: string; pattern: RegExp }[] = [
  { feature: "Blog / Articles", pattern: /\/(blogs?|articles?|insights|news)(\/|$)/i },
  { feature: "FAQ / Help Center", pattern: /\/(faqs?|help|support)(\/|$)/i },
  { feature: "Pricing / Plans", pattern: /\/(pricing|plans)(\/|$)/i },
  { feature: "Careers / Jobs", pattern: /\/(careers?|jobs)(\/|$)/i },
  { feature: "E-commerce (cart / checkout)", pattern: /\/(cart|checkout|shop|basket)(\/|$)/i },
  {
    feature: "Locations / Facilities",
    pattern:
      /\/(locations?|branches|stores?|find-us|near-me|hospitals?|clinics?|facilities|find-a-hospital|find-a-clinic|find-a-doctor)(\/|$)/i,
  },
  {
    feature: "User Login / Account",
    pattern: /\/(portal|login|sign-?in|my-?account|patient-?portal|patient-?login)(\/|$)/i,
  },
  {
    feature: "Book / Appointment",
    pattern: /\/(book|booking|appointment|schedule|request-appointment)(\/|$)/i,
  },
  { feature: "Media / Press", pattern: /\/(media-?contact|press|media-?kit|newsroom)(\/|$)/i },
  { feature: "Doctors / Specialists directory", pattern: /\/(doctors?|specialists?|physicians?|find-a-doctor)(\/|$)/i },
  { feature: "Services / Specialities", pattern: /\/(services?|specialit(?:y|ies)|departments?)(\/|$)/i },
  { feature: "Patient information", pattern: /\/(patients?|visitors?|patient-info|visitor-info)(\/|$)/i },
  { feature: "Insurance / Payment", pattern: /\/(insurance|pay|payment|billing|claims?)(\/|$)/i },
  { feature: "Emergency / Urgent care", pattern: /\/(emergency|urgent-?care|a-?e|er)(\/|$)/i },
];

const EXTERNAL_CAREERS_PATTERN =
  /careers\.|\/careers(\/|$)|greenhouse\.io|lever\.co|myworkdayjobs\.com|smartrecruiters\.com|icims\.com|jobs\.lever\.co/i;

/** Path segments that are too generic to treat as a capability. */
const GENERIC_SEGMENTS = new Set([
  "",
  "en",
  "ar",
  "fr",
  "de",
  "es",
  "www",
  "index",
  "home",
  "page",
  "pages",
  "html",
  "htm",
  "default",
  "content",
  "assets",
  "static",
  "api",
  "wp-content",
  "wp-admin",
  "wp-json",
  "cdn",
  "img",
  "images",
  "css",
  "js",
  "fonts",
  "node_modules",
]);

type Accumulator = {
  count: number;
  urls: string[];
  evidence: Set<string>;
};

function bump(map: Map<string, Accumulator>, feature: string, url: string, evidence: string) {
  let entry = map.get(feature);
  if (!entry) {
    entry = { count: 0, urls: [], evidence: new Set() };
    map.set(feature, entry);
  }
  entry.count += 1;
  entry.evidence.add(evidence);
  if (entry.urls.length < 5 && !entry.urls.includes(url)) {
    entry.urls.push(url);
  }
}

/**
 * Turn a URL path into candidate capability labels unique to this site.
 * e.g. /en/specialities/cardiology → "Specialities", "Cardiology"
 * Only first meaningful segments are kept to avoid noise.
 */
function pathCapabilityLabels(url: string): string[] {
  try {
    const u = new URL(url);
    const parts = u.pathname
      .split("/")
      .map((p) => decodeURIComponent(p).trim())
      .filter(Boolean)
      .filter((p) => !GENERIC_SEGMENTS.has(p.toLowerCase()))
      .filter((p) => !/^\d+$/.test(p))
      .filter((p) => p.length > 1 && p.length < 40);
    // Keep up to 2 top-level meaningful segments as site-unique areas
    return parts.slice(0, 2).map((p) => {
      const cleaned = p.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
      // Title-case
      return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
    });
  } catch {
    return [];
  }
}

export function detectFeaturesAcrossSite(
  pages: {
    url: string;
    renderedDomHtml: string | null;
    hasMultipleLocales: boolean;
    internalLinks?: string[];
    externalLinks?: string[];
    detectedGlobals?: string[];
    externalScriptDomains?: string[];
    hasBookingIframe?: boolean;
    hasChatWidget?: boolean;
    cookieWallPresent?: boolean;
  }[],
): FeatureResult[] {
  const found = new Map<string, Accumulator>();
  let multilingualPages = 0;

  for (const p of pages) {
    // --- Named capability matches from this page's URL ---
    for (const { feature, pattern } of NAMED_URL_CAPABILITIES) {
      if (pattern.test(p.url)) bump(found, feature, p.url, "URL path match");
    }

    // --- Site-unique path areas (not in the named list) ---
    for (const label of pathCapabilityLabels(p.url)) {
      // Avoid duplicating something we already named more specifically
      const alreadyNamed = [...found.keys()].some(
        (k) => k.toLowerCase().includes(label.toLowerCase()) || label.toLowerCase().includes(k.toLowerCase().split(" / ")[0]),
      );
      if (!alreadyNamed && label.length >= 3) {
        bump(found, `Site area: ${label}`, p.url, "Top-level path segment on this crawl");
      }
    }

    if (p.hasMultipleLocales) multilingualPages += 1;

    const allLinks = [...(p.internalLinks ?? []), ...(p.externalLinks ?? [])];
    if (allLinks.some((l) => EXTERNAL_CAREERS_PATTERN.test(l))) {
      bump(found, "Careers / Jobs", p.url, "Outbound careers / ATS link");
    }
    if (allLinks.some((l) => /\/(portal|login|sign-?in|my-?account|patient-?portal|uae-?pass)(\/|$)/i.test(l))) {
      bump(found, "User Login / Account", p.url, "Outbound login / portal link");
    }
    if (allLinks.some((l) => /\/(book|appointment|schedule)(\/|$)/i.test(l))) {
      bump(found, "Book / Appointment", p.url, "Outbound booking link");
    }

    if ((p.detectedGlobals ?? []).some((g) => CHAT_SUPPORT_GLOBALS.has(g))) {
      bump(found, "Live Chat Widget", p.url, "Live chat global initialized");
    }
    if (p.hasChatWidget) {
      bump(found, "Live Chat Widget", p.url, "Chat widget DOM signal");
    }
    if (p.hasBookingIframe) {
      bump(found, "Book / Appointment (iframe)", p.url, "Booking iframe detected");
    }
    if (p.cookieWallPresent) {
      bump(found, "Cookie / consent banner", p.url, "Consent UI present on page");
    }

    if ((p.externalScriptDomains ?? []).some((d) => VIDEO_HOSTING_DOMAINS.some((v) => d.includes(v)))) {
      bump(found, "Video Content", p.url, "Video host script domain");
    }

    if (!p.renderedDomHtml) continue;
    const html = p.renderedDomHtml;
    const $ = cheerio.load(html);

    for (const form of detectForms(html)) {
      if (form.likelyPurpose === "search") bump(found, "Site Search", p.url, "Search form");
      if (form.likelyPurpose === "login") bump(found, "User Login / Account", p.url, "Login form");
      if (form.likelyPurpose === "newsletter") bump(found, "Newsletter Signup", p.url, "Newsletter form");
      if (form.likelyPurpose === "contact") bump(found, "Contact Form", p.url, "Contact form");
    }

    const formsText = $("form")
      .toArray()
      .map((f) => `${$(f).attr("action") ?? ""} ${$(f).attr("class") ?? ""} ${$(f).attr("id") ?? ""}`)
      .join(" ")
      .toLowerCase();
    if (/regist|sign-?up|create-?account/.test(formsText) || /regist|sign-?up|create-?account/i.test(p.url)) {
      bump(found, "User Registration / Signup", p.url, "Registration form / URL");
    }

    if ($("video, iframe[src*='youtube'], iframe[src*='vimeo']").length > 0) {
      bump(found, "Video Content", p.url, "Video / embed in DOM");
    }

    const bodyText = $("body").text().toLowerCase();
    if (/testimonial|customer review|what our (customers|clients) say|patient stor/.test(bodyText)) {
      bump(found, "Testimonials / Reviews", p.url, "Testimonial copy on page");
    }

    if ($("a[href$='.pdf'], a[href$='.doc'], a[href$='.docx'], a[href$='.xls'], a[href$='.xlsx']").length > 0) {
      bump(found, "Downloadable Resources", p.url, "Document download links");
    }

    $("script[src]").each((_, el) => {
      const src = $(el).attr("src") ?? "";
      if (CHAT_WIDGET_DOMAINS.some((d) => src.includes(d))) {
        bump(found, "Live Chat Widget", p.url, "Chat script src");
      }
    });

    // Interactive UI patterns present on this page
    if ($('[role="dialog"], .modal').length) bump(found, "Modal dialogs", p.url, "Dialog / modal markup");
    if ($('[aria-expanded], .accordion').length) bump(found, "Accordions / expandable sections", p.url, "Accordion markup");
    if ($('.carousel, .slider, [class*="carousel"]').length) {
      bump(found, "Carousel / slider", p.url, "Carousel markup");
    }
    if ($('[role="tablist"], .tabs').length) bump(found, "Tabs", p.url, "Tablist markup");
  }

  if (multilingualPages > 0) {
    const entry: Accumulator = {
      count: multilingualPages,
      urls: pages.filter((p) => p.hasMultipleLocales).slice(0, 5).map((p) => p.url),
      evidence: new Set(["hreflang / locale signals"]),
    };
    found.set("Multi-language Support", entry);
  }

  // Only return capabilities that were actually observed on this crawl
  const results: FeatureResult[] = [...found.entries()]
    .map(([feature, acc]) => ({
      feature,
      detected: true,
      pagesFoundOn: acc.count,
      evidence: [...acc.evidence].join("; "),
      sampleUrls: acc.urls,
    }))
    .sort((a, b) => b.pagesFoundOn - a.pagesFoundOn || a.feature.localeCompare(b.feature));

  return results;
}
