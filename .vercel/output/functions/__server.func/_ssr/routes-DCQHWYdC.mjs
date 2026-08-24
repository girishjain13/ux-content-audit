import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as ArrowRight, n as LoaderCircle, r as Globe } from "../_libs/lucide-react.mjs";
import { n as listAuditsFn, r as startAuditFn } from "./server-tF-4LE4P.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DCQHWYdC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const navigate = useNavigate();
	const [url, setUrl] = (0, import_react.useState)("mediclinic.ae");
	const [maxPages, setMaxPages] = (0, import_react.useState)(8);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [recent, setRecent] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		listAuditsFn().then(setRecent).catch(() => void 0);
	}, []);
	async function onSubmit(e) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const { id } = await startAuditFn({ data: {
				url,
				maxPages
			} });
			await navigate({
				to: "/report/$id",
				params: { id }
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not start the audit.");
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-5 py-10 md:py-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-end",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-[11px] tracking-[0.16em] text-accent uppercase",
						children: "UX lead · content strategist"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-3 max-w-[18ch] font-display text-[40px] leading-[1.08] font-medium tracking-[-0.03em] text-ink md:text-[52px]",
						children: "Audits that wait for the JavaScript."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink-muted",
						children: "A headless browser renders the page, dismisses the cookie wall, lets the SPA hydrate, then scores conversion paths — not just title tags. Orphans are a ticket. A gated booking widget is a P0."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit,
					className: "rounded-[28px] border border-line bg-surface p-5 shadow-[0_1px_0_rgba(28,25,21,0.04)] md:p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							htmlFor: "url",
							className: "text-[12px] font-medium text-ink-muted",
							children: "Website URL"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex items-center gap-2 rounded-[12px] border border-line bg-paper px-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "size-4 shrink-0 text-ink-faint" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								id: "url",
								value: url,
								onChange: (e) => setUrl(e.target.value),
								placeholder: "https://example.com",
								className: "h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-ink-faint",
								autoComplete: "url"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-wrap items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-2 text-[13px] text-ink-muted",
								children: ["Pages", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: maxPages,
									onChange: (e) => setMaxPages(Number(e.target.value)),
									className: "h-9 rounded-[8px] border border-line bg-surface px-2 text-[13px] text-ink",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: 5,
											children: "5 — smoke"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: 8,
											children: "8 — focused"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: 12,
											children: "12 — standard"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: 20,
											children: "20 — deeper"
										})
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "submit",
								disabled: busy,
								className: "inline-flex h-11 items-center gap-2 rounded-[12px] bg-ink px-4 text-[14px] font-medium text-paper transition hover:bg-ink/90 disabled:opacity-60",
								children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" }), busy ? "Starting…" : "Run live crawl"]
							})]
						}),
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-[13px] text-coral",
							children: error
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-[12px] leading-relaxed text-ink-faint",
							children: "Live crawls use Playwright: cookie dismiss, network settle, lazy-load scroll, iframe and CMP detection. Cap is small so a run finishes in this preview."
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "grid gap-4 md:grid-cols-3",
				children: [
					{
						k: "01",
						t: "Render, don’t fetch",
						d: "Chromium executes the page. SPAs, AEM teaser carousels, and OneTrust walls are visible to the audit."
					},
					{
						k: "02",
						t: "Score like a lead",
						d: "Accessibility is severity-weighted, not binary. SEO counts duplicate titles. Next sprint is conversion, not two orphans."
					},
					{
						k: "03",
						t: "Journeys with proof",
						d: "Path-aware matching. A news story titled “unit opening” is not a job listing. Weak matches stay weak."
					}
				].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-[20px] border border-line bg-surface p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-[11px] text-accent",
							children: c.k
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 font-display text-[20px] font-medium",
							children: c.t
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-[14px] leading-relaxed text-ink-muted",
							children: c.d
						})
					]
				}, c.k))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-end justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-[22px] font-medium",
					children: "Reports"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] text-ink-muted",
					children: "Sample is the Mediclinic.ae review, rescored with the new engine."
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface",
				children: recent.map((j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => navigate({
						to: "/report/$id",
						params: { id: j.id }
					}),
					className: "flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-paper-2/60",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[15px] font-medium",
						children: j.host
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 font-mono text-[11px] text-ink-faint",
						children: [j.id === "sample-mediclinic" ? "Sample · JS-aware rescore" : j.status, j.crawled ? ` · ${j.crawled} pages` : ""]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-[22px] tabular-nums",
						children: j.score != null ? j.score : "—"
					})]
				}) }, j.id))
			})] })
		]
	});
}
//#endregion
export { Home as component };
