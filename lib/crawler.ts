import { chromium, type Page as PlaywrightPage } from "playwright";
import { loadRobots, canFetch } from "./robots.js";
import { isLikelyNonHtmlResource, normalizeCrawlUrl } from "./urlFilters.js";
import { discoverSitemapUrls } from "./sitemap.js";
import { KNOWN_GLOBAL_VAR_NAMES } from "./knownGlobals.js";

/**
 * The Vercel version needed QStash (a queue) and Redis (dedup + a
 * counter) specifically because it was many short-lived, independent
 * serverless function calls with no shared memory between them. Here,
 * one Node process runs the whole crawl start to finish — so the
 * "queue" is just an array, and "dedup" is just a Set. No external
 * services needed for either.
 *
 * Similarly, Browserless (a remote browser-rendering service) is
 * replaced by launching Chromium locally via Playwright — the GitHub
 * Actions runner IS the machine doing the rendering now, not a
 * separate paid service.
 */

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
  htmlDir: string | null;
  hreflangLinks: { locale: string; url: string }[];
  renderedDomHtml: string;
  isClientRendered: boolean;
  internalLinks: string[];
  externalLinks: string[];
  images: string[];
  documents: string[];
  videos: string[];
  interactions: { type: string; selector: string }[];
  accessibilityViolations: { id: string; impact: string; description: string; nodesCount: number }[];
  detectedGlobals: string[];
  nonFunctionalHrefs: string[];
  lastModified: string | null;
  error: string | null;
  /** Consent banner was still visible after dismissal attempts (blocks CTAs / distorts metrics). */
  cookieWallPresent: boolean;
  /** True if a known Accept/Reject control was successfully clicked. */
  cookieDismissed: boolean;
  /** Appointment/booking UI appears inside an iframe (common healthcare pattern). */
  hasBookingIframe: boolean;
  /** Live chat / messaging widget detected in the rendered page. */
  hasChatWidget: boolean;
};

export type CrawlOptions = {
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  respectRobots: boolean;
  concurrency: number;
  onProgress?: (crawled: number, queued: number) => void;
};

function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * IMPORTANT: this extraction logic is built as a plain STRING and
 * passed to page.evaluate() as a string, not as a real TypeScript
 * function. Real reason: tsx compiles this file with esbuild, which
 * injects a helper called __name into compiled functions (to preserve
 * .name for named declarations). Playwright serializes whatever
 * function you pass to page.evaluate() and re-runs it inside the
 * actual browser page — a completely separate JS realm that has never
 * heard of esbuild's __name helper, so every single page failed with
 * "ReferenceError: __name is not defined" until this was rewritten as
 * a raw string, which is untouched by any TypeScript/esbuild transform
 * and therefore has no such helper calls to be missing. Exported (not
 * just inlined) so it can be tested directly via real TS/tsx
 * evaluation rather than fragile text-slicing of the source file.
 */
