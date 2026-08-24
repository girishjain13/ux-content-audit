import type { CrawledPage, PageSignals } from "./types";
import { analyzeSite } from "./analyze";

function signals(partial: Partial<PageSignals>): PageSignals {
  return {
    htmlLang: "en",
    htmlDir: "ltr",
    cookieBannerVisible: true,
    cookieGatingCopy: false,
    cookieDismissed: true,
    iframeSrcs: [],
    iframeGatedCount: 0,
    duplicateNavLabels: ["Book appointment", "Doctors", "Hospitals & Clinics", "Specialities", "Patient Portal"],
    cmsLeftovers: ["Hirslanden"],
    chatWidget: true,
    searchPlaceholder: "Keyword...",
    emptyAltCount: 6,
    imageCount: 14,
    navLabels: [
      "Book appointment",
      "Doctors",
      "Hospitals & Clinics",
      "Specialities",
      "Patient Portal",
      "Book appointment",
      "Doctors",
      "Careers",
      "Contact",
      "AR",
    ],
    hydrationWaitedMs: 2100,
    wordCountBeforeConsent: 80,
    ...partial,
  };
}

function page(p: Partial<CrawledPage> & { url: string }): CrawledPage {
  return {
    finalUrl: p.url,
    statusCode: 200,
    responseTimeMs: 1800,
    depth: 1,
    title: null,
    metaDescription: "Mediclinic Middle East",
    h1Text: "Heading",
    canonical: p.url,
    wordCount: 420,
    htmlLang: "en",
    isClientRendered: true,
    internalLinks: [
      "https://www.mediclinic.ae/en/corporate/home.html",
      "https://www.mediclinic.ae/en/corporate/book-an-appointment.html",
      "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor.html",
      "https://www.mediclinic.ae/en/corporate/emergency.html",
    ],
    externalLinks: ["https://careers.mediclinic.com/MiddleEast/?locale=en_GB"],
    accessibilityViolations: [
      { id: "image-alt", impact: "serious", description: "Images must have alternate text", nodesCount: 4 },
      { id: "button-name", impact: "critical", description: "Buttons must have discernible text", nodesCount: 1 },
      { id: "color-contrast", impact: "moderate", description: "Elements must have sufficient color contrast", nodesCount: 6 },
    ],
    detectedGlobals: ["dataLayer", "gtag", "OneTrust", "hj"],
    nonFunctionalHrefs: [],
    error: null,
    signals: signals({}),
    visibleTextSample:
      "Expertise you can trust Book appointment Find a Doctor Hospitals & Clinics Special Offers Patient Portal Hirslanden Home NEED HELP? Cookie Settings",
    ...p,
  };
}

