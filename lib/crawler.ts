import { chromium, type Page as PlaywrightPage } from "playwright";
import { loadRobots, canFetch } from "./robots.js";
import { isLikelyNonHtmlResource } from "./urlFilters.js";
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
  lastModified: string | null;
  error: string | null;
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
      function abs(href) {
        try { return new URL(href, document.baseURI).href; } catch { return null; }
      }
      const rootHost = ${JSON.stringify(rootHost)};
      const title = document.title || null;
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") || null;
      const h1Text = document.querySelector("h1")?.textContent?.trim() || null;
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || null;
      const wordCount = (document.body?.innerText || "").trim().split(/\\s+/).filter(Boolean).length;
      const htmlLang = document.documentElement.getAttribute("lang") || null;

      const hreflangLinks = [];
      for (const link of document.querySelectorAll('link[rel="alternate"][hreflang]')) {
        const locale = link.getAttribute("hreflang");
        const href = link.getAttribute("href");
        if (locale && href) hreflangLinks.push({ locale, url: abs(href) || href });
      }

      const nonHtmlPattern = /\\.(pdf|docx?|xlsx?|pptx?|csv|rtf|zip|rar|7z|tar|gz|jpe?g|png|gif|svg|webp|ico|bmp|tiff?|mp4|mp3|wav|avi|mov|webm|ogg|woff2?|ttf|eot|xml|json)(\\?|#|$)/i;

      const internalLinks = [];
      const externalLinks = [];
      const seenLinks = new Set();
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
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
        title, metaDescription, h1Text, canonical, wordCount, htmlLang, hreflangLinks,
        internalLinks, externalLinks, images, documents, interactions, isClientRendered, detectedGlobals,
      };
    })()`;
}

const AXE_SCRIPT = `(async () => {
        const results = await axe.run(document, { resultTypes: ["violations"] });
        return results.violations.map((v) => ({
          id: v.id,
          impact: v.impact || "minor",
          description: v.help,
          nodesCount: v.nodes.length,
        }));
      })()`;

async function renderOnePage(page: PlaywrightPage, url: string, rootHost: string): Promise<CrawledPage> {
  const started = Date.now();
  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
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
      hreflangLinks: { locale: string; url: string }[];
      internalLinks: string[];
      externalLinks: string[];
      images: string[];
      documents: string[];
      interactions: { type: string; selector: string }[];
      isClientRendered: boolean;
      detectedGlobals: string[];
    };

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
      hreflangLinks: [],
      renderedDomHtml: "",
      isClientRendered: false,
      detectedGlobals: [],
      internalLinks: [],
      externalLinks: [],
      images: [],
      documents: [],
      videos: [],
      interactions: [],
      accessibilityViolations: [],
      lastModified: null,
      error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    };
  }
}

export async function crawlSite(options: CrawlOptions): Promise<CrawledPage[]> {
  const { startUrl, maxPages, maxDepth, respectRobots, concurrency } = options;
  const rootHost = urlHost(startUrl);
  const robotsTxt = respectRobots ? await loadRobots(startUrl) : "";

  const seen = new Set<string>([startUrl]);
  const results: CrawledPage[] = [];
  let queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];

  // Sitemap seeding — same rationale as the Vercel version: link-following
  // alone under-discovers pages on sites with JS pagination or mega-menus.
  const sitemapUrls = await discoverSitemapUrls(startUrl);
  for (const url of sitemapUrls) {
    if (seen.has(url) || queue.length + results.length >= maxPages) break;
    seen.add(url);
    queue.push({ url, depth: 1 });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();

  try {
    while (queue.length > 0 && results.length < maxPages) {
      const batch = queue.slice(0, concurrency);
      queue = queue.slice(concurrency);

      const batchResults = await Promise.all(
        batch.map(async ({ url, depth }) => {
          if (respectRobots && !canFetch(robotsTxt, url)) {
            return { url, finalUrl: url, statusCode: null, responseTimeMs: 0, depth, title: null, metaDescription: null, h1Text: null, canonical: null, wordCount: 0, htmlLang: null, hreflangLinks: [], renderedDomHtml: "", isClientRendered: false, internalLinks: [], externalLinks: [], images: [], documents: [], videos: [], interactions: [], accessibilityViolations: [], detectedGlobals: [], lastModified: null, error: "blocked_by_robots_txt" } as CrawledPage;
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
        if (result.depth < maxDepth) {
          for (const link of result.internalLinks) {
            if (seen.has(link) || results.length + queue.length >= maxPages) continue;
            if (isLikelyNonHtmlResource(link)) continue;
            seen.add(link);
            queue.push({ url: link, depth: result.depth + 1 });
          }
        }
      }

      options.onProgress?.(results.length, queue.length);
    }
  } finally {
    await browser.close();
  }

  return results;
}
