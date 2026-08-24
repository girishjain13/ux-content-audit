import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Northline";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#f4efe6" },
      {
        name: "description",
        content: "UX and content audits that wait for JavaScript — cookie walls, hydration, and conversion paths included.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-line bg-surface/80 backdrop-blur">
              <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
                <Link to="/" className="flex items-center gap-2.5 no-underline">
                  <span className="grid size-7 place-items-center rounded-[8px] bg-ink text-[11px] font-semibold tracking-wide text-paper">
                    N
                  </span>
                  <span className="font-display text-[17px] font-medium tracking-tight text-ink">Northline</span>
                </Link>
                <p className="hidden text-[12px] text-ink-muted sm:block">UX lead audits for JS-heavy sites</p>
              </div>
            </header>
            <Outlet />
          </div>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
