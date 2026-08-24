import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getAuditFn } from "@/lib/audit/server";
import { ReportView } from "@/components/report-view";
import type { AuditReport } from "@/lib/audit/types";

export const Route = createFileRoute("/report/$id")({ component: ReportPage });

function ReportPage() {
  const { id } = Route.useParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("queued");
  const [crawled, setCrawled] = useState(0);
  const [queued, setQueued] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const res = await getAuditFn({ data: { id } });
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setStatus(res.job.status);
        setCrawled(res.job.crawled);
        setQueued(res.job.queued);
        setCurrentUrl(res.job.currentUrl);
        setUrl(res.job.url);
        if (res.job.report) setReport(res.job.report);
        if (res.job.status === "error") setError(res.job.error || "Crawl failed.");
        if (res.job.status === "running" || res.job.status === "queued") {
          timer = setTimeout(tick, 1200);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load audit.");
      }
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (report) return <ReportView report={report} />;

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 text-center">
        <h1 className="font-display text-[28px] font-medium">Audit didn’t finish</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{error}</p>
        <p className="mt-2 text-[13px] text-ink-faint">
          Playwright needs a local Chromium. If this environment can’t launch a browser, open the Mediclinic sample from the home page.
        </p>
        <Link to="/" className="mt-6 inline-block text-[14px] text-accent underline-offset-2 hover:underline">
          Back to launcher
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col items-center px-5 py-20 text-center">
      <Loader2 className="size-8 animate-spin text-accent" />
      <h1 className="mt-5 font-display text-[28px] font-medium">Rendering the site</h1>
      <p className="mt-2 text-[14px] text-ink-muted">{url || "Starting Chromium…"}</p>
      <p className="mt-4 font-mono text-[12px] text-ink-faint">
        {status} · {crawled} crawled · {queued} queued
      </p>
      {currentUrl ? (
        <p className="mt-2 max-w-full truncate font-mono text-[11px] text-ink-faint">{currentUrl}</p>
      ) : null}
      <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-ink-faint">
        Waiting for hydration, dismissing cookie banners, then extracting nav, iframes, and axe issues. This is slower than a static fetch on purpose.
      </p>
    </main>
  );
}