export function buildExtractionScript(rootHost: string): string {
  return `(() => {
      // Normalizes hash fragments and trailing slashes out of every
      // resolved URL — confirmed independently across five separate
      // audit reviews as the single highest-impact bug: without this,
      // /page, /page/, and /page#section all get treated as three
      // distinct pages, inflating page counts and duplicate-content
      // findings by 30-40% on sites with heavy in-page anchor nav.
      function abs(href) {
        try {
          const parsed = new URL(href, document.baseURI);
          parsed.hash = "";
          let result = parsed.toString();
          if (result.endsWith("/") && parsed.pathname !== "/") result = result.slice(0, -1);
          return result;
        } catch { return null; }
      }
      const rootHost = ${JSON.stringify(rootHost)};
      const title = document.title || null;
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") || null;
      const h1Text = document.querySelector("h1")?.textContent?.trim() || null;
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || null;
      const wordCount = (document.body?.innerText || "").trim().split(/\\s+/).filter(Boolean).length;
      const htmlLang = document.documentElement.getAttribute("lang") || null;
      const htmlDir = document.documentElement.getAttribute("dir") || null;

      const hreflangLinks = [];
      for (const link of document.querySelectorAll('link[rel="alternate"][hreflang]')) {
        const locale = link.getAttribute("hreflang");
        const href = link.getAttribute("href");
        if (locale && href) hreflangLinks.push({ locale, url: abs(href) || href });
      }

      const nonHtmlPattern = /\\.(pdf|docx?|xlsx?|pptx?|csv|rtf|zip|rar|7z|tar|gz|jpe?g|png|gif|svg|webp|ico|bmp|tiff?|mp4|mp3|wav|avi|mov|webm|ogg|woff2?|ttf|eot|xml|json)(\\?|#|$)/i;

      const internalLinks = [];
      const externalLinks = [];
      const nonFunctionalHrefs = [];
      const seenLinks = new Set();
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (!href) continue;
        // Robust protocol check, not a growing list of exact-string
        // matches — a real bug found in review: a typo like
        // "javacsript:;" (extra 's') doesn't match a startsWith("javascript:")
        // check, so it silently slipped through as if it were a real
        // URL, got classified as "external", and then failed the live
        // link-health check with a confusing ConnectError. Checking
        // the actual resolved protocol catches this AND any other
        // non-navigable scheme without needing to know its exact spelling.
        let protocol;
        try { protocol = new URL(href, document.baseURI).protocol; } catch { protocol = null; }
        if (protocol !== "http:" && protocol !== "https:") {
          // mailto/tel/sms are expected, normal, not bugs — only flag
          // genuinely broken schemes (typos, stray fragments-as-hrefs,
          // anything else) as a real finding.
          const isBenignScheme = protocol === "mailto:" || protocol === "tel:" || protocol === "sms:" || protocol === "whatsapp:" || href.startsWith("#");
          if (!isBenignScheme && nonFunctionalHrefs.length < 20) nonFunctionalHrefs.push(href);
          continue;
        }
        const full = abs(href);
        if (!full || seenLinks.has(full)) continue;
        seenLinks.add(full);
        if (nonHtmlPattern.test(full)) continue;
        try {
          const host = new URL(full).host;
          const normalize = (h) => h.replace(/^www\\./, "");
          if (normalize(host) === normalize(rootHost)) internalLinks.push(full);
          else externalLinks.push(full);
        } catch {}
      }

      const images = [];
      for (const img of document.querySelectorAll("img[src]")) {
        const full = abs(img.getAttribute("src") || "");
        if (full) images.push(full);
      }

      const documents = [];
      const docExtPattern = /\\.(pdf|docx?|xlsx?|pptx?)(\\?|$)/i;
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (href && docExtPattern.test(href)) {
          const full = abs(href);
          if (full) documents.push(full);
        }
      }

      const interactions = [];
      const interactionSelectors = [
        { type: "modal", selector: '[role="dialog"], .modal' },
        { type: "accordion", selector: '[aria-expanded], .accordion' },
        { type: "carousel", selector: '.carousel, .slider, [class*="carousel"]' },
        { type: "tabs", selector: '[role="tablist"], .tabs' },
      ];
      for (const { type, selector } of interactionSelectors) {
        if (document.querySelector(selector)) interactions.push({ type, selector });
      }

      const isClientRendered =
        document.querySelectorAll("script").length > 0 && document.body.children.length < 10 && wordCount < 50;

      // Live detection: check which known third-party tool signatures
      // actually initialized on THIS rendered page, by looking at what
      // real global variables exist on window right now — not by
      // guessing from a script tag's URL. This catches tools regardless
      // of which domain served the underlying file from (self-hosted,
      // proxied, or otherwise not matching any hardcoded domain list).
      const knownGlobalNames = ${JSON.stringify(KNOWN_GLOBAL_VAR_NAMES)};
      const detectedGlobals = [];
      for (const name of knownGlobalNames) {
        try {
          if (typeof window[name] !== "undefined") detectedGlobals.push(name);
        } catch {}
      }

      return {
        title, metaDescription, h1Text, canonical, wordCount, htmlLang, htmlDir, hreflangLinks,
        internalLinks, externalLinks, images, documents, interactions, isClientRendered, detectedGlobals, nonFunctionalHrefs,
      };
    })()`;
}

