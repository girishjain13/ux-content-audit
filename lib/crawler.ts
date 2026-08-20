import { chromium, type Page as PlaywrightPage } from "playwright";
import { loadRobots, canFetch } from "./robots.js";
import { isLikelyNonHtmlResource } from "./urlFilters.js";
import { discoverSitemapUrls } from "./sitemap.js";

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

async function renderOnePage(page: PlaywrightPage, url: string, rootHost: string): Promise<CrawledPage> {
  const started = Date.now();
  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    const statusCode = response ? response.status() : null;
    const lastModified = response?.headers()["last-modified"] ?? null;
    const renderedDomHtml = await page.content();

    const extracted = await page.evaluate((rootHost) => {
      function abs(href: string): string | null {
        try {
          return new URL(href, document.baseURI).href;
        } catch {
          return null;
        }
      }
      const title = document.title || null;
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") || null;
      const h1Text = document.querySelector("h1")?.textContent?.trim() || null;
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || null;
      const wordCount = (document.body?.innerText || "").trim().split(/\s+/).filter(Boolean).length;
      const htmlLang = document.documentElement.getAttribute("lang") || null;

      const hreflangLinks: { locale: string; url: string }[] = [];
      for (const link of document.querySelectorAll('link[rel="alternate"][hreflang]')) {
        const locale = link.getAttribute("hreflang");
        const href = link.getAttribute("href");
        if (locale && href) hreflangLinks.push({ locale, url: abs(href) || href });
      }

      const nonHtmlPattern = /\.(pdf|docx?|xlsx?|pptx?|csv|rtf|zip|rar|7z|tar|gz|jpe?g|png|gif|svg|webp|ico|bmp|tiff?|mp4|mp3|wav|avi|mov|webm|ogg|woff2?|ttf|eot|xml|json)(\?|#|$)/i;

      const internalLinks: string[] = [];
      const externalLinks: string[] = [];
      const seenLinks = new Set<string>();
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
        const full = abs(href);
        if (!full || seenLinks.has(full)) continue;
        seenLinks.add(full);
        if (nonHtmlPattern.test(full)) continue;
        try {
          const host = new URL(full).host;
          const normalize = (h: string) => h.replace(/^www\./, "");
          if (normalize(host) === normalize(rootHost)) internalLinks.push(full);
          else externalLinks.push(full);
        } catch {
          /* skip unparseable */
        }
      }

      const images: string[] = [];
      for (const img of document.querySelectorAll("img[src]")) {
        const full = abs(img.getAttribute("src") || "");
        if (full) images.push(full);
      }

      const documents: string[] = [];
      const docExtPattern = /\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i;
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (href && docExtPattern.test(href)) {
          const full = abs(href);
          if (full) documents.push(full);
        }
      }

      const interactions: { type: string; selector: string }[] = [];
      const interactionSelectors: { type: string; selector: string }[] = [
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

      return {
        title, metaDescription, h1Text, canonical, wordCount, htmlLang, hreflangLinks,
        internalLinks, externalLinks, images, documents, interactions, isClientRendered,
      };
    }, rootHost);

    let accessibilityViolations: CrawledPage["accessibilityViolations"] = [];
    try {
      await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js" });
      accessibilityViolations = await page.evaluate(async () => {
        // @ts-expect-error axe is injected globally by the script tag above
        const results = await axe.run(document, { resultTypes: ["violations"] });
        return results.violations.map((v: any) => ({
          id: v.id,
          impact: v.impact || "minor",
          description: v.help,
          nodesCount: v.nodes.length,
        }));
      });
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
            return { url, finalUrl: url, statusCode: null, responseTimeMs: 0, depth, title: null, metaDescription: null, h1Text: null, canonical: null, wordCount: 0, htmlLang: null, hreflangLinks: [], renderedDomHtml: "", isClientRendered: false, internalLinks: [], externalLinks: [], images: [], documents: [], videos: [], interactions: [], accessibilityViolations: [], lastModified: null, error: "blocked_by_robots_txt" } as CrawledPage;
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
