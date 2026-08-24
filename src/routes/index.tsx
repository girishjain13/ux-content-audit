import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Globe, Loader2 } from "lucide-react";
import { listAuditsFn, startAuditFn } from "@/lib/audit/server";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("mediclinic.ae");
  const [maxPages, setMaxPages] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof listAuditsFn>>>([]);

  useEffect(() => {
    listAuditsFn().then(setRecent).catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await startAuditFn({ data: { url, maxPages } });
      await navigate({ to: "/report/$id", params: { id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the audit.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-5 py-10 md:py-16">
      <section className="grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-end">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">UX lead · content strategist</p>
          <h1 className="mt-3 max-w-[18ch] font-display text-[40px] leading-[1.08] font-medium tracking-[-0.03em] text-ink md:text-[52px]">
            Audits that wait for the JavaScript.
          </h1>
          <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink-muted">
            A headless browser renders the page, dismisses the cookie wall, lets the SPA hydrate, then scores conversion paths — not just title tags. Orphans are a ticket. A gated booking widget is a P0.
          </p>
        </div>
        <form onSubmit={onSubmit} className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_1px_0_rgba(28,25,21,0.04)] md:p-6">
          <label htmlFor="url" className="text-[12px] font-medium text-ink-muted">
            Website URL
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-[12px] border border-line bg-paper px-3">
            <Globe className="size-4 shrink-0 text-ink-faint" />
            <input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
              autoComplete="url"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[13px] text-ink-muted">
              Pages
              <select
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="h-9 rounded-[8px] border border-line bg-surface px-2 text-[13px] text-ink"
              >
                <option value={5}>5 — smoke</option>
                <option value={8}>8 — focused</option>
                <option value={12}>12 — standard</option>
                <option value={20}>20 — deeper</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-ink px-4 text-[14px] font-medium text-paper transition hover:bg-ink/90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              {busy ? "Starting…" : "Run live crawl"}
            </button>
          </div>
          {error ? <p className="mt-3 text-[13px] text-coral">{error}</p> : null}
          <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
            Live crawls use Playwright: cookie dismiss, network settle, lazy-load scroll, iframe and CMP detection. Cap is small so a run finishes in this preview.
          </p>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { k: "01", t: "Render, don’t fetch", d: "Chromium executes the page. SPAs, AEM teaser carousels, and OneTrust walls are visible to the audit." },
          { k: "02", t: "Score like a lead", d: "Accessibility is severity-weighted, not binary. SEO counts duplicate titles. Next sprint is conversion, not two orphans." },
          { k: "03", t: "Journeys with proof", d: "Path-aware matching. A news story titled “unit opening” is not a job listing. Weak matches stay weak." },
        ].map((c) => (
          <article key={c.k} className="rounded-[20px] border border-line bg-surface p-5">
            <p className="font-mono text-[11px] text-accent">{c.k}</p>
            <h2 className="mt-2 font-display text-[20px] font-medium">{c.t}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{c.d}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="font-display text-[22px] font-medium">Reports</h2>
          <p className="text-[13px] text-ink-muted">Sample is the Mediclinic.ae review, rescored with the new engine.</p>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
          {recent.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                onClick={() => navigate({ to: "/report/$id", params: { id: j.id } })}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-paper-2/60"
              >
                <div>
                  <p className="text-[15px] font-medium">{j.host}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                    {j.id === "sample-mediclinic" ? "Sample · JS-aware rescore" : j.status}
                    {j.crawled ? ` · ${j.crawled} pages` : ""}
                  </p>
                </div>
                <span className="font-display text-[22px] tabular-nums">
                  {j.score != null ? j.score : "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
