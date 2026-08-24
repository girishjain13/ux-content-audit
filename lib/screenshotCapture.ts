import { chromium, type Page as PlaywrightPage } from "playwright";

/**
 * Screenshot targets are keyed uniquely per template/component row so
 * two entries that happen to share the same page URL do not reuse the
 * same full-page image. When a CSS selector is provided, the capture
 * clips to that element's bounding box (component-level shot).
 */

export type ScreenshotTarget = {
  /** Unique key used when looking up the image later (e.g. "template:Article Detail" or "component:Primary Nav"). */
  key: string;
  url: string;
  /** Optional CSS selector — when present, screenshot only that element. */
  selector?: string;
};

export async function captureScreenshots(
  targets: ScreenshotTarget[],
  maxScreenshots = 80,
): Promise<Map<string, Buffer>> {
  const results = new Map<string, Buffer>();
  if (targets.length === 0) return results;

  // Deduplicate by key (not by URL) — each row gets its own capture attempt
  const seenKeys = new Set<string>();
  const unique: ScreenshotTarget[] = [];
  for (const t of targets) {
    if (!t.key || !t.url || seenKeys.has(t.key)) continue;
    seenKeys.add(t.key);
    unique.push(t);
    if (unique.length >= maxScreenshots) break;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });

  try {
    for (const target of unique) {
      const page = await context.newPage();
      try {
        await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await Promise.race([
          page.waitForLoadState("networkidle"),
          page.waitForTimeout(4000),
        ]).catch(() => {});

        // Light cookie dismiss so banners don't dominate every shot
        await dismissCookieQuick(page);

        const buffer = await captureOne(page, target.selector);
        if (buffer) results.set(target.key, buffer);
      } catch (err) {
        console.warn(
          `Screenshot failed for ${target.key} (${target.url}):`,
          err instanceof Error ? err.message : err,
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

async function dismissCookieQuick(page: PlaywrightPage): Promise<void> {
  const selectors = [
    "#onetrust-accept-btn-handler",
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 400 })) {
        await btn.click({ timeout: 1000 });
        await page.waitForTimeout(300);
        return;
      }
    } catch {
      /* next */
    }
  }
}

async function captureOne(page: PlaywrightPage, selector?: string): Promise<Buffer | null> {
  if (selector) {
    try {
      const loc = page.locator(selector).first();
      if (await loc.count()) {
        await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        // Prefer element screenshot; fall back to clipped page region
        try {
          const buf = await loc.screenshot({ type: "png", timeout: 5000 });
          if (buf && buf.length > 500) return buf;
        } catch {
          /* fall through to clip */
        }
        const box = await loc.boundingBox();
        if (box && box.width > 8 && box.height > 8) {
          // Clamp to viewport-ish bounds for a usable crop
          const clip = {
            x: Math.max(0, box.x),
            y: Math.max(0, box.y),
            width: Math.min(box.width, 1280),
            height: Math.min(box.height, 800),
          };
          if (clip.width >= 8 && clip.height >= 8) {
            return await page.screenshot({ type: "png", clip });
          }
        }
      }
    } catch {
      /* fall through to full page */
    }
  }

  // Full-page viewport shot (not full scroll height — keeps file small)
  return await page.screenshot({ type: "png", fullPage: false });
}