const AXE_SCRIPT = `(async () => {
        // iframes: true is a real, functioning axe-core option (verified
        // against the actual installed 4.10.2 source) — catches
        // same-origin iframe content. Deliberately NOT setting
        // shadowDom: true here — verified against the same source that
        // axe-core never reads options.shadowDom at all; shadow DOM
        // piercing already happens automatically without any flag, so
        // this would be a silently-ignored no-op, not a real config.
        // Cross-origin iframes (third-party booking widgets, chat
        // widgets) are a separate, harder problem this can't solve —
        // same-origin policy blocks page.evaluate() from reaching them
        // regardless of any axe option; that needs Playwright's own
        // page.frames() API run as a distinct pass, not built here.
        const results = await axe.run(document, { resultTypes: ["violations"], iframes: true });
        return results.violations.map((v) => ({
          id: v.id,
          impact: v.impact || "minor",
          description: v.help,
          nodesCount: v.nodes.length,
        }));
      })()`;

/**
 * A single, authoritative definition of "this page has an error" —
 * added specifically to fix a real, confirmed contradiction: the
 * report's "Page Errors" stat only counted crawl-level failures
 * (p.error — timeouts, navigation errors), while the "N pages
 * returned an error status" narrative bullet separately counted
 * HTTP-level failures (statusCode >= 400) via a different filter
 * elsewhere. A page can trip one without the other, so the two
 * numbers could legitimately disagree — which reads as a bug to
 * anyone comparing them, even though each was individually
 * "correct" by its own narrower definition. Unifying to one function,
 * imported everywhere a page-error count is needed, makes that kind
 * of drift structurally impossible rather than just less likely.
 */
export function isPageError(p: { error: string | null; statusCode: number | null }): boolean {
  return Boolean(p.error) || (p.statusCode !== null && p.statusCode >= 400);
}

/** Known consent / cookie-banner accept controls (OneTrust, Cookiebot, generic). */
const COOKIE_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "#onetrust-reject-all-handler",
  "button#accept-recommended-btn-handler",
  'button[aria-label*="Accept" i]',
  'button[aria-label*="Agree" i]',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Allow all")',
  'button:has-text("I agree")',
  'button:has-text("Got it")',
  'button:has-text("Accept cookies")',
  '[data-testid="cookie-accept"]',
  ".cc-btn.cc-dismiss",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "button.cookie-accept",
  '[id*="cookie"] button[class*="accept" i]',
];

async function dismissCookies(page: PlaywrightPage): Promise<boolean> {
  for (const selector of COOKIE_SELECTORS) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 1500 });
        await page.waitForTimeout(600);
        return true;
      }
    } catch {
      /* try next */
    }
  }
  try {
    const textBtn = page.getByRole("button", { name: /accept all|allow all|agree|got it/i }).first();
    if (await textBtn.isVisible({ timeout: 500 })) {
      await textBtn.click({ timeout: 1500 });
      await page.waitForTimeout(600);
      return true;
    }
  } catch {
    /* no text match */
  }
  return false;
}

/** Wait until body word-count plateaus — proxy for SPA / AEM hydration finished. */
async function waitForContentStable(page: PlaywrightPage, maxMs = 4000): Promise<void> {
  const start = Date.now();
  let lastCount = -1;
  let stableRounds = 0;
  while (Date.now() - start < maxMs) {
    const count = await page.evaluate(() =>
      (document.body?.innerText || "").trim().split(/\s+/).filter(Boolean).length,
    );
    if (count === lastCount && count > 30) {
      stableRounds++;
      if (stableRounds >= 2) return;
    } else {
      stableRounds = 0;
      lastCount = count;
    }
    await page.waitForTimeout(350);
  }
}

