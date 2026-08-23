import * as cheerio from "cheerio";
import { detectForms } from "./formDetection";
import { KNOWN_GLOBALS } from "./knownGlobals";

/**
 * Matches the "Feature Matrix" sheet from the reference export exactly —
 * this is the Business Analyst persona's "evaluate whether expected
 * website functionality appears to be present" requirement. Detection
 * is heuristic (URL patterns, form field composition, known script
 * domains) — a feature genuinely present but named unusually (e.g. a
 * search page at /find-it instead of /search) can be missed. This is a
 * discovery-phase signal, not a definitive functional inventory.
 *
 * Several checks below cross-reference signals ALREADY detected
 * elsewhere in this codebase (live global variables, external script
 * domains) rather than only re-deriving from scratch — fixed after a
 * real manual review caught the exact gap: a report's own Integrations
 * section had already found Vimeo, while the Feature Matrix separately
 * (and wrongly) reported "Video Content: No" on the same crawl, because
 * the two checks never talked to each other.
 */

const URL_PATTERN_FEATURES: { feature: string; pattern: RegExp }[] = [
  { feature: "Blog / Articles", pattern: /\/(blogs?|articles?|insights|news)(\/|$)/i },
  { feature: "FAQ / Help Center", pattern: /\/(faqs?|help|support)(\/|$)/i },
  { feature: "Pricing / Plans", pattern: /\/(pricing|plans)(\/|$)/i },
  { feature: "Careers / Jobs", pattern: /\/(careers?|jobs)(\/|$)/i },
  { feature: "E-commerce (cart / checkout)", pattern: /\/(cart|checkout|shop|basket)(\/|$)/i },
  // Broadened beyond "store/dealer" vocabulary — a real gap found on a
  // healthcare site, where the equivalent feature is "find a hospital
  // or clinic," not a retail-style locator, but is conceptually the
  // exact same "find a physical location" capability.
  { feature: "Store/Office Locations", pattern: /\/(locations?|branches|stores?|find-us|near-me|locate-a-dealer|find-a-dealer|dealer-locator|dealers?|hospitals?|clinics?|facilities|find-a-hospital|find-a-clinic)(\/|$)/i },
  { feature: "User Login / Account", pattern: /\/(portal|login|sign-?in|my-?account|patient-?portal|patient-?login)(\/|$)/i },
  { feature: "Media Contact", pattern: /\/(media-?contact|press-?contact|media-?kit|press-?kit|newsroom)(\/|$)/i },
];

// Career-related destinations that live entirely on a different
// domain (a separate ATS like an external careers subdomain, or a
// third-party applicant-tracking platform) — a real gap: the "Careers"
// feature was previously only detected if a page's OWN url matched,
// missing a working external careers link sitting right in the nav.
const EXTERNAL_CAREERS_PATTERN = /careers\.|\/careers(\/|$)|greenhouse\.io|lever\.co|myworkdayjobs\.com|smartrecruiters\.com|icims\.com|jobs\.lever\.co/i;

const CHAT_WIDGET_DOMAINS = ["intercom.io", "intercomcdn", "drift.com", "zdassets.com", "livechatinc.com", "tawk.to", "hubspot.com/conversations"];
const CHAT_SUPPORT_GLOBALS = new Set(KNOWN_GLOBALS.filter((g) => g.category === "Chat / Support").map((g) => g.globalVar));

const VIDEO_HOSTING_DOMAINS = ["vimeo.com", "youtube.com", "youtube-nocookie.com", "wistia.com", "brightcove.com", "vidyard.com", "player.vimeo.com"];

export type FeatureResult = { feature: string; detected: boolean; pagesFoundOn: number };

