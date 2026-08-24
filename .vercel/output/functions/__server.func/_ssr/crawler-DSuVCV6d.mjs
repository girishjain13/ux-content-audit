import { i as urlHost, n as isLikelyNonHtmlResource, r as normalizeCrawlUrl } from "./server-BXawGYlS.mjs";
import { chromium } from "playwright";
//#region node_modules/.nitro/vite/services/ssr/assets/crawler-DSuVCV6d.js
var COOKIE_CLICK_SELECTORS = [
	"#onetrust-accept-btn-handler",
	"#onetrust-reject-all-handler",
	"#accept-recommended-btn-handler",
	".onetrust-close-btn-handler",
	"#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
	"#CybotCookiebotDialogBodyButtonAccept",
	".osano-cm-accept-all",
	"button[aria-label='Accept cookies']",
	"button[aria-label='Accept all']",
	"#cc-accept-all"
];
var COOKIE_TEXT_BUTTONS = [
	"Accept all",
	"Accept All",
	"Allow all",
	"Allow All",
	"I agree",
	"Got it",
	"Agree",
	"Accept"
];
var CMS_LEFTOVER_PATTERNS = [
	"Hirslanden",
	"Seite ",
	"Key word/name",
	"Lorem ipsum",
	"Coming soon",
	"TK_placeholder",
	"TODO:"
];
function buildExtractionScript(rootHost) {
	return `(() => {
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
      const bodyText = (document.body?.innerText || "").trim();
      const wordCount = bodyText.split(/\\s+/).filter(Boolean).length;
      const htmlLang = document.documentElement.getAttribute("lang") || null;
      const htmlDir = document.documentElement.getAttribute("dir") || getComputedStyle(document.documentElement).direction || null;

      const nonHtmlPattern = /\\.(pdf|docx?|xlsx?|pptx?|csv|rtf|zip|rar|7z|tar|gz|jpe?g|png|gif|svg|webp|ico|bmp|tiff?|mp4|mp3|wav|avi|mov|webm|ogg|woff2?|ttf|eot|xml|json)(\\?|#|$)/i;
      const internalLinks = [];
      const externalLinks = [];
      const nonFunctionalHrefs = [];
      const seenLinks = new Set();
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (!href) continue;
        let protocol;
        try { protocol = new URL(href, document.baseURI).protocol; } catch { protocol = null; }
        if (protocol !== "http:" && protocol !== "https:") {
          const isBenign = protocol === "mailto:" || protocol === "tel:" || protocol === "sms:" || href.startsWith("#");
          if (!isBenign && nonFunctionalHrefs.length < 20) nonFunctionalHrefs.push(href);
          continue;
        }
        const full = abs(href);
        if (!full || seenLinks.has(full)) continue;
        seenLinks.add(full);
        if (nonHtmlPattern.test(full)) continue;
        try {
          const host = new URL(full).host.replace(/^www\\./, "");
          const root = rootHost.replace(/^www\\./, "");
          if (host === root) internalLinks.push(full);
          else externalLinks.push(full);
        } catch {}
      }

      const navLabels = [];
      const navRoots = document.querySelectorAll("header a, nav a, [role='navigation'] a");
      for (const a of navRoots) {
        const t = (a.textContent || "").replace(/\\s+/g, " ").trim();
        if (t && t.length < 48) navLabels.push(t);
      }
      const counts = {};
      for (const l of navLabels) counts[l] = (counts[l] || 0) + 1;
      const duplicateNavLabels = Object.keys(counts).filter((k) => counts[k] >= 2 && !/^(en|ar|fr|de)$/i.test(k));

      const cmsLeftovers = [];
      const leftoverNeedles = ${JSON.stringify(CMS_LEFTOVER_PATTERNS)};
      for (const needle of leftoverNeedles) {
        if (bodyText.includes(needle) || (document.documentElement.innerHTML || "").includes(needle)) cmsLeftovers.push(needle.trim());
      }

      const iframeSrcs = [];
      for (const f of document.querySelectorAll("iframe[src]")) {
        const src = f.getAttribute("src");
        if (src) iframeSrcs.push(src);
      }
      const gatingRe = /please accept (functional )?cookies to see this content/i;
      const cookieGatingCopy = gatingRe.test(bodyText);
      const iframeGatedCount = [...document.querySelectorAll("iframe")].filter((f) => {
        const parent = f.parentElement;
        return parent && gatingRe.test(parent.innerText || "");
      }).length;

      const cookieBannerVisible = !!(
        document.querySelector("#onetrust-banner-sdk, #onetrust-consent-sdk, #CybotCookiebotDialog, .osano-cm-window") ||
        /cookie settings|we use cookies|accept cookies/i.test(bodyText.slice(0, 2500))
      );

      const chatWidget = !!(
        document.querySelector("[class*='chat-widget'], [id*='chat-widget'], iframe[src*='intercom'], iframe[src*='tawk']") ||
        /NEED HELP\\?/i.test(bodyText)
      );

      const search = document.querySelector("input[type='search'], input[name='q'], input[placeholder*='earch' i], input[placeholder*='eyword' i]");
      const searchPlaceholder = search ? (search.getAttribute("placeholder") || null) : null;

      let emptyAltCount = 0;
      let imageCount = 0;
      for (const img of document.querySelectorAll("img")) {
        imageCount += 1;
        const alt = img.getAttribute("alt");
        if (alt === null || alt.trim() === "") emptyAltCount += 1;
      }

      const isClientRendered =
        document.querySelectorAll("script").length > 3 && document.body.children.length < 12 && wordCount < 80;

      const knownGlobalNames = ["dataLayer","gtag","ga","fbq","_hjSettings","hj","Intercom","drift","zE","Tawk_API","LiveChatWidget","OneTrust","Cookiebot","Osano","clarity","ttq","snaptr","lintrk"];
      const detectedGlobals = [];
      for (const name of knownGlobalNames) {
        try { if (typeof window[name] !== "undefined") detectedGlobals.push(name); } catch {}
      }

      return {
        title, metaDescription, h1Text, canonical, wordCount, htmlLang, htmlDir,
        internalLinks, externalLinks, nonFunctionalHrefs, isClientRendered, detectedGlobals,
        duplicateNavLabels, cmsLeftovers, iframeSrcs, iframeGatedCount, cookieGatingCopy,
        cookieBannerVisible, chatWidget, searchPlaceholder, emptyAltCount, imageCount, navLabels: navLabels.slice(0, 40),
        visibleTextSample: bodyText.slice(0, 1800),
      };
    })()`;
}
var AXE_SCRIPT = `(async () => {
  const results = await axe.run(document, { resultTypes: ["violations"] });
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact || "minor",
    description: v.help,
    nodesCount: v.nodes.length,
  }));
})()`;
async function dismissCookies(page) {
	for (const sel of COOKIE_CLICK_SELECTORS) {
		const loc = page.locator(sel).first();
		if (await loc.count()) try {
			if (await loc.isVisible({ timeout: 400 })) {
				await loc.click({ timeout: 1500 });
				return true;
			}
		} catch {}
	}
	for (const label of COOKIE_TEXT_BUTTONS) {
		const loc = page.getByRole("button", {
			name: label,
			exact: false
		}).first();
		try {
			if (await loc.isVisible({ timeout: 300 })) {
				await loc.click({ timeout: 1500 });
				return true;
			}
		} catch {}
	}
	return false;
}
async function settleJavascript(page) {
	const started = Date.now();
	try {
		await page.waitForLoadState("networkidle", { timeout: 4500 });
	} catch {}
	try {
		await page.evaluate(async () => {
			window.scrollTo(0, Math.min(document.body.scrollHeight * .45, 1400));
			await new Promise((r) => setTimeout(r, 350));
			window.scrollTo(0, 0);
		});
	} catch {}
	try {
		await page.waitForFunction(() => (document.body?.innerText || "").trim().split(/\s+/).length > 40, { timeout: 2500 });
	} catch {}
	return Date.now() - started;
}
async function renderOnePage(page, url, rootHost) {
	const started = Date.now();
	try {
		let response;
		try {
			response = await page.goto(url, {
				waitUntil: "domcontentloaded",
				timeout: 28e3
			});
		} catch {
			response = await page.goto(url, {
				waitUntil: "commit",
				timeout: 18e3
			});
		}
		await page.waitForTimeout(900);
		const wordCountBeforeConsent = await page.evaluate(() => (document.body?.innerText || "").trim().split(/\s+/).filter(Boolean).length);
		const cookieDismissed = await dismissCookies(page);
		if (cookieDismissed) await page.waitForTimeout(700);
		const hydrationWaitedMs = await settleJavascript(page);
		const extracted = await page.evaluate(buildExtractionScript(rootHost));
		let accessibilityViolations = [];
		try {
			await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js" });
			accessibilityViolations = await page.evaluate(AXE_SCRIPT);
		} catch {
			accessibilityViolations = [];
		}
		const signals = {
			htmlLang: extracted.htmlLang ?? null,
			htmlDir: extracted.htmlDir ?? null,
			cookieBannerVisible: Boolean(extracted.cookieBannerVisible),
			cookieGatingCopy: Boolean(extracted.cookieGatingCopy),
			cookieDismissed,
			iframeSrcs: extracted.iframeSrcs ?? [],
			iframeGatedCount: Number(extracted.iframeGatedCount ?? 0),
			duplicateNavLabels: extracted.duplicateNavLabels ?? [],
			cmsLeftovers: extracted.cmsLeftovers ?? [],
			chatWidget: Boolean(extracted.chatWidget),
			searchPlaceholder: extracted.searchPlaceholder ?? null,
			emptyAltCount: Number(extracted.emptyAltCount ?? 0),
			imageCount: Number(extracted.imageCount ?? 0),
			navLabels: extracted.navLabels ?? [],
			hydrationWaitedMs,
			wordCountBeforeConsent
		};
		return {
			url,
			finalUrl: page.url(),
			statusCode: response ? response.status() : null,
			responseTimeMs: Date.now() - started,
			depth: 0,
			title: extracted.title ?? null,
			metaDescription: extracted.metaDescription ?? null,
			h1Text: extracted.h1Text ?? null,
			canonical: extracted.canonical ?? null,
			wordCount: Number(extracted.wordCount ?? 0),
			htmlLang: extracted.htmlLang ?? null,
			isClientRendered: Boolean(extracted.isClientRendered),
			internalLinks: extracted.internalLinks ?? [],
			externalLinks: extracted.externalLinks ?? [],
			accessibilityViolations,
			detectedGlobals: extracted.detectedGlobals ?? [],
			nonFunctionalHrefs: extracted.nonFunctionalHrefs ?? [],
			error: null,
			signals,
			visibleTextSample: String(extracted.visibleTextSample ?? "")
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
			isClientRendered: false,
			internalLinks: [],
			externalLinks: [],
			accessibilityViolations: [],
			detectedGlobals: [],
			nonFunctionalHrefs: [],
			error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
			signals: {
				htmlLang: null,
				htmlDir: null,
				cookieBannerVisible: false,
				cookieGatingCopy: false,
				cookieDismissed: false,
				iframeSrcs: [],
				iframeGatedCount: 0,
				duplicateNavLabels: [],
				cmsLeftovers: [],
				chatWidget: false,
				searchPlaceholder: null,
				emptyAltCount: 0,
				imageCount: 0,
				navLabels: [],
				hydrationWaitedMs: 0,
				wordCountBeforeConsent: 0
			},
			visibleTextSample: ""
		};
	}
}
async function loadRobots(startUrl) {
	try {
		const res = await fetch(new URL("/robots.txt", startUrl).toString(), { signal: AbortSignal.timeout(4e3) });
		return res.ok ? await res.text() : "";
	} catch {
		return "";
	}
}
function robotsAllows(robotsTxt, url) {
	if (!robotsTxt) return true;
	const path = new URL(url).pathname;
	return !robotsTxt.split("\n").map((l) => l.trim()).filter((l) => l.toLowerCase().startsWith("disallow:")).some((line) => {
		const rule = line.split(":").slice(1).join(":").trim();
		return rule && path.startsWith(rule);
	});
}
async function discoverSitemapUrls(startUrl, cap) {
	try {
		const res = await fetch(new URL("/sitemap.xml", startUrl).toString(), { signal: AbortSignal.timeout(6e3) });
		if (!res.ok) return [];
		const locs = [...(await res.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
		const host = urlHost(startUrl);
		return locs.filter((u) => urlHost(u) === host && !isLikelyNonHtmlResource(u)).slice(0, cap);
	} catch {
		return [];
	}
}
async function crawlSite(options) {
	const { startUrl: rawStartUrl, maxPages, maxDepth, respectRobots, concurrency } = options;
	const startUrl = normalizeCrawlUrl(rawStartUrl);
	const rootHost = urlHost(startUrl);
	const robotsTxt = respectRobots ? await loadRobots(startUrl) : "";
	const seen = /* @__PURE__ */ new Set([startUrl]);
	const results = [];
	let queue = [{
		url: startUrl,
		depth: 0
	}];
	const sitemapUrls = await discoverSitemapUrls(startUrl, Math.min(80, maxPages));
	for (const raw of sitemapUrls) {
		const url = normalizeCrawlUrl(raw);
		if (queue.length + results.length >= maxPages) break;
		if (seen.has(url)) continue;
		seen.add(url);
		queue.push({
			url,
			depth: 1
		});
	}
	const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"] });
	const context = await browser.newContext({
		viewport: {
			width: 1440,
			height: 900
		},
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
		locale: "en-US",
		extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9,ar;q=0.4" }
	});
	try {
		while (queue.length > 0 && results.length < maxPages) {
			const batch = queue.slice(0, concurrency);
			queue = queue.slice(concurrency);
			const batchResults = await Promise.all(batch.map(async ({ url, depth }) => {
				if (respectRobots && !robotsAllows(robotsTxt, url)) return {
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
					isClientRendered: false,
					internalLinks: [],
					externalLinks: [],
					accessibilityViolations: [],
					detectedGlobals: [],
					nonFunctionalHrefs: [],
					error: "blocked_by_robots_txt",
					signals: {
						htmlLang: null,
						htmlDir: null,
						cookieBannerVisible: false,
						cookieGatingCopy: false,
						cookieDismissed: false,
						iframeSrcs: [],
						iframeGatedCount: 0,
						duplicateNavLabels: [],
						cmsLeftovers: [],
						chatWidget: false,
						searchPlaceholder: null,
						emptyAltCount: 0,
						imageCount: 0,
						navLabels: [],
						hydrationWaitedMs: 0,
						wordCountBeforeConsent: 0
					},
					visibleTextSample: ""
				};
				const page = await context.newPage();
				try {
					options.onProgress?.(results.length, queue.length, url);
					const result = await renderOnePage(page, url, rootHost);
					result.depth = depth;
					result.url = normalizeCrawlUrl(result.url);
					result.internalLinks = result.internalLinks.map(normalizeCrawlUrl);
					return result;
				} finally {
					await page.close();
				}
			}));
			for (const result of batchResults) {
				results.push(result);
				if (result.depth < maxDepth) for (const link of result.internalLinks) {
					const n = normalizeCrawlUrl(link);
					if (seen.has(n) || results.length + queue.length >= maxPages) continue;
					if (isLikelyNonHtmlResource(n)) continue;
					seen.add(n);
					queue.push({
						url: n,
						depth: result.depth + 1
					});
				}
			}
		}
	} finally {
		await browser.close();
	}
	return results;
}
//#endregion
export { crawlSite };
