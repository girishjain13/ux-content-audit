import { classifyPage, type PageClassification } from "./pageClassifier.js";

/**
 * SECURITY NOTE, read before wiring this into a workflow input: this
 * must be driven by a GitHub repo/environment SECRET
 * (Settings → Secrets and variables → Actions → New repository secret,
 * named ANTHROPIC_API_KEY), never by a plain workflow_dispatch text
 * input. GitHub automatically redacts secret values from all logs;
 * workflow_dispatch inputs are NOT masked the same way and would be
 * visible to anyone who can see this repo's Actions run history — on a
 * public repo, that's anyone. The launcher page only exposes a
 * checkbox to turn this on/off; it never collects or transmits a key
 * itself.
 *
 * Runs are capped (default 100 pages) specifically because "classify
 * every page" combined with a real API call per page can add up in
 * cost fast on a large crawl — pages beyond the cap silently fall back
 * to the free rule-based classifier in lib/pageClassifier.ts, and this
 * is logged clearly so a run's console output makes it obvious what
 * happened, rather than the person guessing why some pages look
 * different from others in the report.
 */

const PROMPT_TEMPLATE = `You are an expert Frontend Architect and CMS Migration Specialist. Your task is to analyze the crawled DOM, layout structure, and visual hierarchy of the provided webpage to classify its Page Template and extract all individual Components, applying standard design-system naming conventions.

### 1. Template Classification
Analyze the overall grid, global layout, and content arrangement to assign a standard template type:
- Identify layout zones (e.g., Header, Main Content, Sidebar, Footer, Floating Elements).
- Classify the page into a standard archetype (e.g., Homepage, Article Detail, Category Listing, Product Detail, Standard Content).

### 2. Component Identification & Boundary Detection
Scan the page structure to isolate distinct, reusable content blocks:
- Identify recurring container patterns, semantic HTML sections (<section>, <article>, <aside>), and repeated CSS class modules.
- Segment nested elements into primary components and sub-elements.

### 3. Component Naming & Element Standardization
Assign standardized, descriptive names to components based on their structural composition and internal UI elements. For repeated container patterns (such as Cards, Teasers, or Tiles), construct names using the formula:
[Context/Function] + [Primary Content Elements] + [Base Pattern]

Element mapping rules:
- Card with Image + Eyebrow + Title + Excerpt + Button -> "Editorial Teaser Card"
- Card with Icon + Title + Body Text -> "Feature Icon Card"
- Card with Image + Title + Price + Rating + CTA -> "Product Summary Card"
- Card with Avatar + Quote Text + Author Name + Role -> "Testimonial Card"
- Media Object with Video Thumbnail + Play Icon + Title + Duration -> "Video Media Card"
- Anything else: construct a reasonable name using the same formula.

### 4. Output Schema (JSON)
Return ONLY valid JSON, no prose, no markdown fences, matching exactly:
{
  "url": "<URL>",
  "template": {
    "name": "<Standard Template Name>",
    "confidence_score": 0.0-1.0,
    "layout_grid": "<e.g., 1-column, 2-column sidebar-right, 12-col fluid>"
  },
  "components": [
    {
      "standard_name": "<Standardized Component Name>",
      "type": "<e.g., Hero, Card Grid, Accordion, Carousel, CTA Banner>",
      "dom_selector": "<CSS selector>",
      "detected_elements": ["<e.g., eyebrow, heading, body-copy, primary-button, thumbnail-image>"],
      "instance_count": 1,
      "reusability_score": "<High | Medium | Low>"
    }
  ]
}

URL: {{URL}}

HTML (truncated):
{{HTML}}`;

let aiCallCount = 0;

export function aiClassificationAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function classifyPageWithAi(html: string, url: string, maxAiPages: number): Promise<PageClassification> {
  if (!aiClassificationAvailable()) return classifyPage(html, url);

  if (aiCallCount >= maxAiPages) {
    console.log(`[aiPageClassifier] AI page cap (${maxAiPages}) reached — falling back to rule-based for ${url}`);
    return classifyPage(html, url);
  }
  aiCallCount++;

  const truncatedHtml = html.slice(0, 15_000);
  const prompt = PROMPT_TEMPLATE.replace("{{URL}}", url).replace("{{HTML}}", truncatedHtml);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn(`[aiPageClassifier] Anthropic API returned ${res.status} for ${url} — falling back to rule-based.`);
      return classifyPage(html, url);
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    if (!text) return classifyPage(html, url);

    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned) as {
      url: string;
      template: { name: string; confidence_score: number; layout_grid: string };
      components: { standard_name: string; type: string; dom_selector: string; detected_elements: string[]; instance_count: number; reusability_score: string }[];
    };

    return {
      url: parsed.url || url,
      template: {
        name: parsed.template.name,
        confidenceScore: parsed.template.confidence_score,
        layoutGrid: parsed.template.layout_grid,
        zones: [],
      },
      components: (parsed.components ?? []).map((c) => ({
        standardName: c.standard_name,
        type: c.type,
        domSelector: c.dom_selector,
        detectedElements: c.detected_elements ?? [],
        instanceCount: c.instance_count ?? 1,
      })),
    };
  } catch (err) {
    console.warn(`[aiPageClassifier] AI classification failed for ${url}, falling back to rule-based:`, err instanceof Error ? err.message : err);
    return classifyPage(html, url);
  }
}
