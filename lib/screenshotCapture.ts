import { chromium } from "playwright";

/**
 * Deliberately a separate, second pass rather than screenshotting every
 * page during the main crawl — capturing a screenshot for every one of
 * potentially thousands of pages would meaningfully slow the crawl and
 * bloat storage for images almost nobody would look at. Instead, this
 * runs after analysis has already determined which URLs are the
 * "example" page for each unique template/component — a much smaller,
 * bounded set (capped further below) — and screenshots only those.
 */
export async function captureScreenshots(urls: string[], maxScreenshots = 60): Promise<Map<string, Buffer>> {
  const unique = [...new Set(urls)].slice(0, maxScreenshots);
  const results = new Map<string, Buffer>();
  if (unique.length === 0) return results;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  try {
    for (const url of unique) {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        const buffer = await page.screenshot({ type: "png" });
        results.set(url, buffer);
      } catch (err) {
        console.warn(`Screenshot failed for ${url}:`, err instanceof Error ? err.message : err);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
