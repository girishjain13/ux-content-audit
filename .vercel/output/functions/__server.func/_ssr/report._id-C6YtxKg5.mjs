import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, _ as Link, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as LoaderCircle } from "../_libs/lucide-react.mjs";
import { n as Route } from "./router-a3g9-sn2.mjs";
import { t as getAuditFn } from "./server-tF-4LE4P.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/report._id-C6YtxKg5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var SEV = {
	critical: "bg-coral/15 text-coral",
	high: "bg-accent/12 text-accent",
	medium: "bg-amber/12 text-amber",
	low: "bg-ink/8 text-ink-muted"
};
var PILLAR_HELP = {
	ia: "Orphans + CMS leftovers. Click-depth is a light signal, not a 3-click rule.",
	content: "Duplicates weighted above thin pages. Word count is not aesthetics.",
	a11y: "Severity-weighted, floored at 18. A minor contrast nit on every page cannot zero the score.",
	seo: "Missing titles, meta, canonicals — and reused titles. Duplicate titles used to hide in a 98."
};
function ScoreTile({ value, label, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-[20px] border border-line bg-surface p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("font-display text-[32px] leading-none tabular-nums", value >= 80 ? "text-sage" : value >= 60 ? "text-amber" : "text-coral"),
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[13px] font-medium",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-[12px] leading-snug text-ink-faint",
				children: hint
			})
		]
	});
}
function FindingCard({ f }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-[16px] border border-line bg-surface p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] tracking-wide text-paper uppercase",
						children: f.sprintPriority
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("rounded-full px-2 py-0.5 font-mono text-[10px] uppercase", SEV[f.severity]),
						children: f.severity
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[12px] text-ink-faint",
						children: [f.affectedPageCount, " pages"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-2 text-[15px] font-medium leading-snug",
				children: f.title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1.5 text-[13.5px] leading-relaxed text-ink-muted",
				children: f.description
			}),
			f.affectedUrlsSample.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 space-y-0.5",
				children: f.affectedUrlsSample.slice(0, 4).map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "truncate font-mono text-[11px] text-ink-faint",
					children: u
				}, u))
			}) : null
		]
	});
}
function ReportView({ report }) {
	const p0 = report.findings.filter((f) => f.sprintPriority === "P0");
	const rest = report.findings.filter((f) => f.sprintPriority !== "P0");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "mx-auto w-full max-w-6xl px-5 py-8 pb-20",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-mono text-[11px] tracking-[0.14em] text-accent uppercase",
				children: [
					report.isSample ? "Sample · JS-aware rescore" : "Live crawl",
					" · ",
					report.pageCount,
					" pages · ",
					report.durationSeconds,
					"s"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 break-all font-display text-[32px] leading-tight font-medium tracking-tight md:text-[40px]",
				children: report.host
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[14px] text-ink-muted",
				children: report.startUrl
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[20px] border border-ink bg-ink p-4 text-paper sm:col-span-2 lg:col-span-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-[36px] leading-none tabular-nums",
								children: report.scorecard.uxMaturityScore
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[13px]",
								children: report.scorecard.uxMaturityBand
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-[12px] text-paper/60",
								children: "Overall · conversion-capped"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScoreTile, {
						value: report.scorecard.iaHealthScore,
						label: "Information architecture",
						hint: PILLAR_HELP.ia
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScoreTile, {
						value: report.scorecard.contentQualityScore,
						label: "Content quality",
						hint: PILLAR_HELP.content
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScoreTile, {
						value: report.scorecard.accessibilityScore,
						label: "Accessibility",
						hint: PILLAR_HELP.a11y
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScoreTile, {
						value: report.scorecard.seoScore,
						label: "SEO / findability",
						hint: PILLAR_HELP.seo
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "mt-10 grid gap-3 sm:grid-cols-5",
				children: [
					["Cookie banners", report.crawlMeta.cookieBanners],
					["Cookie-gated", report.crawlMeta.cookieGatedPages],
					["Banners dismissed", report.crawlMeta.cookiesDismissed],
					["Hydration waits", report.crawlMeta.spaHydrationPages],
					["JS-heavy pages", report.crawlMeta.jsHeavyPages]
				].map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-[16px] border border-line bg-paper-2/50 px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-[22px] tabular-nums",
						children: v
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[12px] text-ink-muted",
						children: k
					})]
				}, String(k)))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-[24px] font-medium",
					children: "In plain terms"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 space-y-2",
					children: report.plainTerms.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "border-l-2 border-accent/40 pl-4 text-[15px] leading-relaxed text-ink-muted",
						children: t
					}, t))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-[24px] font-medium",
					children: "UX lead’s read"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 space-y-4",
					children: report.uxLeadAssessment.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-3xl text-[15.5px] leading-relaxed text-ink",
						children: p
					}, p))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-[24px] font-medium",
					children: "Where to start next sprint"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-4 space-y-2",
					children: report.nextSprint.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "rounded-[12px] border border-line bg-surface px-4 py-3 text-[14px] leading-snug",
						children: s
					}, s))
				})]
			}),
			p0.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-[24px] font-medium",
						children: "P0 — conversion and access"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[13px] text-ink-muted",
						children: "These outrank orphans. Fix them before a content cleanup."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 grid gap-3 md:grid-cols-2",
						children: p0.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FindingCard, { f }, f.id))
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-[24px] font-medium",
					children: "All findings"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 grid gap-3 md:grid-cols-2",
					children: rest.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FindingCard, { f }, f.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-[24px] font-medium",
						children: "Nielsen heuristics"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 max-w-2xl text-[13px] text-ink-muted",
						children: "Five of ten still need a human on real flows. The rest are wired to findings that a rendered crawl can actually see."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 grid gap-3 md:grid-cols-2",
						children: report.heuristics.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-[16px] border border-line bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[14px] font-medium",
										children: h.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "shrink-0 font-mono text-[10px] text-ink-faint uppercase",
										children: h.status
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-[13px] text-ink-muted",
									children: h.description
								}),
								h.notAssessedReason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-[12px] leading-relaxed text-ink-faint",
									children: h.notAssessedReason
								}) : null,
								h.bullets.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-2 list-disc space-y-1 pl-4 text-[13px] text-ink",
									children: h.bullets.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: b }, b))
								}) : null
							]
						}, h.id))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12 grid gap-10 md:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-[24px] font-medium",
						children: "Feature matrix"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[13px] text-ink-muted",
						children: "Rendered DOM + nav labels + iframe srcs — not URL regex alone."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 divide-y divide-line rounded-[16px] border border-line bg-surface",
						children: report.featureMatrix.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: f.feature }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: f.detected ? "font-medium text-sage" : "text-ink-faint",
								children: f.detected ? `Yes · ${f.pagesFoundOn}` : "No"
							})]
						}, f.feature))
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-[24px] font-medium",
						children: "Journeys"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[13px] text-ink-muted",
						children: "Strong matches require the URL path. Title-only hits stay weak."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 space-y-3",
						children: report.journeys.map((j) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-[16px] border border-line bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-[14px] font-medium",
										children: j.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono text-[11px] text-ink-faint",
										children: [
											j.stagesPresent,
											"/",
											j.stagesTotal,
											" strong"
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-2 space-y-1",
									children: j.stages.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex items-start justify-between gap-2 text-[12.5px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-ink-muted",
											children: s.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: cn("shrink-0 font-mono text-[10px] uppercase", s.confidence === "strong" ? "text-sage" : s.confidence === "weak" ? "text-amber" : "text-ink-faint"),
											children: s.confidence
										})]
									}, s.id))
								}),
								j.notes[0] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-[12px] leading-relaxed text-ink-faint",
									children: j.notes[0]
								}) : null
							]
						}, j.id))
					})
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-12",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-[24px] font-medium",
					children: "Pages in this crawl"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 overflow-x-auto rounded-[16px] border border-line bg-surface",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[640px] text-left text-[13px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "border-b border-line text-[11px] tracking-wide text-ink-faint uppercase",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-4 py-2 font-medium",
									children: "URL"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-4 py-2 font-medium",
									children: "H1"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-4 py-2 font-medium",
									children: "Words"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-4 py-2 font-medium",
									children: "Depth"
								})
							] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: report.pages.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-line/70 last:border-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "max-w-[320px] truncate px-4 py-2 font-mono text-[11px]",
									children: p.url
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2 text-ink-muted",
									children: p.h1Text || "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2 tabular-nums",
									children: p.wordCount
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-2 tabular-nums",
									children: p.depth
								})
							]
						}, p.url)) })]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-10 text-[13px] text-ink-faint",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "text-accent underline-offset-2 hover:underline",
					children: "New audit"
				}), report.crawlMeta.truncated ? " · Crawl hit the page cap — IA completeness is a sample." : null]
			})
		]
	});
}
function ReportPage() {
	const { id } = Route.useParams();
	const [error, setError] = (0, import_react.useState)(null);
	const [status, setStatus] = (0, import_react.useState)("queued");
	const [crawled, setCrawled] = (0, import_react.useState)(0);
	const [queued, setQueued] = (0, import_react.useState)(0);
	const [currentUrl, setCurrentUrl] = (0, import_react.useState)("");
	const [url, setUrl] = (0, import_react.useState)("");
	const [report, setReport] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		let timer;
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
				if (res.job.status === "running" || res.job.status === "queued") timer = setTimeout(tick, 1200);
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
	if (report) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReportView, { report });
	if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-lg px-5 py-20 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-[28px] font-medium",
				children: "Audit didn’t finish"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-[14px] leading-relaxed text-ink-muted",
				children: error
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[13px] text-ink-faint",
				children: "Playwright needs a local Chromium. If this environment can’t launch a browser, open the Mediclinic sample from the home page."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/",
				className: "mt-6 inline-block text-[14px] text-accent underline-offset-2 hover:underline",
				children: "Back to launcher"
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex max-w-lg flex-col items-center px-5 py-20 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-8 animate-spin text-accent" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-5 font-display text-[28px] font-medium",
				children: "Rendering the site"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[14px] text-ink-muted",
				children: url || "Starting Chromium…"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 font-mono text-[12px] text-ink-faint",
				children: [
					status,
					" · ",
					crawled,
					" crawled · ",
					queued,
					" queued"
				]
			}),
			currentUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-full truncate font-mono text-[11px] text-ink-faint",
				children: currentUrl
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 max-w-sm text-[13px] leading-relaxed text-ink-faint",
				children: "Waiting for hydration, dismissing cookie banners, then extracting nav, iframes, and axe issues. This is slower than a static fetch on purpose."
			})
		]
	});
}
//#endregion
export { ReportPage as component };
