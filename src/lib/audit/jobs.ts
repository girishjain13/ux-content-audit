import type { AuditReport } from "./types";
import { buildMediclinicSample } from "./sample";

export type JobStatus = "queued" | "running" | "done" | "error";

export type AuditJob = {
  id: string;
  status: JobStatus;
  url: string;
  maxPages: number;
  crawled: number;
  queued: number;
  currentUrl: string;
  error: string | null;
  startedAt: number;
  report: AuditReport | null;
};

const jobs = new Map<string, AuditJob>();

const sample = buildMediclinicSample();
jobs.set("sample-mediclinic", {
  id: "sample-mediclinic",
  status: "done",
  url: sample.startUrl,
  maxPages: sample.pageCount,
  crawled: sample.pageCount,
  queued: 0,
  currentUrl: "",
  error: null,
  startedAt: Date.parse(sample.crawledAt),
  report: sample,
});

export function createJob(url: string, maxPages: number): AuditJob {
  const id = crypto.randomUUID();
  const job: AuditJob = {
    id,
    status: "queued",
    url,
    maxPages,
    crawled: 0,
    queued: 0,
    currentUrl: "",
    error: null,
    startedAt: Date.now(),
    report: null,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): AuditJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<AuditJob>) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
}

export function listJobs(): AuditJob[] {
  return [...jobs.values()].sort((a, b) => b.startedAt - a.startedAt);
}
