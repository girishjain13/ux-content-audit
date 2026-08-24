import { Link } from "@tanstack/react-router";
import type { AuditReport, Finding, Severity } from "@/lib/audit/types";
import { cn } from "@/lib/utils";

const SEV: Record<Severity, string> = {
  critical: "bg-coral/15 text-coral",
  high: "bg-accent/12 text-accent",
  medium: "bg-amber/12 text-amber",
  low: "bg-ink/8 text-ink-muted",
};

const PILLAR_HELP = {
  ia: "Orphans + CMS leftovers. Click-depth is a light signal, not a 3-click rule.",
  content: "Duplicates weighted above thin pages. Word count is not aesthetics.",
  a11y: "Severity-weighted, floored at 18. A minor contrast nit on every page cannot zero the score.",
  seo: "Missing titles, meta, canonicals — and reused titles. Duplicate titles used to hide in a 98.",
};

function ScoreTile({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint: string;
}) {
  const tone = value >= 80 ? "text-sage" : value >= 60 ? "text-amber" : "text-coral";
  return (
    <div className="rounded-[20px] border border-line bg-surface p-4">
      <p className={cn("font-display text-[32px] leading-none tabular-nums", tone)}>{value}</p>
      <p className="mt-2 text-[13px] font-medium">{label}</p>
      <p className="mt-1 text-[12px] leading-snug text-ink-faint">{hint}</p>
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  return (
    <article className="rounded-[16px] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] tracking-wide text-paper uppercase">
          {f.sprintPriority}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] uppercase", SEV[f.severity])}>
          {f.severity}
        </span>
        <span className="text-[12px] text-ink-faint">{f.affectedPageCount} pages</span>
      </div>
      <h3 className="mt-2 text-[15px] font-medium leading-snug">{f.title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{f.description}</p>
      {f.affectedUrlsSample.length ? (
        <ul className="mt-2 space-y-0.5">
          {f.affectedUrlsSample.slice(0, 4).map((u) => (
            <li key={u} className="truncate font-mono text-[11px] text-ink-faint">
              {u}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function ReportView({ report }: { report: AuditReport }) {
  const p0 = report.findings.filter((f) => f.sprintPriority === "P0");
  const rest = report.findings.filter((f) => f.sprintPriority !== "P0");

  return (
    <article className="mx-auto w-full max-w-6xl px-5 py-8 pb-20">
      <p className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
        {report.isSample ? "Sample · JS-aware rescore" : "Live crawl"} · {report.pageCount} pages · {report.durationSeconds}s
      </p>
      <h1 className="mt-2 break-all font-display text-[32px] leading-tight font-medium tracking-tight md:text-[40px]">
        {report.host}
      </h1>
      <p className="mt-2 text-[14px] text-ink-muted">{report.startUrl}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-[20px] border border-ink bg-ink p-4 text-paper sm:col-span-2 lg:col-span-1">
          <p className="font-display text-[36px] leading-none tabular-nums">{report.scorecard.uxMaturityScore}</p>
          <p className="mt-2 text-[13px]">{report.scorecard.uxMaturityBand}</p>
          <p className="mt-1 text-[12px] text-paper/60">Overall · conversion-capped</p>
        </div>
        <ScoreTile value={report.scorecard.iaHealthScore} label="Information architecture" hint={PILLAR_HELP.ia} />
        <ScoreTile value={report.scorecard.contentQualityScore} label="Content quality" hint={PILLAR_HELP.content} />
        <ScoreTile value={report.scorecard.accessibilityScore} label="Accessibility" hint={PILLAR_HELP.a11y} />
        <ScoreTile value={report.scorecard.seoScore} label="SEO / findability" hint={PILLAR_HELP.seo} />
      </div>

      <section className="mt-10 grid gap-3 sm:grid-cols-5">
        {[
          ["Cookie banners", report.crawlMeta.cookieBanners],
          ["Cookie-gated", report.crawlMeta.cookieGatedPages],
          ["Banners dismissed", report.crawlMeta.cookiesDismissed],
          ["Hydration waits", report.crawlMeta.spaHydrationPages],
          ["JS-heavy pages", report.crawlMeta.jsHeavyPages],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-[16px] border border-line bg-paper-2/50 px-4 py-3">
            <p className="font-display text-[22px] tabular-nums">{v}</p>
            <p className="text-[12px] text-ink-muted">{k}</p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[24px] font-medium">In plain terms</h2>
        <ul className="mt-4 space-y-2">
          {report.plainTerms.map((t) => (
            <li key={t} className="border-l-2 border-accent/40 pl-4 text-[15px] leading-relaxed text-ink-muted">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[24px] font-medium">UX lead’s read</h2>
        <div className="mt-4 space-y-4">
          {report.uxLeadAssessment.map((p) => (
            <p key={p} className="max-w-3xl text-[15.5px] leading-relaxed text-ink">
              {p}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[24px] font-medium">Where to start next sprint</h2>
        <ol className="mt-4 space-y-2">
          {report.nextSprint.map((s) => (
            <li key={s} className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[14px] leading-snug">
              {s}
            </li>
          ))}
        </ol>
      </section>

      {p0.length ? (
        <section className="mt-12">
          <h2 className="font-display text-[24px] font-medium">P0 — conversion and access</h2>
          <p className="mt-1 text-[13px] text-ink-muted">These outrank orphans. Fix them before a content cleanup.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {p0.map((f) => (
              <FindingCard key={f.id} f={f} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display text-[24px] font-medium">All findings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {rest.map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[24px] font-medium">Nielsen heuristics</h2>
        <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">
          Five of ten still need a human on real flows. The rest are wired to findings that a rendered crawl can actually see.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {report.heuristics.map((h) => (
            <div key={h.id} className="rounded-[16px] border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[14px] font-medium">{h.name}</h3>
                <span className="shrink-0 font-mono text-[10px] text-ink-faint uppercase">{h.status}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">{h.description}</p>
              {h.notAssessedReason ? (
                <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{h.notAssessedReason}</p>
              ) : null}
              {h.bullets.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-ink">
                  {h.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="font-display text-[24px] font-medium">Feature matrix</h2>
          <p className="mt-1 text-[13px] text-ink-muted">Rendered DOM + nav labels + iframe srcs — not URL regex alone.</p>
          <ul className="mt-4 divide-y divide-line rounded-[16px] border border-line bg-surface">
            {report.featureMatrix.map((f) => (
              <li key={f.feature} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                <span>{f.feature}</span>
                <span className={f.detected ? "font-medium text-sage" : "text-ink-faint"}>
                  {f.detected ? `Yes · ${f.pagesFoundOn}` : "No"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-[24px] font-medium">Journeys</h2>
          <p className="mt-1 text-[13px] text-ink-muted">Strong matches require the URL path. Title-only hits stay weak.</p>
          <div className="mt-4 space-y-3">
            {report.journeys.map((j) => (
              <div key={j.id} className="rounded-[16px] border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[14px] font-medium">{j.name}</h3>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {j.stagesPresent}/{j.stagesTotal} strong
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {j.stages.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-2 text-[12.5px]">
                      <span className="text-ink-muted">{s.name}</span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[10px] uppercase",
                          s.confidence === "strong" ? "text-sage" : s.confidence === "weak" ? "text-amber" : "text-ink-faint",
                        )}
                      >
                        {s.confidence}
                      </span>
                    </li>
                  ))}
                </ul>
                {j.notes[0] ? <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{j.notes[0]}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[24px] font-medium">Pages in this crawl</h2>
        <div className="mt-4 overflow-x-auto rounded-[16px] border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-line text-[11px] tracking-wide text-ink-faint uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">URL</th>
                <th className="px-4 py-2 font-medium">H1</th>
                <th className="px-4 py-2 font-medium">Words</th>
                <th className="px-4 py-2 font-medium">Depth</th>
              </tr>
            </thead>
            <tbody>
              {report.pages.map((p) => (
                <tr key={p.url} className="border-b border-line/70 last:border-0">
                  <td className="max-w-[320px] truncate px-4 py-2 font-mono text-[11px]">{p.url}</td>
                  <td className="px-4 py-2 text-ink-muted">{p.h1Text || "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{p.wordCount}</td>
                  <td className="px-4 py-2 tabular-nums">{p.depth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-10 text-[13px] text-ink-faint">
        <Link to="/" className="text-accent underline-offset-2 hover:underline">
          New audit
        </Link>
        {report.crawlMeta.truncated ? " · Crawl hit the page cap — IA completeness is a sample." : null}
      </p>
    </article>
  );
}
