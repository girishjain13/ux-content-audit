import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { i as string, n as number, r as object } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/server-BXawGYlS.js
var NON_HTML = /\.(pdf|docx?|xlsx?|pptx?|csv|rtf|zip|rar|7z|tar|gz|jpe?g|png|gif|svg|webp|ico|bmp|tiff?|mp4|mp3|wav|avi|mov|webm|ogg|woff2?|ttf|eot|xml|json)(\?|#|$)/i;
function isLikelyNonHtmlResource(url) {
	try {
		return NON_HTML.test(new URL(url).pathname);
	} catch {
		return false;
	}
}
function normalizeCrawlUrl(rawUrl) {
	try {
		const parsed = new URL(rawUrl);
		parsed.hash = "";
		parsed.hostname = parsed.hostname.replace(/^www\./, "");
		let result = parsed.toString();
		if (result.endsWith("/") && parsed.pathname !== "/") result = result.slice(0, -1);
		return result;
	} catch {
		return rawUrl;
	}
}
function urlHost(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function pctScore(bad, total) {
	if (total <= 0) return 100;
	return Math.round(100 * (1 - Math.min(bad, total) / total) * 10) / 10;
}
function band(score) {
	if (score >= 85) return "Strong";
	if (score >= 70) return "Adequate";
	if (score >= 50) return "Needs Improvement";
	return "Critical";
}
function scoreIa(inputs) {
	const total = Math.max(inputs.totalPages, 1);
	const orphanScore = pctScore(inputs.orphanPageCount, total);
	const depthScore = pctScore(inputs.pagesOverThreeClicks, total);
	const leftoverScore = pctScore(inputs.cmsLeftoverPages, total);
	return Math.round((orphanScore * .35 + depthScore * .15 + leftoverScore * .5) * 10) / 10;
}
function scoreContent(inputs) {
	const total = Math.max(inputs.totalPages, 1);
	const thinScore = pctScore(inputs.thinContentCount, total);
	const dupScore = pctScore(inputs.duplicateContentPageCount, total);
	const headingScore = pctScore(inputs.missingH1Count, total);
	const altScore = inputs.imageAltCoveragePct;
	return Math.round((thinScore * .2 + dupScore * .35 + headingScore * .2 + altScore * .25) * 10) / 10;
}
/**
* Severity-weighted, then capped. A site with a minor contrast nit on
* every page must not score 0. Critical/serious density drives the score.
*/
function scoreAccessibility(inputs) {
	const { critical, serious, moderate, minor } = inputs.accessibilityViolationsByImpact;
	const total = Math.max(inputs.totalPages, 1);
	const criticalPerPage = critical / total;
	const seriousPerPage = serious / total;
	const moderatePerPage = moderate / total;
	const minorPerPage = minor / total;
	let score = 100 - (Math.min(criticalPerPage, 8) * 6 + Math.min(seriousPerPage, 12) * 2.2 + Math.min(moderatePerPage, 20) * .6 + Math.min(minorPerPage, 40) * .15);
	if (inputs.cookieGatedPages / total > .3) score -= 8;
	return Math.max(18, Math.min(100, Math.round(score * 10) / 10));
}
function scoreSeo(inputs) {
	const total = Math.max(inputs.totalPages, 1);
	const titleScore = pctScore(inputs.missingTitleCount, total);
	const descScore = pctScore(inputs.missingMetaDescriptionCount, total);
	const canonicalScore = pctScore(inputs.canonicalMissingCount, total);
	const dupTitleScore = pctScore(inputs.duplicateTitlePageCount, total);
	return Math.round((titleScore * .25 + descScore * .25 + canonicalScore * .15 + dupTitleScore * .35) * 10) / 10;
}
function buildScorecard(inputs) {
	const iaHealthScore = scoreIa(inputs);
	const contentQualityScore = scoreContent(inputs);
	const accessibilityScore = scoreAccessibility(inputs);
	const seoScore = scoreSeo(inputs);
	let uxMaturityScore = (iaHealthScore + contentQualityScore + accessibilityScore + seoScore) / 4;
	if (inputs.conversionBlockers > 0) uxMaturityScore = Math.min(uxMaturityScore, 68);
	uxMaturityScore = Math.round(uxMaturityScore * 10) / 10;
	return {
		iaHealthScore,
		contentQualityScore,
		accessibilityScore,
		seoScore,
		uxMaturityScore,
		uxMaturityBand: band(uxMaturityScore)
	};
}
var RULES = [
	{
		feature: "Site Search",
		test: (p) => /\/search(\/|$|\.html)/i.test(p.url) || Boolean(p.signals.searchPlaceholder) || /search/i.test(p.visibleTextSample.slice(0, 400))
	},
	{
		feature: "User Login / Account",
		test: (p) => /\/(login|signin|sign-in|patient-portal|my-account|account)(\/|$|\.html)/i.test(p.url) || /patient portal|sign in|log in|uae pass/i.test(p.visibleTextSample)
	},
	{
		feature: "User Registration / Signup",
		test: (p) => /\/(register|signup|sign-up|create-account)(\/|$)/i.test(p.url)
	},
	{
		feature: "E-commerce (cart / checkout)",
		test: (p) => /\/(cart|checkout|shop|basket)(\/|$)/i.test(p.url)
	},
	{
		feature: "Newsletter Signup",
		test: (p) => /newsletter|subscribe to our/i.test(p.visibleTextSample)
	},
	{
		feature: "Blog / Articles",
		test: (p) => /\/(blog|articles?|insights|news|health-knowledge)(\/|$|\.html)/i.test(p.url)
	},
	{
		feature: "FAQ / Help Center",
		test: (p) => /\/(faq|help|support)(\/|$|\.html)/i.test(p.url) && !/oncology\/support/i.test(p.url)
	},
	{
		feature: "Pricing / Plans",
		test: (p) => /\/(pricing|plans|packages|special-offers)(\/|$|\.html)/i.test(p.url)
	},
	{
		feature: "Careers / Jobs",
		test: (p) => /\/(careers?|jobs|working-with|working-at)(\/|$|\.html)/i.test(p.url) || p.signals.navLabels.some((l) => /career/i.test(l)) || p.externalLinks.some((u) => /careers?\./i.test(u))
	},
	{
		feature: "Video Content",
		test: (p) => p.signals.iframeSrcs.some((s) => /youtube|vimeo|youtu\.be/i.test(s)) || /vimeo|youtube/i.test(p.visibleTextSample)
	},
	{
		feature: "Testimonials / Reviews",
		test: (p) => /testimonial|patient stor|what our (patients|customers)/i.test(p.visibleTextSample)
	},
	{
		feature: "Downloadable Resources",
		test: (p) => p.externalLinks.some((u) => /\.pdf(\?|$)/i.test(u)) || /\.pdf/i.test(p.visibleTextSample)
	},
	{
		feature: "Contact Form",
		test: (p) => /\/contact/i.test(p.url)
	},
	{
		feature: "Store/Office Locations",
		test: (p) => /\/(locations?|hospitals-and-clinics|find-us|branches|clinics)(\/|$|\.html)/i.test(p.url) || p.signals.navLabels.some((l) => /hospital|clinic|location/i.test(l))
	},
	{
		feature: "Live Chat Widget",
		test: (p) => p.signals.chatWidget || p.detectedGlobals.some((g) => /Intercom|drift|zE|Tawk_API|LiveChatWidget/i.test(g))
	},
	{
		feature: "Appointment booking",
		test: (p) => /book-an-appointment|booking\./i.test(p.url) || p.signals.iframeSrcs.some((s) => /book/i.test(s)) || p.signals.navLabels.some((l) => /book/i.test(l))
	},
	{
		feature: "Find a doctor / directory",
		test: (p) => /find-a-doctor|doctors/i.test(p.url) || p.signals.navLabels.some((l) => /^doctors?$/i.test(l))
	}
];
function detectFeatures(pages, multilingual) {
	const out = RULES.map(({ feature, test }) => {
		const hits = pages.filter(test);
		return {
			feature,
			detected: hits.length > 0,
			pagesFoundOn: hits.length,
			evidence: hits[0]?.url
		};
	});
	out.splice(9, 0, {
		feature: "Multi-language Support",
		detected: multilingual || pages.some((p) => (p.htmlLang || "").split("-")[0] && pages.some((q) => (q.htmlLang || "").split("-")[0] !== (p.htmlLang || "").split("-")[0])),
		pagesFoundOn: multilingual ? pages.length : 0
	});
	return out;
}
var JOURNEYS = [
	{
		id: "prospective_customer",
		name: "Prospective patient / customer",
		description: "A new visitor deciding whether to book or buy — awareness through conversion.",
		stages: [
			{
				id: "awareness",
				name: "Awareness",
				description: "Informational / news content.",
				path: /\/(news|media|blog|insights|health-knowledge)(\/|$|\.html)/i
			},
			{
				id: "consideration",
				name: "Consideration",
				description: "Services, specialities, packages.",
				path: /\/(services|specialit|packages|about)(\/|$|\.html)/i,
				exclude: /media-and-news/i
			},
			{
				id: "decision",
				name: "Decision",
				description: "Pricing, offers, insurance.",
				path: /\/(pricing|plans|special-offers|health-insurance|insurance)(\/|$|\.html)/i
			},
			{
				id: "action",
				name: "Action / Conversion",
				description: "Booking, contact, checkout.",
				path: /\/(book|booking|contact|checkout|register)(\/|$|\.html)/i
			}
		]
	},
	{
		id: "find_care",
		name: "Find care (healthcare)",
		description: "The jobs most hospital visitors actually have: doctor, appointment, emergency, insurance.",
		stages: [
			{
				id: "find_doctor",
				name: "Find a doctor",
				description: "Directory with filters.",
				path: /find-a-doctor|\/doctors(\/|$|\.html)/i
			},
			{
				id: "book",
				name: "Book appointment",
				description: "Working booking flow.",
				path: /book-an-appointment|\/booking/i
			},
			{
				id: "emergency",
				name: "Emergency",
				description: "ER / urgent care.",
				path: /\/emergency(\/|$|\.html)/i
			},
			{
				id: "insurance",
				name: "Insurance",
				description: "Coverage / network.",
				path: /\/(health-insurance|insurance)(\/|$|\.html)/i
			}
		]
	},
	{
		id: "job_seeker",
		name: "Job seeker",
		description: "Someone evaluating the organisation as an employer.",
		stages: [
			{
				id: "discover_careers",
				name: "Discover careers",
				description: "Careers landing.",
				path: /\/(careers?|working-with-mediclinic|working-at|jobs-and-careers)(\/|$|\.html)/i
			},
			{
				id: "browse_openings",
				name: "Browse openings",
				description: "Actual listings — not a news headline containing 'opening'.",
				path: /\/(vacancies|job-listing|openings|jobs\/)(\/|$)/i,
				exclude: /media|news|acute-medical-unit/i
			},
			{
				id: "apply",
				name: "Apply",
				description: "Application form or ATS.",
				path: /\/(apply|application|full-time-doctor|independent-doctor)(\/|$|\.html)/i
			}
		]
	},
	{
		id: "existing_customer",
		name: "Existing customer / support",
		description: "Returning patients who need to sign in or get help.",
		stages: [
			{
				id: "sign_in",
				name: "Sign in",
				description: "Portal / account login.",
				path: /\/(patient-portal|login|signin|uae-pass)(\/|$|\.html)/i
			},
			{
				id: "self_service",
				name: "Self-service help",
				description: "FAQ or app help.",
				path: /\/(faq|help-center|mediclinic-app-faq)(\/|$|\.html)/i
			},
			{
				id: "contact_support",
				name: "Contact support",
				description: "Dedicated support, not a clinical 'support group'.",
				path: /\/(contact-us|contact)(\/|$|\.html)/i,
				exclude: /oncology\/support/i
			}
		]
	},
	{
		id: "press_investor",
		name: "Press / investor",
		description: "Journalists and analysts researching the organisation.",
		stages: [
			{
				id: "company_info",
				name: "Company info",
				description: "About, leadership, history.",
				path: /\/(about|history|management|vision-and-values)(\/|$|\.html)/i,
				exclude: /stay\/feedback/i
			},
			{
				id: "news_press",
				name: "News & press",
				description: "Press room.",
				path: /\/(media-and-news|press-releases|newsroom|media-kit)(\/|$|\.html)/i
			},
			{
				id: "investor_relations",
				name: "Investor relations",
				description: "IR pages — not product pages that happen to include the word.",
				path: /\/(investor|shareholder|financial-report|\/ir\/)/i,
				exclude: /laser-hair|clinic|hospital/i
			},
			{
				id: "media_contact",
				name: "Media contact",
				description: "Press contact or media kit.",
				path: /\/(media-kit|media-contact|press-contact)(\/|$|\.html)/i
			}
		]
	}
];
function matchStage(page, stage) {
	if (page.statusCode && page.statusCode >= 400) return "none";
	if (stage.exclude && stage.exclude.test(page.url)) return "none";
	if (stage.path.test(page.url)) return "strong";
	if (stage.title && page.title && stage.title.test(page.title) && !stage.exclude?.test(page.url)) return "weak";
	return "none";
}
function buildJourneyMap(pages) {
	return JOURNEYS.map((j) => {
		const stages = j.stages.map((stage) => {
			const strong = pages.filter((p) => matchStage(p, stage) === "strong");
			const weak = pages.filter((p) => matchStage(p, stage) === "weak");
			const pool = strong.length ? strong : weak;
			if (!pool.length) return {
				id: stage.id,
				name: stage.name,
				description: stage.description,
				present: false,
				pageCount: 0,
				exampleUrl: null,
				exampleTitle: null,
				clickDepth: null,
				confidence: "none"
			};
			const best = pool.reduce((a, b) => a.depth <= b.depth ? a : b);
			return {
				id: stage.id,
				name: stage.name,
				description: stage.description,
				present: true,
				pageCount: pool.length,
				exampleUrl: best.url,
				exampleTitle: best.title,
				clickDepth: best.depth,
				confidence: strong.length ? "strong" : "weak",
				note: strong.length ? void 0 : "Title-only match — confirm this is actually the right page."
			};
		});
		const present = stages.filter((s) => s.present && s.confidence === "strong").length;
		const missing = stages.filter((s) => !s.present).map((s) => s.name);
		const notes = [];
		if (present === 0) notes.push("No strong path matches for this journey. It may not apply, or the site uses different URL wording.");
		else if (missing.length) notes.push(`No strong match for: ${missing.join(", ")}.`);
		const weakHits = stages.filter((s) => s.confidence === "weak");
		if (weakHits.length) notes.push(`${weakHits.map((s) => s.name).join(", ")} only matched on title — treated as weak, not as proof the journey exists.`);
		return {
			id: j.id,
			name: j.name,
			description: j.description,
			stages,
			stagesPresent: present,
			stagesTotal: j.stages.length,
			notes
		};
	});
}
var PILLAR = {
	iaHealthScore: "Information Architecture",
	contentQualityScore: "Content Quality",
	accessibilityScore: "Accessibility",
	seoScore: "SEO / Findability"
};
function strongestWeakest(scorecard) {
	const pillars = [
		["iaHealthScore", scorecard.iaHealthScore],
		["contentQualityScore", scorecard.contentQualityScore],
		["accessibilityScore", scorecard.accessibilityScore],
		["seoScore", scorecard.seoScore]
	];
	pillars.sort((a, b) => b[1] - a[1]);
	return {
		strongest: PILLAR[pillars[0][0]],
		weakest: PILLAR[pillars[pillars.length - 1][0]]
	};
}
function generateInPlainTerms(opts) {
	const bullets = [];
	bullets.push(`Overall UX maturity scores ${opts.scorecard.uxMaturityScore}/100 (${opts.scorecard.uxMaturityBand}) from ${opts.totalPages} rendered pages.`);
	if (opts.truncated) bullets.push("The crawl hit its page cap — treat IA completeness as a sample, not a census.");
	const p0 = opts.findings.filter((f) => f.sprintPriority === "P0");
	if (p0.length) bullets.push(`${p0.length} P0 issue(s) sit on a conversion or access path (cookie wall, duplicate chrome, language, booking).`);
	if (opts.cookieGatedPages > 0) bullets.push(`${opts.cookieGatedPages} page(s) hide primary content behind a cookie / CMP gate — including, on some sites, the booking widget.`);
	const a11y = opts.findings.find((f) => f.findingType === "accessibility_summary");
	if (a11y) bullets.push(a11y.title + " Automated axe is a floor, not a WCAG clearance.");
	return bullets;
}
function generateUxLeadAssessment(opts) {
	const { strongest, weakest } = strongestWeakest(opts.scorecard);
	const p0 = opts.findings.filter((f) => f.sprintPriority === "P0");
	const paragraphs = [];
	paragraphs.push(`This site lands at ${opts.scorecard.uxMaturityScore}/100 — ${opts.scorecard.uxMaturityBand.toLowerCase()}. ${strongest} is the strongest of the four crawlable pillars; ${weakest} is the weakest. Scores are directional. They are not a substitute for task-based testing.`);
	if (p0.length) paragraphs.push(`Start with conversion and access, not orphans. The highest-leverage items in this run: ${p0.map((f) => f.title.replace(/\.$/, "")).slice(0, 3).join("; ")}.`);
	else paragraphs.push("No P0 conversion blockers were detected in this sample. Next, work through P1 findings in severity order — duplicate titles, thin templates, and assistive-tech issues.");
	paragraphs.push("A crawl still cannot watch a form submit, a slot picker, or a screen reader. Treat H1/H3/H5/H7 as unassessed unless a human walked the flow.");
	return paragraphs;
}
function nextSprintFromFindings(findings) {
	const steps = [...findings].sort((a, b) => {
		const p = {
			P0: 0,
			P1: 1,
			P2: 2,
			P3: 3
		};
		const s = {
			critical: 0,
			high: 1,
			medium: 2,
			low: 3
		};
		return p[a.sprintPriority] - p[b.sprintPriority] || s[a.severity] - s[b.severity];
	}).slice(0, 6).map((f, i) => `${i + 1}. [${f.sprintPriority}] ${f.title}`);
	if (!steps.length) return ["No blocking findings in this sample. Re-run with a higher page cap and walk booking / search by hand."];
	return steps;
}
function makeFinding(n, f) {
	return {
		id: `f${n}`,
		...f
	};
}
var STOP_KEYWORDS = /* @__PURE__ */ new Set([
	"the",
	"and",
	"for",
	"with",
	"this",
	"that",
	"from",
	"your",
	"are",
	"was",
	"were",
	"cookie",
	"cookies",
	"settings",
	"accept",
	"privacy",
	"notice",
	"please",
	"hirslanden",
	"home",
	"page",
	"click",
	"here",
	"more",
	"learn"
]);
function topKeywords(pages, limit = 18) {
	const counts = /* @__PURE__ */ new Map();
	for (const p of pages) {
		const words = p.visibleTextSample.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
		for (const w of words) {
			if (STOP_KEYWORDS.has(w)) continue;
			counts.set(w, (counts.get(w) ?? 0) + 1);
		}
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([term, count]) => ({
		term,
		count
	}));
}
function heuristicCards(findings) {
	const bullets = (types) => findings.filter((f) => types.includes(f.findingType)).map((f) => f.title);
	const card = (id, name, description, types, reason) => {
		if (!types) return {
			id,
			name,
			description,
			assessed: false,
			status: "Not assessed",
			bullets: [],
			notAssessedReason: reason
		};
		const b = bullets(types);
		if (!b.length) return {
			id,
			name,
			description,
			assessed: true,
			status: "No issues found",
			bullets: []
		};
		return {
			id,
			name,
			description,
			assessed: true,
			status: `${b.length} finding(s)`,
			bullets: b
		};
	};
	return [
		card("h1", "H1 · Visibility of system status", "Loading, confirmation, progress.", null, "Needs watching real interactions — a crawl sees HTML, not a submit."),
		card("h2", "H2 · Match between system and the real world", "Visitor language, conventions, mental models.", [
			"cms_leftover",
			"awkward_copy",
			"rtl_mismatch"
		]),
		card("h3", "H3 · User control and freedom", "Undo, back out, escape.", null, "Needs a human on forms, booking, and wizards."),
		card("h4", "H4 · Consistency and standards", "Same conventions across pages.", [
			"duplicate_title",
			"missing_title",
			"duplicate_nav"
		]),
		card("h5", "H5 · Error prevention", "Clear fields, sensible defaults.", ["cookie_gate"], "Forms still need a human. Cookie-gating a booking widget is treated as prevention failure."),
		card("h6", "H6 · Recognition rather than recall", "Find by browsing.", ["orphan_page", "weak_search"]),
		card("h7", "H7 · Flexibility and efficiency of use", "Shortcuts, filters, saved state.", null, "Needs usage data or task testing."),
		card("h8", "H8 · Aesthetic and minimalist design", "Focus, not filler. Not a word-count test.", ["duplicate_nav", "cookie_banner_cover"]),
		card("h9", "H9 · Error recovery", "Broken links, failed search.", ["broken_page"]),
		card("h10", "H10 · Help and documentation", "Help when stuck.", null, "Qualitative — not a crawl signal.")
	];
}
function analyzeSite(pages, startUrl, opts) {
	let n = 0;
	const findings = [];
	const push = (f) => findings.push(makeFinding(++n, f));
	const ok = pages.filter((p) => !p.error);
	const startNorm = normalizeCrawlUrl(startUrl);
	const inbound = /* @__PURE__ */ new Map();
	for (const p of ok) for (const link of p.internalLinks) {
		const k = normalizeCrawlUrl(link);
		inbound.set(k, (inbound.get(k) ?? 0) + 1);
	}
	const orphans = ok.filter((p) => p.url !== startNorm && !inbound.get(normalizeCrawlUrl(p.url)));
	if (orphans.length) push({
		findingType: "orphan_page",
		title: `${orphans.length} orphan page(s) with no inbound internal links in this crawl`,
		description: "Live, but not linked from other crawled pages. Check analytics before treating as a sprint-one item — conversion blockers outrank orphans.",
		severity: orphans.length > 20 ? "high" : "low",
		effortBucket: "config",
		affectedPageCount: orphans.length,
		affectedUrlsSample: orphans.slice(0, 8).map((p) => p.url),
		detectionMethod: "Normalized inbound-link count across the crawl",
		sprintPriority: "P3"
	});
	const broken = pages.filter((p) => p.statusCode !== null && p.statusCode >= 400);
	if (broken.length) push({
		findingType: "broken_page",
		title: `${broken.length} page(s) returned an error status`,
		description: "HTTP 4xx/5xx during the rendered crawl.",
		severity: broken.length > 5 ? "high" : "medium",
		effortBucket: "config",
		affectedPageCount: broken.length,
		affectedUrlsSample: broken.slice(0, 8).map((p) => p.url),
		detectionMethod: "HTTP status after Playwright navigation",
		sprintPriority: "P1"
	});
	const missingH1 = ok.filter((p) => !p.h1Text);
	if (missingH1.length) push({
		findingType: "missing_h1",
		title: `${missingH1.length} page(s) missing an H1`,
		description: "Affects accessibility and SEO.",
		severity: "medium",
		effortBucket: "config",
		affectedPageCount: missingH1.length,
		affectedUrlsSample: missingH1.slice(0, 8).map((p) => p.url),
		detectionMethod: "querySelector('h1') after hydration",
		sprintPriority: "P2"
	});
	const missingTitle = ok.filter((p) => !p.title);
	if (missingTitle.length) push({
		findingType: "missing_title",
		title: `${missingTitle.length} page(s) missing a title tag`,
		description: "Hurts SEO and tab usability.",
		severity: "high",
		effortBucket: "config",
		affectedPageCount: missingTitle.length,
		affectedUrlsSample: missingTitle.slice(0, 8).map((p) => p.url),
		detectionMethod: "document.title after render",
		sprintPriority: "P2"
	});
	const missingMeta = ok.filter((p) => !p.metaDescription);
	if (missingMeta.length) push({
		findingType: "missing_meta_description",
		title: `${missingMeta.length} page(s) missing a meta description`,
		description: "Search engines will invent a snippet.",
		severity: "low",
		effortBucket: "config",
		affectedPageCount: missingMeta.length,
		affectedUrlsSample: missingMeta.slice(0, 8).map((p) => p.url),
		detectionMethod: "meta[name=description]",
		sprintPriority: "P3"
	});
	const byTitle = /* @__PURE__ */ new Map();
	for (const p of ok) {
		if (!p.title) continue;
		if (!byTitle.has(p.title)) byTitle.set(p.title, []);
		byTitle.get(p.title).push(p);
	}
	const dupTitleGroups = [...byTitle.values()].filter((g) => g.length > 1);
	const dupTitlePages = dupTitleGroups.flat();
	if (dupTitleGroups.length) push({
		findingType: "duplicate_title",
		title: `${dupTitleGroups.length} title(s) reused across ${dupTitlePages.length} pages`,
		description: "Usually pagination, cloned facility templates, or a missing title pattern. This is a real SEO issue — it is not a 99 SEO score.",
		severity: dupTitlePages.length > 20 ? "high" : "medium",
		effortBucket: "config",
		affectedPageCount: dupTitlePages.length,
		affectedUrlsSample: dupTitlePages.slice(0, 8).map((p) => p.url),
		detectionMethod: "Exact title match after render",
		sprintPriority: "P1"
	});
	const thin = ok.filter((p) => p.wordCount > 0 && p.wordCount < 150);
	if (thin.length) push({
		findingType: "thin_content",
		title: `${thin.length} page(s) under 150 words`,
		description: "May be pagination shells or location stubs. Word count is not an aesthetic heuristic.",
		severity: "low",
		effortBucket: "config",
		affectedPageCount: thin.length,
		affectedUrlsSample: thin.slice(0, 8).map((p) => p.url),
		detectionMethod: "Visible innerText word count after hydration and cookie dismiss",
		sprintPriority: "P3"
	});
	const cookieGated = ok.filter((p) => p.signals.cookieGatingCopy || p.signals.iframeGatedCount > 0);
	if (cookieGated.length) {
		const onBooking = cookieGated.filter((p) => /book|appoint|doctor|emergenc/i.test(p.url));
		push({
			findingType: "cookie_gate",
			title: `${cookieGated.length} page(s) hide content behind a cookie / CMP gate`,
			description: onBooking.length ? "Primary conversion (booking, doctor, emergency) is gated on 'functional' cookies. Classify those as strictly necessary and never cover the widget." : "CMP overlay or 'accept cookies to see this content' is replacing real UI. Dismissing the banner is part of a JS-aware crawl; users still hit this wall.",
			severity: onBooking.length ? "critical" : "high",
			effortBucket: "config",
			affectedPageCount: cookieGated.length,
			affectedUrlsSample: cookieGated.slice(0, 8).map((p) => p.url),
			detectionMethod: "Rendered copy + iframe parent text after first paint, before and after consent",
			sprintPriority: "P0"
		});
	}
	const cookieCover = ok.filter((p) => p.signals.cookieBannerVisible);
	if (cookieCover.length / Math.max(ok.length, 1) > .4) push({
		findingType: "cookie_banner_cover",
		title: `Cookie banner present on ${cookieCover.length} of ${ok.length} pages`,
		description: "A CMP that covers the H1, filters, or booking iframe is an access issue, not a legal footnote.",
		severity: "high",
		effortBucket: "config",
		affectedPageCount: cookieCover.length,
		affectedUrlsSample: cookieCover.slice(0, 6).map((p) => p.url),
		detectionMethod: "OneTrust / Cookiebot / Osano selectors + banner copy",
		sprintPriority: "P0"
	});
	const dupNav = ok.filter((p) => p.signals.duplicateNavLabels.length > 0);
	if (dupNav.length) {
		const labels = [...new Set(dupNav.flatMap((p) => p.signals.duplicateNavLabels))].slice(0, 8);
		push({
			findingType: "duplicate_nav",
			title: `Primary navigation labels repeat on ${dupNav.length} page(s)`,
			description: `Repeated labels: ${labels.join(", ") || "—"}. Usually two header partials composing in a CMS (AEM / Sitecore / inherited parent brand). Doubles tab stops and looks broken on mobile.`,
			severity: "high",
			effortBucket: "custom_dev",
			affectedPageCount: dupNav.length,
			affectedUrlsSample: dupNav.slice(0, 6).map((p) => p.url),
			detectionMethod: "Frequency of header/nav link text after hydration",
			sprintPriority: "P0"
		});
	}
	const leftovers = ok.filter((p) => p.signals.cmsLeftovers.length > 0);
	if (leftovers.length) {
		const tokens = [...new Set(leftovers.flatMap((p) => p.signals.cmsLeftovers))];
		push({
			findingType: "cms_leftover",
			title: `CMS / parent-brand leftovers on ${leftovers.length} page(s)`,
			description: `Detected: ${tokens.join(", ")}. German pagination ("Seite"), parent-brand home labels, and placeholder copy are trust failures — a title-tag crawler will never rank them.`,
			severity: "high",
			effortBucket: "config",
			affectedPageCount: leftovers.length,
			affectedUrlsSample: leftovers.slice(0, 6).map((p) => p.url),
			detectionMethod: "Rendered text + HTML needle match (Hirslanden, Seite, Key word/name, Lorem…)",
			sprintPriority: "P0"
		});
	}
	const rtl = ok.filter((p) => {
		const lang = (p.signals.htmlLang || p.htmlLang || "").toLowerCase();
		const dir = (p.signals.htmlDir || "").toLowerCase();
		return /^(ar|he|fa|ur)/.test(lang) && dir !== "rtl";
	});
	if (rtl.length) push({
		findingType: "rtl_mismatch",
		title: `${rtl.length} page(s) declare an RTL language without dir="rtl"`,
		description: "Arabic (and other RTL) pages that keep an LTR layout, English nav, and English cookie/chat chrome are not localised. In the UAE this is an access failure.",
		severity: "critical",
		effortBucket: "custom_dev",
		affectedPageCount: rtl.length,
		affectedUrlsSample: rtl.slice(0, 6).map((p) => p.url),
		detectionMethod: "html lang vs dir after computed style",
		sprintPriority: "P0"
	});
	const weakSearch = ok.filter((p) => /keyword/i.test(p.signals.searchPlaceholder || ""));
	if (weakSearch.length) push({
		findingType: "weak_search",
		title: `Search placeholder is a CMS default ("Keyword…") on ${weakSearch.length} page(s)`,
		description: "Healthcare search should prompt doctor, speciality, or symptom — not 'Keyword'.",
		severity: "medium",
		effortBucket: "config",
		affectedPageCount: weakSearch.length,
		affectedUrlsSample: weakSearch.slice(0, 5).map((p) => p.url),
		detectionMethod: "input placeholder after render",
		sprintPriority: "P2"
	});
	const violationsByImpact = {
		critical: 0,
		serious: 0,
		moderate: 0,
		minor: 0
	};
	let a11yPages = 0;
	for (const p of pages) {
		if ((p.accessibilityViolations ?? []).length) a11yPages += 1;
		for (const v of p.accessibilityViolations ?? []) {
			const k = v.impact;
			if (k in violationsByImpact) violationsByImpact[k] += v.nodesCount;
		}
	}
	if (a11yPages) push({
		findingType: "accessibility_summary",
		title: `Automated axe flagged issues on ${a11yPages} of ${pages.length} pages`,
		description: `Node counts — critical ${violationsByImpact.critical}, serious ${violationsByImpact.serious}, moderate ${violationsByImpact.moderate}, minor ${violationsByImpact.minor}. This is a floor (~30% of real WCAG). It is not a 0/100 score.`,
		severity: violationsByImpact.critical > 0 ? "high" : "medium",
		effortBucket: "custom_dev",
		affectedPageCount: a11yPages,
		affectedUrlsSample: pages.filter((p) => p.accessibilityViolations.length).slice(0, 6).map((p) => p.url),
		detectionMethod: "axe-core 4.x on the hydrated DOM",
		sprintPriority: "P1"
	});
	let totalImages = 0;
	let missingAlt = 0;
	for (const p of ok) {
		totalImages += p.signals.imageCount;
		missingAlt += p.signals.emptyAltCount;
	}
	const imageAltCoveragePct = totalImages > 0 ? Math.round((1 - missingAlt / totalImages) * 1e3) / 10 : 100;
	const conversionBlockers = findings.filter((f) => f.sprintPriority === "P0" && f.findingType !== "duplicate_nav").length;
	const scorecard = buildScorecard({
		totalPages: pages.length,
		orphanPageCount: orphans.length,
		pagesOverThreeClicks: pages.filter((p) => p.depth > 3).length,
		thinContentCount: thin.length,
		duplicateContentPageCount: dupTitlePages.length,
		missingH1Count: missingH1.length,
		imageAltCoveragePct,
		pagesWithAccessibilityIssues: a11yPages,
		accessibilityViolationsByImpact: violationsByImpact,
		missingTitleCount: missingTitle.length,
		missingMetaDescriptionCount: missingMeta.length,
		canonicalMissingCount: ok.filter((p) => !p.canonical).length,
		duplicateTitlePageCount: dupTitlePages.length,
		conversionBlockers,
		cmsLeftoverPages: leftovers.length,
		cookieGatedPages: cookieGated.length
	});
	const features = detectFeatures(pages, new Set(ok.map((p) => (p.htmlLang || "").split("-")[0]).filter(Boolean)).size > 1);
	const journeys = buildJourneyMap(pages);
	const depths = ok.map((p) => p.depth);
	const avgClickDepth = depths.length ? Math.round(depths.reduce((a, b) => a + b, 0) / depths.length * 10) / 10 : 0;
	const narrative = {
		scorecard,
		findings,
		totalPages: pages.length,
		cookieGatedPages: cookieGated.length,
		truncated: opts.truncated
	};
	return {
		id: opts.id,
		startUrl,
		host: (() => {
			try {
				return new URL(startUrl).hostname;
			} catch {
				return startUrl;
			}
		})(),
		crawledAt: (/* @__PURE__ */ new Date()).toISOString(),
		durationSeconds: opts.durationSeconds,
		pageCount: pages.length,
		pages: pages.map((p) => ({
			url: p.url,
			title: p.title,
			statusCode: p.statusCode,
			depth: p.depth,
			wordCount: p.wordCount,
			h1Text: p.h1Text,
			error: p.error,
			signals: p.signals
		})),
		scorecard,
		findings,
		plainTerms: generateInPlainTerms(narrative),
		uxLeadAssessment: generateUxLeadAssessment(narrative),
		nextSprint: nextSprintFromFindings(findings),
		heuristics: heuristicCards(findings),
		featureMatrix: features,
		journeys,
		keywords: topKeywords(pages),
		crawlMeta: {
			jsHeavyPages: ok.filter((p) => p.isClientRendered || p.signals.hydrationWaitedMs > 1500).length,
			cookieBanners: cookieCover.length,
			cookieGatedPages: cookieGated.length,
			cookiesDismissed: ok.filter((p) => p.signals.cookieDismissed).length,
			spaHydrationPages: ok.filter((p) => p.signals.wordCountBeforeConsent + 40 < p.wordCount).length,
			truncated: opts.truncated
		},
		orphanPageCount: orphans.length,
		thinContentCount: thin.length,
		duplicateTitlePageCount: dupTitlePages.length,
		missingH1Count: missingH1.length,
		pagesWithA11yIssues: a11yPages,
		maxClickDepth: depths.length ? Math.max(...depths) : 0,
		avgClickDepth,
		isSample: opts.isSample
	};
}
function signals(partial) {
	return {
		htmlLang: "en",
		htmlDir: "ltr",
		cookieBannerVisible: true,
		cookieGatingCopy: false,
		cookieDismissed: true,
		iframeSrcs: [],
		iframeGatedCount: 0,
		duplicateNavLabels: [
			"Book appointment",
			"Doctors",
			"Hospitals & Clinics",
			"Specialities",
			"Patient Portal"
		],
		cmsLeftovers: ["Hirslanden"],
		chatWidget: true,
		searchPlaceholder: "Keyword...",
		emptyAltCount: 6,
		imageCount: 14,
		navLabels: [
			"Book appointment",
			"Doctors",
			"Hospitals & Clinics",
			"Specialities",
			"Patient Portal",
			"Book appointment",
			"Doctors",
			"Careers",
			"Contact",
			"AR"
		],
		hydrationWaitedMs: 2100,
		wordCountBeforeConsent: 80,
		...partial
	};
}
function page(p) {
	return {
		finalUrl: p.url,
		statusCode: 200,
		responseTimeMs: 1800,
		depth: 1,
		title: null,
		metaDescription: "Mediclinic Middle East",
		h1Text: "Heading",
		canonical: p.url,
		wordCount: 420,
		htmlLang: "en",
		isClientRendered: true,
		internalLinks: [
			"https://www.mediclinic.ae/en/corporate/home.html",
			"https://www.mediclinic.ae/en/corporate/book-an-appointment.html",
			"https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor.html",
			"https://www.mediclinic.ae/en/corporate/emergency.html"
		],
		externalLinks: ["https://careers.mediclinic.com/MiddleEast/?locale=en_GB"],
		accessibilityViolations: [
			{
				id: "image-alt",
				impact: "serious",
				description: "Images must have alternate text",
				nodesCount: 4
			},
			{
				id: "button-name",
				impact: "critical",
				description: "Buttons must have discernible text",
				nodesCount: 1
			},
			{
				id: "color-contrast",
				impact: "moderate",
				description: "Elements must have sufficient color contrast",
				nodesCount: 6
			}
		],
		detectedGlobals: [
			"dataLayer",
			"gtag",
			"OneTrust",
			"hj"
		],
		nonFunctionalHrefs: [],
		error: null,
		signals: signals({}),
		visibleTextSample: "Expertise you can trust Book appointment Find a Doctor Hospitals & Clinics Special Offers Patient Portal Hirslanden Home NEED HELP? Cookie Settings",
		...p
	};
}
function buildMediclinicSample() {
	const home = "https://www.mediclinic.ae/en/corporate/home.html";
	const report = analyzeSite([
		page({
			url: home,
			depth: 0,
			title: "Hospitals & Clinics in UAE - Mediclinic Middle East",
			h1Text: "Expertise you can trust",
			wordCount: 717,
			internalLinks: [
				home,
				"https://www.mediclinic.ae/en/corporate/book-an-appointment.html",
				"https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor.html",
				"https://www.mediclinic.ae/en/corporate/emergency.html",
				"https://www.mediclinic.ae/en/corporate/hospitals-and-clinics.html",
				"https://www.mediclinic.ae/en/corporate/patient-portal.html",
				"https://www.mediclinic.ae/en/corporate/contact-us.html",
				"https://www.mediclinic.ae/en/corporate/health-insurance.html",
				"https://www.mediclinic.ae/en/corporate/media-and-news.html",
				"https://www.mediclinic.ae/en/corporate/about-mediclinic-middle-east.html",
				"https://www.mediclinic.ae/ar/corporate/home.html",
				"https://www.mediclinic.ae/en/corporate/search.html",
				"https://www.mediclinic.ae/en/corporate/working-with-mediclinic.html"
			],
			visibleTextSample: "Expertise you can trust Book appointment Doctors Hospitals & Clinics Specialities Patient Portal Hirslanden Home The Mediclinic App Virtual Health Services Perimenopause Package Cookie Settings NEED HELP?"
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/book-an-appointment.html",
			title: "Book an Appointment with Our Doctors - Mediclinic Middle East",
			h1Text: "Book an Appointment at Mediclinic",
			wordCount: 210,
			signals: signals({
				cookieGatingCopy: true,
				iframeGatedCount: 1,
				iframeSrcs: ["https://booking.mediclinic.ae/en/booking"],
				cookieDismissed: false
			}),
			visibleTextSample: "Book an Appointment at Mediclinic Please accept functional cookies to see this content. Cookie Settings Download the app 800 1999 Hirslanden Home NEED HELP?"
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor.html",
			title: "Best Doctor and Healthcare Professionals - Mediclinic Middle East",
			h1Text: "Find a Doctor at Mediclinic",
			wordCount: 380,
			signals: signals({
				cmsLeftovers: [
					"Hirslanden",
					"Seite ",
					"Key word/name"
				],
				searchPlaceholder: "Key word/name"
			}),
			visibleTextSample: "Find a Doctor at Mediclinic Key word/name Hospital Speciality Language Gender Dr. Aadil Gutta Begad Mohamed Samy A. Abbas Dr. Dr. Abdalla Al Hajiri (ID*) Seite 3 Seite 4 Seite 5 Display more Hirslanden Home"
		}),
		page({
			url: "https://www.mediclinic.ae/ar/corporate/home.html",
			title: "المستشفيات والعيادات في الإمارات | ميديكلينيك الشرق الأوسط",
			h1Text: "أخصائيون تثق بهم",
			htmlLang: "ar",
			wordCount: 640,
			signals: signals({
				htmlLang: "ar",
				htmlDir: "ltr",
				cmsLeftovers: ["Hirslanden"],
				duplicateNavLabels: [
					"Book appointment",
					"Doctors",
					"Hospitals & Clinics",
					"Specialities",
					"Patient Portal"
				]
			}),
			visibleTextSample: "أخصائيون تثق بهم Book appointment Doctors Hospitals & Clinics Specialities Patient Portal Hirslanden Home Cookie Settings NEED HELP?"
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/emergency.html",
			title: "Mediclinic Emergency - Mediclinic Middle East",
			h1Text: "Emergency",
			wordCount: 280,
			visibleTextSample: "Emergency number 999/998 WHERE did it happen WHO is calling Mediclinic Airport Road Hospital Postcode * Next to Zayed Sports City Phone 800 1 999 Hirslanden Home Cookie Settings"
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/patient-portal.html",
			title: "Patient Portal",
			metaDescription: null,
			h1Text: "Patient Portal",
			wordCount: 160
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics.html",
			title: "Clinics & Hospitals in Dubai & Abu Dhabi - Mediclinic",
			h1Text: "Hospitals & Clinics",
			wordCount: 520
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/health-insurance.html",
			title: "Health Insurance Partners - Mediclinic Middle East",
			h1Text: "Health Insurance",
			wordCount: 340
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/contact-us.html",
			title: "Contact Mediclinic UAE - Mediclinic Middle East",
			h1Text: "Contact Mediclinic Middle East",
			wordCount: 290
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/media-and-news.html",
			title: "News & Updates - News",
			h1Text: "Media & News",
			wordCount: 410
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/about-mediclinic-middle-east.html",
			title: "About Mediclinic Middle East",
			h1Text: "About Mediclinic Middle East",
			wordCount: 480
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/working-with-mediclinic.html",
			title: "Mediclinic Middle East - Careers at Mediclinic",
			h1Text: "Working with Mediclinic",
			wordCount: 300
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/search.html",
			title: "Search results - Mediclinic Middle East",
			h1Text: "Search at Mediclinic",
			wordCount: 90
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/media-kit.html",
			title: "Media Kit - Mediclinic Middle East",
			h1Text: "Media Kit",
			wordCount: 220
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor/30.html",
			title: "Best Doctor and Healthcare Professionals - Mediclinic Middle East",
			h1Text: "Find a Doctor at Mediclinic",
			wordCount: 120,
			depth: 2,
			signals: signals({ cmsLeftovers: ["Seite "] })
		}),
		page({
			url: "https://www.mediclinic.ae/en/corporate/hospitals-and-clinics/find-a-doctor/40.html",
			title: "Best Doctor and Healthcare Professionals - Mediclinic Middle East",
			h1Text: "Find a Doctor at Mediclinic",
			wordCount: 118,
			depth: 2,
			signals: signals({ cmsLeftovers: ["Seite "] })
		})
	], home, {
		truncated: true,
		durationSeconds: 86,
		id: "sample-mediclinic",
		isSample: true
	});
	report.crawledAt = "2026-08-23T09:00:00.000Z";
	return report;
}
var jobs = /* @__PURE__ */ new Map();
var sample = buildMediclinicSample();
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
	report: sample
});
function createJob(url, maxPages) {
	const id = crypto.randomUUID();
	const job = {
		id,
		status: "queued",
		url,
		maxPages,
		crawled: 0,
		queued: 0,
		currentUrl: "",
		error: null,
		startedAt: Date.now(),
		report: null
	};
	jobs.set(id, job);
	return job;
}
function getJob(id) {
	return jobs.get(id);
}
function updateJob(id, patch) {
	const job = jobs.get(id);
	if (!job) return;
	Object.assign(job, patch);
}
function listJobs() {
	return [...jobs.values()].sort((a, b) => b.startedAt - a.startedAt);
}
var server_exports = /* @__PURE__ */ __exportAll({
	getAuditFn_createServerFn_handler: () => getAuditFn_createServerFn_handler,
	listAuditsFn_createServerFn_handler: () => listAuditsFn_createServerFn_handler,
	startAuditFn_createServerFn_handler: () => startAuditFn_createServerFn_handler
});
var StartSchema = object({
	url: string().min(8).max(500),
	maxPages: number().min(3).max(20)
});
function normalizeStartUrl(raw) {
	const trimmed = raw.trim();
	if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
	return trimmed;
}
var startAuditFn_createServerFn_handler = createServerRpc({
	id: "20282c8a1ac1e164cf7041bbcae5c578018368e97989e8a82a9649103383880a",
	name: "startAuditFn",
	filename: "src/lib/audit/server.ts"
}, (opts) => startAuditFn.__executeServer(opts));
var startAuditFn = createServerFn({ method: "POST" }).validator((data) => StartSchema.parse(data)).handler(startAuditFn_createServerFn_handler, async ({ data }) => {
	let url = normalizeStartUrl(data.url);
	try {
		const u = new URL(url);
		if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http(s) URLs");
		url = u.toString();
	} catch {
		throw new Error("Enter a valid website URL, e.g. mediclinic.ae");
	}
	const job = createJob(url, data.maxPages);
	runJob(job.id).catch((err) => {
		updateJob(job.id, {
			status: "error",
			error: err instanceof Error ? err.message : String(err)
		});
	});
	return { id: job.id };
});
var getAuditFn_createServerFn_handler = createServerRpc({
	id: "b8de9a7f445dea5e45df254efdcdd327c0dccf307f215055fcd84f0e05617a06",
	name: "getAuditFn",
	filename: "src/lib/audit/server.ts"
}, (opts) => getAuditFn.__executeServer(opts));
var getAuditFn = createServerFn({ method: "POST" }).validator((data) => object({ id: string() }).parse(data)).handler(getAuditFn_createServerFn_handler, async ({ data }) => {
	const job = getJob(data.id);
	if (!job) return {
		ok: false,
		error: "No audit with that id."
	};
	return {
		ok: true,
		job: {
			id: job.id,
			status: job.status,
			url: job.url,
			maxPages: job.maxPages,
			crawled: job.crawled,
			queued: job.queued,
			currentUrl: job.currentUrl,
			error: job.error,
			report: job.report
		}
	};
});
var listAuditsFn_createServerFn_handler = createServerRpc({
	id: "01e4c63addda9e2caab6a080ee7374bfaf35cfb14c278adb0584f7166af769e7",
	name: "listAuditsFn",
	filename: "src/lib/audit/server.ts"
}, (opts) => listAuditsFn.__executeServer(opts));
var listAuditsFn = createServerFn({ method: "GET" }).handler(listAuditsFn_createServerFn_handler, async () => {
	return listJobs().map((j) => ({
		id: j.id,
		status: j.status,
		url: j.url,
		crawled: j.crawled,
		error: j.error,
		startedAt: j.startedAt,
		host: j.report?.host ?? j.url,
		score: j.report?.scorecard.uxMaturityScore ?? null
	}));
});
async function runJob(id) {
	const job = getJob(id);
	if (!job) return;
	updateJob(id, { status: "running" });
	const started = Date.now();
	const { crawlSite } = await import("./crawler-DSuVCV6d.mjs");
	const pages = await crawlSite({
		startUrl: job.url,
		maxPages: job.maxPages,
		maxDepth: 3,
		respectRobots: true,
		concurrency: 2,
		onProgress: (crawled, queued, currentUrl) => {
			updateJob(id, {
				crawled,
				queued,
				currentUrl
			});
		}
	});
	const report = analyzeSite(pages, job.url, {
		truncated: pages.length >= job.maxPages,
		durationSeconds: Math.round((Date.now() - started) / 100) / 10,
		id
	});
	updateJob(id, {
		status: "done",
		crawled: pages.length,
		queued: 0,
		currentUrl: "",
		report
	});
}
//#endregion
export { urlHost as i, isLikelyNonHtmlResource as n, normalizeCrawlUrl as r, server_exports as t };
