import type { Element } from "domhandler";
import * as cheerio from "cheerio";

/**
 * Replaces the old structural-fingerprint approach (lib/templates.ts,
 * lib/components.ts — now unused) with genuinely semantic classification:
 * naming a component "Testimonial Card" because it has an avatar, quote,
 * and author name, rather than just hashing its tag/class shape. Runs
 * on every page. Purely rule-based — detects specific structural
 * signals and matches them against a naming table. An optional,
 * separately-gated AI path (lib/aiPageClassifier.ts) can do a genuinely
 * more nuanced version of this same job if ANTHROPIC_API_KEY is
 * configured; this file is what runs otherwise, and what every AI call
 * falls back to on failure.
 */

export type TemplateClassification = {
  name: string;
  confidenceScore: number;
  layoutGrid: string;
  zones: string[];
};

export type ComponentInstance = {
  standardName: string;
  type: string;
  domSelector: string;
  detectedElements: string[];
  instanceCount: number;
};

export type PageClassification = {
  url: string;
  template: TemplateClassification;
  components: ComponentInstance[];
};

const CANDIDATE_CONTAINER_TAGS = ["div", "article", "li", "section"];
const PRICE_PATTERN = /[$€£₹]\s?\d+(\.\d{1,2})?|\d+(\.\d{1,2})?\s?(USD|EUR|GBP|INR)/i;
const DURATION_PATTERN = /\b\d{1,2}:\d{2}\b|\b\d+\s?(min|minutes|sec|seconds)\b/i;
const RATING_PATTERN = /\b[0-5](\.\d)?\s?\/\s?5\b|\bstar/i;

function detectElementsIn($: cheerio.CheerioAPI, el: Element): string[] {
  const $el = $(el);
  const elements: string[] = [];
  const text = $el.text().trim();
  const classAndId = `${$el.attr("class") ?? ""} ${$el.attr("id") ?? ""}`.toLowerCase();

  const heading = $el.find("h1,h2,h3,h4,h5,h6").first();
  if (heading.length) elements.push("heading");

  const img = $el.find("img").first();
  if (img.length) {
    const imgClass = (img.attr("class") ?? "").toLowerCase();
    const imgAlt = (img.attr("alt") ?? "").toLowerCase();
    if (/avatar|profile|headshot/.test(imgClass) || /avatar|profile|headshot/.test(imgAlt)) {
      elements.push("avatar");
    } else if (/video|play|thumb/.test(imgClass)) {
      elements.push("video-thumbnail");
    } else {
      elements.push("thumbnail-image");
    }
  }
  if ($el.find("svg").length && !img.length) elements.push("icon");
  if (/\bicon\b/.test(classAndId) && !elements.includes("icon") && !elements.includes("avatar")) elements.push("icon");

  if ($el.find("video").length || $el.find('[class*="play"]').length || /play/.test(classAndId)) elements.push("play-icon");

  const eyebrowCandidate = $el.children().first();
  const eyebrowText = eyebrowCandidate.text().trim();
  if (
    eyebrowText &&
    eyebrowText.length < 30 &&
    !eyebrowCandidate.is("h1,h2,h3,h4,h5,h6,p,img") &&
    (/eyebrow|label|tag|category|kicker/.test((eyebrowCandidate.attr("class") ?? "").toLowerCase()) || eyebrowText === eyebrowText.toUpperCase())
  ) {
    elements.push("eyebrow");
  }

  const paragraphs = $el.find("p");
  if (paragraphs.length) {
    const firstP = paragraphs.first().text().trim();
    elements.push(firstP.length > 0 && firstP.length < 220 ? "excerpt" : "body-copy");
  }

  const button = $el.find('a.btn, a.button, button, a[class*="cta"], a[class*="btn"]').first();
  if (button.length) elements.push("primary-button");
  else if ($el.find("a").length === 1 && !$el.find("a").first().find("img").length) elements.push("link");

  if (PRICE_PATTERN.test(text)) elements.push("price");
  if (RATING_PATTERN.test(text) || $el.find('[class*="star"], [class*="rating"]').length) elements.push("rating");
  if (DURATION_PATTERN.test(text)) elements.push("duration");

  if ($el.is("blockquote") || /quote|testimonial/.test(classAndId) || /["""].{10,}["""]|^".{10,}"$/.test(text)) {
    elements.push("quote");
  }

  const cite = $el.find("cite, [class*='author'], [class*='name']").first();
  if (cite.length && elements.includes("avatar")) elements.push("author-name");
  const roleEl = $el.find("[class*='role'], [class*='title']:not(h1,h2,h3,h4,h5,h6)").first();
  if (roleEl.length && elements.includes("author-name")) elements.push("role");

  return [...new Set(elements)];
}

/**
 * Maps a detected element set to a standardized name using the given
 * lookup rules, falling back to a constructed
 * "[Context] + [Elements] + [Base Pattern]" name for anything that
 * doesn't exactly match one of the known archetypes.
 */