async function scrollAndSettle(page: PlaywrightPage): Promise<void> {
  try {
    await page.evaluate(async () => {
      const step = 700;
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
  } catch {
    /* non-critical */
  }
}

async function detectConversionGates(page: PlaywrightPage): Promise<{
  hasBookingIframe: boolean;
  hasChatWidget: boolean;
  cookieWallPresent: boolean;
}> {
  return page.evaluate(() => {
    const iframes = Array.from(document.querySelectorAll("iframe"));
    const hasBookingIframe = iframes.some((f) => {
      const src = (f.src || "").toLowerCase();
      const title = (f.title || "").toLowerCase();
      return (
        /book|appointment|schedule|calendar|doctify|zocdoc|health|patient/.test(src) ||
        /book|appointment/.test(title)
      );
    });
    const hasChatWidget = !!(
      document.querySelector(
        '[class*="chat" i], [id*="chat" i], [class*="intercom" i], [id*="intercom" i]',
      ) ||
      (window as unknown as { Intercom?: unknown }).Intercom ||
      (window as unknown as { HubSpotConversations?: unknown }).HubSpotConversations
    );
    const cookieWallPresent = !!(
      document.querySelector(
        "#onetrust-banner-sdk, #CybotCookiebotDialog, [id*='cookie-banner' i], .cookie-consent, #onetrust-consent-sdk",
      )
    );
    return { hasBookingIframe, hasChatWidget, cookieWallPresent };
  });
}

async function renderOnePage(page: PlaywrightPage, url: string, rootHost: string): Promise<CrawledPage> {
  const started = Date.now();
  try {
    // Hybrid wait: networkidle when the page cooperates, hard cap so
    // persistent telemetry (Clarity, heatmaps, social SDKs) cannot hang
    // the crawl forever.
    let response;
    try {
      response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await Promise.race([page.waitForLoadState("networkidle"), page.waitForTimeout(5000)]);
    } catch {
      response = await page.goto(url, { waitUntil: "commit", timeout: 20000 });
      await page.waitForTimeout(2000);
    }

    // 1. Dismiss cookie / consent walls before extraction (OneTrust etc.)
    const cookieDismissed = await dismissCookies(page);

    // 2. Wait for SPA / AEM hydration (word-count plateau)
    await waitForContentStable(page, 3500);

    // 3. Progressive scroll to trigger IntersectionObserver / lazy content
    await scrollAndSettle(page);

    // 4. Some sites re-show the banner after scroll — try once more
    const cookieDismissedAgain = await dismissCookies(page);
    const anyCookieDismissed = cookieDismissed || cookieDismissedAgain;

    // 5. Short final quiet period
    await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});

    const statusCode = response ? response.status() : null;
    const lastModified = response?.headers()["last-modified"] ?? null;
    const renderedDomHtml = await page.content();

    const extracted = (await page.evaluate(buildExtractionScript(rootHost))) as {
      title: string | null;
      metaDescription: string | null;
      h1Text: string | null;
      canonical: string | null;
      wordCount: number;
      htmlLang: string | null;
      htmlDir: string | null;
      hreflangLinks: { locale: string; url: string }[];
      internalLinks: string[];
      externalLinks: string[];
      images: string[];
      documents: string[];
      interactions: { type: string; selector: string }[];
      isClientRendered: boolean;
      detectedGlobals: string[];
      nonFunctionalHrefs: string[];
    };

    const gates = await detectConversionGates(page).catch(() => ({
      hasBookingIframe: false,
      hasChatWidget: false,
      cookieWallPresent: false,
    }));

    let accessibilityViolations: CrawledPage["accessibilityViolations"] = [];
    try {
      await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js" });
      accessibilityViolations = (await page.evaluate(AXE_SCRIPT)) as CrawledPage["accessibilityViolations"];
    } catch {
      accessibilityViolations = [];
    }

    return {
      url,
      finalUrl: page.url(),
      statusCode,
      responseTimeMs: Date.now() - started,
      depth: 0, // filled in by the caller
      renderedDomHtml: renderedDomHtml.slice(0, 200_000),
      videos: [],
      accessibilityViolations,
      lastModified,
      error: null,
      cookieWallPresent: gates.cookieWallPresent,
      cookieDismissed: anyCookieDismissed,
      hasBookingIframe: gates.hasBookingIframe,
      hasChatWidget: gates.hasChatWidget,
      ...extracted,
    };
  } catch (err) {
    return {
      url,
      finalUrl: url,
      statusCode: null,
      responseTimeMs: Date.now() - started,
      depth: 0,
      title: null,
      metaDescription: null,
      h1Text: null,
      canonical: null,
      wordCount: 0,
      htmlLang: null,
      htmlDir: null,
      hreflangLinks: [],
      renderedDomHtml: "",
      isClientRendered: false,
      detectedGlobals: [],
      nonFunctionalHrefs: [],
      internalLinks: [],
      externalLinks: [],
      images: [],
      documents: [],
      videos: [],
      interactions: [],
      accessibilityViolations: [],
      lastModified: null,
      error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      cookieWallPresent: false,
      cookieDismissed: false,
      hasBookingIframe: false,
      hasChatWidget: false,
    };
  }
}