export function buildMediclinicSample() {
  const home = "https://www.mediclinic.ae/en/corporate/home.html";
  const pages: CrawledPage[] = [
    page({
      url: home,
      depth: 0,
      title: "Hospitals & Clinics in UAE - Mediclinic Middle East",
      h1Text: "Expertise you can trust",
      wordCount: 717,
      internalLinks: [
        home,
        "https://www.mediclinic.ae/en/corporate/book-an-appointment.html",
        "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor.html",
        "https://www.mediclinic.ae/en/corporate/emergency.html",
        "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics.html",
        "https://www.mediclinic.ae/en/corporate/patient-portal.html",
        "https://www.mediclinic.ae/en/corporate/contact-us.html",
        "https://www.mediclinic.ae/en/corporate/health-insurance.html",
        "https://www.mediclinic.ae/en/corporate/media-and-news.html",
        "https://www.mediclinic.ae/en/corporate/about-mediclinic-middle-east.html",
        "https://www.mediclinic.ae/ar/corporate/home.html",
        "https://www.mediclinic.ae/en/corporate/search.html",
        "https://www.mediclinic.ae/en/corporate/working-with-mediclinic.html",
      ],
      visibleTextSample:
        "Expertise you can trust Book appointment Doctors Hospitals & Clinics Specialities Patient Portal Hirslanden Home The Mediclinic App Virtual Health Services Perimenopause Package Cookie Settings NEED HELP?",
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/book-an-appointment.html",
      title: "Book an Appointment with Our Doctors - Mediclinic Middle East",
      h1Text: "Book an Appointment at Mediclinic",
      wordCount: 210,
      signals: signals({
        cookieGatingCopy: true,
        iframeGatedCount: 1,
        iframeSrcs: ["https://booking.mediclinic.ae/en/booking"],
        cookieDismissed: false,
      }),
      visibleTextSample:
        "Book an Appointment at Mediclinic Please accept functional cookies to see this content. Cookie Settings Download the app 800 1999 Hirslanden Home NEED HELP?",
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor.html",
      title: "Best Doctor and Healthcare Professionals - Mediclinic Middle East",
      h1Text: "Find a Doctor at Mediclinic",
      wordCount: 380,
      signals: signals({
        cmsLeftovers: ["Hirslanden", "Seite ", "Key word/name"],
        searchPlaceholder: "Key word/name",
      }),
      visibleTextSample:
        "Find a Doctor at Mediclinic Key word/name Hospital Speciality Language Gender Dr. Aadil Gutta Begad Mohamed Samy A. Abbas Dr. Dr. Abdalla Al Hajiri (ID*) Seite 3 Seite 4 Seite 5 Display more Hirslanden Home",
    }),
    page({
      url: "https://www.mediclinic.ae/ar/corporate/home.html",
      title: "المستشفيات والعيادات في الإمارات | ميديكلينيك الشرق الأوسط",
      h1Text: "أخصائيون تثق بهم",
      htmlLang: "ar",
      wordCount: 640,
      signals: signals({
        htmlLang: "ar",
        htmlDir: "ltr",
        cmsLeftovers: ["Hirslanden"],
        duplicateNavLabels: ["Book appointment", "Doctors", "Hospitals & Clinics", "Specialities", "Patient Portal"],
      }),
      visibleTextSample:
        "أخصائيون تثق بهم Book appointment Doctors Hospitals & Clinics Specialities Patient Portal Hirslanden Home Cookie Settings NEED HELP?",
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/emergency.html",
      title: "Mediclinic Emergency - Mediclinic Middle East",
      h1Text: "Emergency",
      wordCount: 280,
      visibleTextSample:
        "Emergency number 999/998 WHERE did it happen WHO is calling Mediclinic Airport Road Hospital Postcode * Next to Zayed Sports City Phone 800 1 999 Hirslanden Home Cookie Settings",
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/patient-portal.html",
      title: "Patient Portal",
      metaDescription: null,
      h1Text: "Patient Portal",
      wordCount: 160,
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics.html",
      title: "Clinics & Hospitals in Dubai & Abu Dhabi - Mediclinic",
      h1Text: "Hospitals & Clinics",
      wordCount: 520,
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/health-insurance.html",
      title: "Health Insurance Partners - Mediclinic Middle East",
      h1Text: "Health Insurance",
      wordCount: 340,
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/contact-us.html",
      title: "Contact Mediclinic UAE - Mediclinic Middle East",
      h1Text: "Contact Mediclinic Middle East",
      wordCount: 290,
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/media-and-news.html",
      title: "News & Updates - News",
      h1Text: "Media & News",
      wordCount: 410,
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/about-mediclinic-middle-east.html",
      title: "About Mediclinic Middle East",
      h1Text: "About Mediclinic Middle East",
      wordCount: 480,
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/working-with-mediclinic.html",
      title: "Mediclinic Middle East - Careers at Mediclinic",
      h1Text: "Working with Mediclinic",
      wordCount: 300,
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/search.html",
      title: "Search results - Mediclinic Middle East",
      h1Text: "Search at Mediclinic",
      wordCount: 90,
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/media-kit.html",
      title: "Media Kit - Mediclinic Middle East",
      h1Text: "Media Kit",
      wordCount: 220,
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor/30.html",
      title: "Best Doctor and Healthcare Professionals - Mediclinic Middle East",
      h1Text: "Find a Doctor at Mediclinic",
      wordCount: 120,
      depth: 2,
      signals: signals({ cmsLeftovers: ["Seite "] }),
    }),
    page({
      url: "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor/40.html",
      title: "Best Doctor and Healthcare Professionals - Mediclinic Middle East",
      h1Text: "Find a Doctor at Mediclinic",
      wordCount: 118,
      depth: 2,
      signals: signals({ cmsLeftovers: ["Seite "] }),
    }),
  ];

  const report = analyzeSite(pages, home, {
    truncated: true,
    durationSeconds: 86,
    id: "sample-mediclinic",
    isSample: true,
  });
  report.crawledAt = "2026-08-23T09:00:00.000Z";
  return report;
}