function nameComponent(elements: string[]): { name: string; type: string } {
  const has = (e: string) => elements.includes(e);

  if (has("thumbnail-image") && has("eyebrow") && has("heading") && has("excerpt") && has("primary-button")) {
    return { name: "Editorial Teaser Card", type: "Card" };
  }
  if (has("icon") && has("heading") && (has("body-copy") || has("excerpt")) && !has("thumbnail-image")) {
    return { name: "Feature Icon Card", type: "Card" };
  }
  if (has("thumbnail-image") && has("heading") && has("price") && has("rating")) {
    return { name: "Product Summary Card", type: "Card" };
  }
  if (has("avatar") && has("quote") && has("author-name")) {
    return { name: "Testimonial Card", type: "Card" };
  }
  if (has("video-thumbnail") && has("play-icon") && has("heading")) {
    return { name: "Video Media Card", type: "Media Object" };
  }

  // Fallback: construct a reasonable name from whatever was actually
  // detected, using the same [Context] + [Elements] + [Base Pattern]
  // formula rather than guessing at an archetype that wasn't matched.
  const base = has("primary-button") || has("link") ? "Card" : has("heading") ? "Content Block" : "Container";
  const contentPart = has("thumbnail-image") || has("video-thumbnail")
    ? "Image"
    : has("icon")
      ? "Icon"
      : has("quote")
        ? "Quote"
        : has("heading")
          ? "Heading"
          : "Text";
  return { name: `${contentPart} ${base}`, type: base };
}

function domSelectorFor($: cheerio.CheerioAPI, el: Element): string {
  const $el = $(el);
  const tag = (el as any).tagName ?? "div";
  const classes = ($el.attr("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 3);
  return classes.length ? `${tag}.${classes.join(".")}` : tag;
}

export function extractComponents(html: string): ComponentInstance[] {
  const $ = cheerio.load(html);
  const bodyText = $("body").text();
  const pageTextLen = Math.max(bodyText.length, 1);

  const counts = new Map<string, { count: number; elements: Set<string>; type: string; selector: string }>();

  for (const tag of CANDIDATE_CONTAINER_TAGS) {
    $(tag).each((_, el) => {
      const $el = $(el);
      const elTextLen = $el.text().trim().length;
      if (elTextLen === 0 || elTextLen / pageTextLen > 0.6) return; // skip empty or whole-page containers

      const elNode = el as Element;
      const detected = detectElementsIn($, elNode);
      if (detected.length < 2) return; // too sparse to be a meaningful "component"

      const selector = domSelectorFor($, elNode);
      const { name, type } = nameComponent(detected);
      const key = `${name}::${selector}`;

      if (!counts.has(key)) counts.set(key, { count: 0, elements: new Set(detected), type, selector });
      counts.get(key)!.count++;
    });
  }

  return [...counts.entries()].map(([key, data]) => ({
    standardName: key.split("::")[0],
    type: data.type,
    domSelector: data.selector,
    detectedElements: [...data.elements],
    instanceCount: data.count,
  }));
}

function detectZones($: cheerio.CheerioAPI): string[] {
  const zones: string[] = [];
  if ($("header, [class*='header']:not([class*='card'])").first().length) zones.push("Header");
  if ($("nav").first().length) zones.push("Navigation");
  if ($("main, [role='main'], article").first().length) zones.push("Main Content");
  if ($("aside, [class*='sidebar']").first().length) zones.push("Sidebar");
  if ($("footer, [class*='footer']").first().length) zones.push("Footer");
  if ($("[class*='sticky'], [class*='fixed'], [style*='position: fixed'], [style*='position:fixed']").length) {
    zones.push("Floating Elements");
  }
  return zones;
}

export function classifyTemplate(html: string, url: string): TemplateClassification {
  const $ = cheerio.load(html);
  const zones = detectZones($);
  const bodyText = $("body").text().trim();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  const hasArticleTag = $("article").length > 0;
  const hasDateByline = /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b(by\s+[A-Z])/i.test(bodyText);
  const priceCount = (bodyText.match(new RegExp(PRICE_PATTERN, "gi")) ?? []).length;
  const hasAddToCart = $('button, a').filter((_, el) => /add to cart|buy now|add-to-cart/i.test($(el).text())).length > 0;

  // Rough proxy for "dominant repeated grid": count of distinct sibling
  // groups sharing an identical tag+class signature, at size >= 4.
  const cardSignatureCounts = new Map<string, number>();
  $("div, article, li").each((_, el) => {
    const cls = ($(el).attr("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    if (!cls) return;
    const sig = `${(el as any).tagName}.${cls}`;
    cardSignatureCounts.set(sig, (cardSignatureCounts.get(sig) ?? 0) + 1);
  });
  const maxRepeat = Math.max(0, ...cardSignatureCounts.values());

  let path = "/";
  try {
    path = new URL(url).pathname;
  } catch {
    /* ignore */
  }
  const isRoot = path === "/" || path === "";

  let name = "Standard Content";
  let confidence = 0.4;

  if (priceCount >= 1 && hasAddToCart) {
    name = "Product Detail";
    confidence = hasAddToCart && priceCount >= 1 ? 0.8 : 0.5;
  } else if (maxRepeat >= 6 && wordCount < 2000) {
    name = "Category Listing";
    confidence = 0.7;
  } else if (hasArticleTag && hasDateByline && maxRepeat < 6) {
    name = "Article Detail";
    confidence = 0.8;
  } else if (isRoot && zones.length >= 3 && maxRepeat < 8) {
    name = "Homepage";
    confidence = 0.65;
  }

  const layoutGrid = zones.includes("Sidebar")
    ? "2-column, sidebar-right"
    : maxRepeat >= 4
      ? "multi-column grid"
      : "1-column";

  return { name, confidenceScore: Math.round(confidence * 100) / 100, layoutGrid, zones };
}

export function classifyPage(html: string, url: string): PageClassification {
  return {
    url,
    template: classifyTemplate(html, url),
    components: extractComponents(html),
  };
}
