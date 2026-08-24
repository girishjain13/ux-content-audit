const NON_HTML = /\.(pdf|docx?|xlsx?|pptx?|csv|rtf|zip|rar|7z|tar|gz|jpe?g|png|gif|svg|webp|ico|bmp|tiff?|mp4|mp3|wav|avi|mov|webm|ogg|woff2?|ttf|eot|xml|json)(\?|#|$)/i;

export function isLikelyNonHtmlResource(url: string): boolean {
  try {
    return NON_HTML.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function normalizeCrawlUrl(rawUrl: string): string {
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

export function sameHost(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, "");
    const hb = new URL(b).hostname.replace(/^www\./, "");
    return ha === hb;
  } catch {
    return false;
  }
}

export function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