export function detectFeaturesAcrossSite(
  pages: {
    url: string;
    renderedDomHtml: string | null;
    hasMultipleLocales: boolean;
    internalLinks?: string[];
    externalLinks?: string[];
    detectedGlobals?: string[];
    externalScriptDomains?: string[];
  }[],
): FeatureResult[] {
  const counts = new Map<string, number>();
  const bump = (feature: string) => counts.set(feature, (counts.get(feature) ?? 0) + 1);

  let anyMultilingual = false;

  for (const p of pages) {
    for (const { feature, pattern } of URL_PATTERN_FEATURES) {
      if (pattern.test(p.url)) bump(feature);
    }
    if (p.hasMultipleLocales) anyMultilingual = true;

    // Cross-reference outbound links (both internal and external) for
    // features that are commonly just a nav link to somewhere else
    // entirely — a working external careers/ATS link, or a portal
    // hosted on a separate subdomain, is still real evidence the
    // feature exists even if we never crawl the destination itself.
    const allLinks = [...(p.internalLinks ?? []), ...(p.externalLinks ?? [])];
    if (allLinks.some((l) => EXTERNAL_CAREERS_PATTERN.test(l))) bump("Careers / Jobs");
    if (allLinks.some((l) => /\/(portal|login|sign-?in|my-?account|patient-?portal|patient-?login|uae-?pass)(\/|$)/i.test(l))) {
      bump("User Login / Account");
    }

    // Cross-reference already-detected live global variables — this is
    // a strictly better signal than the static domain list below for
    // anything already covered by lib/knownGlobals.ts, since it
    // reflects what the page's real, executed code actually
    // initialized rather than guessing from a script URL.
    if ((p.detectedGlobals ?? []).some((g) => CHAT_SUPPORT_GLOBALS.has(g))) bump("Live Chat Widget");

    // Cross-reference already-detected external script domains for
    // video hosting — catches a video embed whose iframe never
    // actually appears in static extraction (e.g. injected later by
    // JS the extraction script's DOM snapshot didn't capture) but
    // whose player script domain still shows up in Integrations.
    if ((p.externalScriptDomains ?? []).some((d) => VIDEO_HOSTING_DOMAINS.some((v) => d.includes(v)))) {
      bump("Video Content");
    }

    if (!p.renderedDomHtml) continue;
    const html = p.renderedDomHtml;
    const $ = cheerio.load(html);

    for (const form of detectForms(html)) {
      if (form.likelyPurpose === "search") bump("Site Search");
      if (form.likelyPurpose === "login") bump("User Login / Account");
      if (form.likelyPurpose === "newsletter") bump("Newsletter Signup");
      if (form.likelyPurpose === "contact") bump("Contact Form");
    }
    // Registration is distinguished from login by field composition —
    // multiple fields including email + a password-confirmation-shaped
    // second password field, or explicit "register"/"signup" hints.
    const formsText = $("form").toArray().map((f) => `${$(f).attr("action") ?? ""} ${$(f).attr("class") ?? ""} ${$(f).attr("id") ?? ""}`).join(" ").toLowerCase();
    if (/regist|sign-?up|create-?account/.test(formsText) || /regist|sign-?up|create-?account/i.test(p.url)) {
      bump("User Registration / Signup");
    }

    if ($("video, iframe[src*='youtube'], iframe[src*='vimeo']").length > 0) bump("Video Content");

    const bodyText = $("body").text().toLowerCase();
    if (/testimonial|customer review|what our (customers|clients) say/.test(bodyText)) bump("Testimonials / Reviews");

    if ($("a[href$='.pdf'], a[href$='.doc'], a[href$='.docx'], a[href$='.xls'], a[href$='.xlsx']").length > 0) {
      bump("Downloadable Resources");
    }

    $("script[src]").each((_, el) => {
      const src = $(el).attr("src") ?? "";
      if (CHAT_WIDGET_DOMAINS.some((d) => src.includes(d))) bump("Live Chat Widget");
    });
  }

  const featureOrder = [
    "Site Search",
    "User Login / Account",
    "User Registration / Signup",
    "E-commerce (cart / checkout)",
    "Newsletter Signup",
    "Blog / Articles",
    "FAQ / Help Center",
    "Pricing / Plans",
    "Careers / Jobs",
    "Multi-language Support",
    "Video Content",
    "Testimonials / Reviews",
    "Downloadable Resources",
    "Contact Form",
    "Store/Office Locations",
    "Live Chat Widget",
    "Media Contact",
  ];

  return featureOrder.map((feature) => {
    if (feature === "Multi-language Support") {
      return { feature, detected: anyMultilingual, pagesFoundOn: anyMultilingual ? pages.length : 0 };
    }
    const count = counts.get(feature) ?? 0;
    return { feature, detected: count > 0, pagesFoundOn: count };
  });
}
