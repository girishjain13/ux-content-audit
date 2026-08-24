import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createJob, getJob, listJobs, updateJob } from "./jobs";
import { analyzeSite } from "./analyze";

const StartSchema = z.object({
  url: z.string().min(8).max(500),
  maxPages: z.number().min(3).max(20),
});

function normalizeStartUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export const startAuditFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => StartSchema.parse(data))
  .handler(async ({ data }) => {
    let url = normalizeStartUrl(data.url);
    try {
      const u = new URL(url);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http(s) URLs");
      url = u.toString();
    } catch {
      throw new Error("Enter a valid website URL, e.g. mediclinic.ae");
    }
    const job = createJob(url, data.maxPages);
    void runJob(job.id).catch((err) => {
      updateJob(job.id, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    });
    return { id: job.id };
  });

export const getAuditFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const job = getJob(data.id);
    if (!job) return { ok: false as const, error: "No audit with that id." };
    return {
      ok: true as const,
      job: {
        id: job.id,
        status: job.status,
        url: job.url,
        maxPages: job.maxPages,
        crawled: job.crawled,
        queued: job.queued,
        currentUrl: job.currentUrl,
        error: job.error,
        report: job.report,
      },
    };
  });

export const listAuditsFn = createServerFn({ method: "GET" }).handler(async () => {
  return listJobs().map((j) => ({
    id: j.id,
    status: j.status,
    url: j.url,
    crawled: j.crawled,
    error: j.error,
    startedAt: j.startedAt,
    host: j.report?.host ?? j.url,
    score: j.report?.scorecard.uxMaturityScore ?? null,
  }));
});

async function runJob(id: string) {
  const job = getJob(id);
  if (!job) return;
  updateJob(id, { status: "running" });
  const started = Date.now();
  const { crawlSite } = await import("./crawler");
  const pages = await crawlSite({
    startUrl: job.url,
    maxPages: job.maxPages,
    maxDepth: 3,
    respectRobots: true,
    concurrency: 2,
    onProgress: (crawled, queued, currentUrl) => {
      updateJob(id, { crawled, queued, currentUrl });
    },
  });
  const report = analyzeSite(pages, job.url, {
    truncated: pages.length >= job.maxPages,
    durationSeconds: Math.round((Date.now() - started) / 100) / 10,
    id,
  });
  updateJob(id, { status: "done", crawled: pages.length, queued: 0, currentUrl: "", report });
}
