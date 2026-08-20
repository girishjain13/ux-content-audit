# UX Lead & Content Strategist Audit — Static / GitHub Actions Edition

A website heuristic-audit tool that crawls a site with a real headless browser and produces a
static report, published to GitHub Pages. No server, no database, no external services beyond
GitHub itself — this is the sibling repo to a Business Analyst-focused audit tool; each runs its
own independent crawl.

## Why this architecture

The original version of this tool ran on Vercel with a serverless-function pipeline
(QStash queue, Redis, Neon Postgres, Vercel Blob, a remote browser-rendering service). That
stack works, but accumulates real operational overhead: rate limits, multiple services each
needing their own credentials, and several classes of bugs specific to coordinating many
short-lived stateless functions.

This version trades some of that stack's scalability for **radical simplicity**: one GitHub
Actions job runs the entire crawl and analysis as a single long-lived Node process, using
Playwright to launch its own local Chromium (no remote browser service needed), an in-memory
`Set`/array for the crawl queue (no external queue needed), and writes its output straight to
static files (no database needed). GitHub Pages then just serves those files.

**Tradeoff:** GitHub Actions jobs have a maximum runtime (6 hours on the free tier, generous for
this use case) and the whole crawl happens in one process — there's no resumability if it's
interrupted partway through. For the page-count ranges this kind of audit typically covers,
that's a reasonable tradeoff for not needing five different paid services.

## Setup

1. **Enable GitHub Pages with "GitHub Actions" as the source** — repo Settings → Pages → under
   "Build and deployment", set Source to **GitHub Actions** (not a branch). This is required for
   the `deploy-pages` step in the workflow to work.
2. That's it — no environment variables, no external accounts needed for the tool itself.

## Running an audit — two ways

### Option A: from the front-end launcher (recommended)

Visit `https://<your-username>.github.io/<repo-name>/` — this is the launcher page
(`docs/index.html`), a real form that triggers the workflow directly via GitHub's own REST API,
no need to navigate the Actions tab manually.

You'll need a **GitHub Personal Access Token** with the `Actions: Read and write` permission on
this repo (a fine-grained token scoped to just this one repo is the safest option — create one
at [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)).
Paste it into the form once — it's saved in your browser's local storage so you don't need to
re-enter it every time, and it's never sent anywhere except directly to GitHub's own API from
your browser.

Fill in the site URL (required) and optionally client name / max pages (up to 5,000) / max depth
/ client-stated page count, then click **Start Audit**. Use **Check latest run status** to poll
progress without leaving the page, or watch the live log in the Actions tab as before.

Once finished, the report is at `https://<your-username>.github.io/<repo-name>/report.html` — the
launcher page has a direct link to it.

### Option B: directly from the Actions tab (no token needed)

1. Go to the repo's **Actions** tab → **"Run UX & Content Audit"** → **Run workflow**
2. Fill in the inputs, click **Run workflow**
3. Once finished, the report is at the same `report.html` URL as above

Each run **overwrites** the previous report (`report.html`), but the launcher page
(`index.html`) itself is never touched by a crawl run — only committed changes to that file
change it. If you want to keep history across multiple audits, adapt the workflow to write to a
dated subfolder instead.

## What's included vs. the original Vercel version

Ported essentially unchanged (all pure functions, no framework coupling):
`templates.ts`, `components.ts`, `reportAnalysis.ts` (keywords, near-duplicate detection,
integrations classification, readability), `techFingerprint.ts`, `urlHealth.ts`, `freshness.ts`,
`locale.ts`, `media.ts`, `journey.ts`, `variance.ts`, `scoring.ts`, `narrative.ts`, `quadrant.ts`,
`metaCompleteness.ts`, `formDetection.ts`, `featureMatrix.ts`, `externalLinkHealth.ts`,
`urlFilters.ts`, `sitemap.ts`.

Rebuilt for this architecture: `crawler.ts` (Playwright directly instead of Browserless, with
axe-core injected the same way for accessibility scanning), `robots.ts` (in-memory cache instead
of Redis — this is one process, not many stateless functions), the analysis orchestration
(`scripts/analyze.ts` — same detection logic as the Vercel app's `analyze` route, reading from
an in-memory array instead of a database), and the report itself (plain HTML template literals
instead of a React/Tailwind app, since this needs to be a static file).

## Honest limitations, unchanged from the original

- Redirect chain/loop tracking is **not built** — Chromium only exposes the final response after
  following redirects, not each hop.
- Real Core Web Vitals are **not built** — would need a Lighthouse/PageSpeed Insights API call
  per page, a separate integration with its own cost/latency.
- SSL certificate status/expiry is **not built** — needs a real TLS handshake, not HTML
  inspection.
- Near-duplicate detection is capped at 300 pages (O(n²) shingling comparison) — fine for
  typical audit sizes, not built to scale to very large sites.
- Journey mapping is pure keyword matching against URLs/titles — **not real behavioral data**.
- All analysis is deliberately rule-based, not AI-judgment-based — this was an explicit decision
  during the original build.
- External link health checks are capped at the 30 most-linked external URLs, to keep the whole
  job's runtime reasonable.

## Scaling to very large sites (1,000+ pages)

Since this runs as one process for the whole crawl, very large sites will take
correspondingly longer — there's no distributed concurrency across multiple machines the way
the serverless version could (in principle) achieve. The `concurrency` setting controls how many
pages render in parallel within this one process; raising it helps up to a point, limited by the
runner's CPU/memory. This hasn't been tested at true 10,000-page scale — if you hit GitHub
Actions' 6-hour job timeout on a very large site, the crawl will need to be split into multiple
runs (e.g., by URL prefix) rather than one single invocation.
