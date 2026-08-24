import type { CrawledPage, FeatureResult } from "./types";

type Rule = {
  feature: string;
  test: (p: CrawledPage) => boolean;
};

const RULES: Rule[] = [
  {
    feature: "Site Search",
    test: (p) =>
      /\/search(\/|$|\.html)/i.test(p.url) ||
      Boolean(p.signals.searchPlaceholder) ||
      /search/i.test(p.visibleTextSample.slice(0, 400)),
  },
  {
    feature: "User Login / Account",
    test: (p) =>
      /\/(login|signin|sign-in|patient-portal|my-account|account)(\/|$|\.html)/i.test(p.url) ||
      /patient portal|sign in|log in|uae pass/i.test(p.visibleTextSample),
  },
  {
    feature: "User Registration / Signup",
    test: (p) => /\/(register|signup|sign-up|create-account)(\/|$)/i.test(p.url),
  },
  {
    feature: "E-commerce (cart / checkout)",
    test: (p) => /\/(cart|checkout|shop|basket)(\/|$)/i.test(p.url),
  },
  {
    feature: "Newsletter Signup",
    test: (p) => /newsletter|subscribe to our/i.test(p.visibleTextSample),
  },
  {
    feature: "Blog / Articles",
    test: (p) => /\/(blog|articles?|insights|news|health-knowledge)(\/|$|\.html)/i.test(p.url),
  },
  {
    feature: "FAQ / Help Center",
    test: (p) => /\/(faq|help|support)(\/|$|\.html)/i.test(p.url) && !/oncology\/support/i.test(p.url),
  },
  {
    feature: "Pricing / Plans",
    test: (p) => /\/(pricing|plans|packages|special-offers)(\/|$|\.html)/i.test(p.url),
  },
  {
    feature: "Careers / Jobs",
    test: (p) =>
      /\/(careers?|jobs|working-with|working-at)(\/|$|\.html)/i.test(p.url) ||
      p.signals.navLabels.some((l) => /career/i.test(l)) ||
      p.externalLinks.some((u) => /careers?\./i.test(u)),
  },
  {
    feature: "Video Content",
    test: (p) =>
      p.signals.iframeSrcs.some((s) => /youtube|vimeo|youtu\.be/i.test(s)) ||
      /vimeo|youtube/i.test(p.visibleTextSample),
  },
  {
    feature: "Testimonials / Reviews",
    test: (p) => /testimonial|patient stor|what our (patients|customers)/i.test(p.visibleTextSample),
  },
  {
    feature: "Downloadable Resources",
    test: (p) => p.externalLinks.some((u) => /\.pdf(\?|$)/i.test(u)) || /\.pdf/i.test(p.visibleTextSample),
  },
  {
    feature: "Contact Form",
    test: (p) => /\/contact/i.test(p.url),
  },
  {
    feature: "Store/Office Locations",
    test: (p) =>
      /\/(locations?|hospitals-and-clinics|find-us|branches|clinics)(\/|$|\.html)/i.test(p.url) ||
      p.signals.navLabels.some((l) => /hospital|clinic|location/i.test(l)),
  },
  {
    feature: "Live Chat Widget",
    test: (p) =>
      p.signals.chatWidget ||
      p.detectedGlobals.some((g) => /Intercom|drift|zE|Tawk_API|LiveChatWidget/i.test(g)),
  },
  {
    feature: "Appointment booking",
    test: (p) =>
      /book-an-appointment|booking\./i.test(p.url) ||
      p.signals.iframeSrcs.some((s) => /book/i.test(s)) ||
      p.signals.navLabels.some((l) => /book/i.test(l)),
  },
  {
    feature: "Find a doctor / directory",
    test: (p) => /find-a-doctor|doctors/i.test(p.url) || p.signals.navLabels.some((l) => /^doctors?$/i.test(l)),
  },
];

export function detectFeatures(pages: CrawledPage[], multilingual: boolean): FeatureResult[] {
  const out: FeatureResult[] = RULES.map(({ feature, test }) => {
    const hits = pages.filter(test);
    return { feature, detected: hits.length > 0, pagesFoundOn: hits.length, evidence: hits[0]?.url };
  });
  out.splice(9, 0, {
    feature: "Multi-language Support",
    detected: multilingual || pages.some((p) => (p.htmlLang || "").split("-")[0] && pages.some((q) => (q.htmlLang || "").split("-")[0] !== (p.htmlLang || "").split("-")[0])),
    pagesFoundOn: multilingual ? pages.length : 0,
  });
  return out;
}