export async function crawlSite(options: CrawlOptions): Promise<CrawledPage[]> {
  const { startUrl: rawStartUrl, maxPages, maxDepth, respectRobots, concurrency } = options;
  const startUrl = normalizeCrawlUrl(rawStartUrl);
  const rootHost = urlHost(startUrl);
  const robotsTxt = respectRobots ? await loadRobots(startUrl) : "";

  const seen = new Set<string>([startUrl]);
  const results: CrawledPage[] = [];
  let queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

  // Sitemap seeding — same rationale as the Vercel version: link-following
  // alone under-discovers pages on sites with JS pagination or mega-menus.
  const sitemapUrls = await discoverSitemapUrls(startUrl);
  for (const rawUrl of sitemapUrls) {
    const url = normalizeCrawlUrl(rawUrl);
    if (queue.length + results.length >= maxPages) break; // budget genuinely exhausted, stop entirely
    if (seen.has(url)) continue; // just this one's a dupe — keep checking the rest of the sitemap
    seen.add(url);
    queue.push({ url, depth: 1 });
  }

  const browser = await chromium.launch();
  let context = await browser.newContext();
  const RECYCLE_EVERY_N_PAGES = 50;
  let pagesSinceRecycle = 0;

  try {
    while (queue.length > 0 && results.length < maxPages) {
      const batch = queue.slice(0, concurrency);
      queue = queue.slice(concurrency);

      const batchResults = await Promise.all(
        batch.map(async ({ url, depth }) => {
          if (respectRobots && !canFetch(robotsTxt, url)) {
            return {
              url,
              finalUrl: url,
              statusCode: null,
              responseTimeMs: 0,
              depth,
              title: null,
              metaDescription: null,
              h1Text: null,
              canonical: null,
              wordCount: 0,
              htmlLang: null,
              htmlDir: null,
              hreflangLinks: [],
              renderedDomHtml: "",
              isClientRendered: false,
              internalLinks: [],
              externalLinks: [],
              images: [],
              documents: [],
              videos: [],
              interactions: [],
              accessibilityViolations: [],
              detectedGlobals: [],
              nonFunctionalHrefs: [],
              lastModified: null,
              error: "blocked_by_robots_txt",
              cookieWallPresent: false,
              cookieDismissed: false,
              hasBookingIframe: false,
              hasChatWidget: false,
            } as CrawledPage;
          }
          const page = await context.newPage();
          try {
            const result = await renderOnePage(page, url, rootHost);
            result.depth = depth;
            return result;
          } finally {
            await page.close();
          }
        }),
      );

      for (const result of batchResults) {
        results.push(result);
        pagesSinceRecycle++;
        if (result.depth < maxDepth) {
          for (const link of result.internalLinks) {
            if (seen.has(link) || results.length + queue.length >= maxPages) continue;
            if (isLikelyNonHtmlResource(link)) continue;
            seen.add(link);
            queue.push({ url: link, depth: result.depth + 1 });
          }
        }
      }

      // Periodic recycle: individual pages were already closed after
      // each use, but the single browser context persisting across an
      // entire 5,000-page crawl was never itself recycled — plausible
      // real memory accumulation (leaked listeners, growing internal
      // caches) over a very long run, the same class of at-scale
      // problem that already caused one production failure earlier in
      // this project. Closing and relaunching a fresh context
      // periodically is a standard, well-known mitigation.
      if (pagesSinceRecycle >= RECYCLE_EVERY_N_PAGES) {
        await context.close();
        context = await browser.newContext();
        pagesSinceRecycle = 0;
      }

      options.onProgress?.(results.length, queue.length);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}
