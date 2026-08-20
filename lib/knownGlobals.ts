/**
 * Domain-based matching (see classifyIntegrations in reportAnalysis.ts)
 * can only recognize a tool if you already know which domain it's
 * served from — and misses anything self-hosted, proxied through a
 * first-party domain, or simply not on the hardcoded list. Checking
 * which global variables a tool actually defines on `window` after
 * the page renders is a stronger signal: it reflects what the site's
 * real, executed code initialized, regardless of where the script
 * file itself was loaded from. This is genuinely "detecting on the
 * live site" rather than pattern-matching a predefined domain list.
 *
 * Still not exhaustive — a tool has to be known to this list to be
 * named. Anything that initializes without touching `window` (rare,
 * but possible for privacy-conscious or sandboxed integrations) won't
 * be caught by this method either. Combined with domain matching, this
 * catches meaningfully more than either approach alone.
 */
export const KNOWN_GLOBALS: { globalVar: string; name: string; category: string }[] = [
  { globalVar: "dataLayer", name: "Google Tag Manager", category: "Tag Manager" },
  { globalVar: "gtag", name: "Google Analytics / Ads", category: "Analytics" },
  { globalVar: "ga", name: "Google Analytics (legacy)", category: "Analytics" },
  { globalVar: "fbq", name: "Meta Pixel", category: "Marketing" },
  { globalVar: "_hjSettings", name: "Hotjar", category: "Analytics" },
  { globalVar: "hj", name: "Hotjar", category: "Analytics" },
  { globalVar: "Intercom", name: "Intercom", category: "Chat / Support" },
  { globalVar: "drift", name: "Drift", category: "Chat / Support" },
  { globalVar: "zE", name: "Zendesk Widget", category: "Chat / Support" },
  { globalVar: "Tawk_API", name: "Tawk.to", category: "Chat / Support" },
  { globalVar: "LiveChatWidget", name: "LiveChat", category: "Chat / Support" },
  { globalVar: "mixpanel", name: "Mixpanel", category: "Analytics" },
  { globalVar: "amplitude", name: "Amplitude", category: "Analytics" },
  { globalVar: "heap", name: "Heap Analytics", category: "Analytics" },
  { globalVar: "_learnq", name: "Klaviyo", category: "Marketing" },
  { globalVar: "klaviyo", name: "Klaviyo", category: "Marketing" },
  { globalVar: "optimizely", name: "Optimizely", category: "A/B Testing" },
  { globalVar: "Cookiebot", name: "Cookiebot", category: "Compliance" },
  { globalVar: "OneTrust", name: "OneTrust", category: "Compliance" },
  { globalVar: "Osano", name: "Osano", category: "Compliance" },
  { globalVar: "_hsq", name: "HubSpot", category: "Marketing" },
  { globalVar: "HubSpotConversations", name: "HubSpot Chat", category: "Chat / Support" },
  { globalVar: "Beacon", name: "HelpScout", category: "Chat / Support" },
  { globalVar: "utag", name: "Tealium", category: "Tag Manager" },
  { globalVar: "QSI", name: "Qualtrics", category: "Survey" },
  { globalVar: "pendo", name: "Pendo", category: "Product Analytics" },
  { globalVar: "FS", name: "FullStory", category: "Analytics" },
  { globalVar: "clarity", name: "Microsoft Clarity", category: "Analytics" },
  { globalVar: "twq", name: "X (Twitter) Pixel", category: "Marketing" },
  { globalVar: "snaptr", name: "Snapchat Pixel", category: "Marketing" },
  { globalVar: "ttq", name: "TikTok Pixel", category: "Marketing" },
  { globalVar: "lintrk", name: "LinkedIn Insight Tag", category: "Marketing" },
  { globalVar: "rdt", name: "Reddit Pixel", category: "Marketing" },
  { globalVar: "Sentry", name: "Sentry", category: "Error Monitoring" },
  { globalVar: "Rollbar", name: "Rollbar", category: "Error Monitoring" },
  { globalVar: "Bugsnag", name: "Bugsnag", category: "Error Monitoring" },
  { globalVar: "Trustpilot", name: "Trustpilot", category: "Reviews" },
  { globalVar: "algoliasearch", name: "Algolia", category: "Search" },
];

export const KNOWN_GLOBAL_VAR_NAMES = KNOWN_GLOBALS.map((g) => g.globalVar);
