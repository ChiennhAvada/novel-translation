import * as cheerio from "cheerio";

interface SiteConfig {
  content: string;
  lang?: "vi" | "zh";
  removeSelectors?: string[];
}

const SITE_SELECTORS: Record<string, SiteConfig> = {
  "quanben.io": {
    content: "#content",
    lang: "zh",
  },
  "www.22biqu.com": {
    content: "#content",
    lang: "zh",
  },
  "m.22biqu.com": {
    content: "#chaptercontent",
    lang: "zh",
  },
};

function rewriteUrl(url: string): string {
  if (url.includes("69shuba.tw")) {
    throw new Error(
      "69shuba.tw is blocked by CAPTCHA. Use 69shuba.com instead (same novels, e.g. https://www.69shuba.com/book/NOVEL_ID.htm)"
    );
  }
  return url;
}

function getSiteConfig(url: string) {
  for (const [domain, config] of Object.entries(SITE_SELECTORS)) {
    if (url.includes(domain)) return config;
  }
  return null;
}

function extractNav($: cheerio.CheerioAPI): { prevUrl: string | null; nextUrl: string | null } {
  let prevUrl: string | null = null;
  let nextUrl: string | null = null;

  const relPrev = $('a[rel="prev"]').attr("href");
  const relNext = $('a[rel="next"]').attr("href");
  if (relPrev) prevUrl = relPrev;
  if (relNext) nextUrl = relNext;

  if (!prevUrl || !nextUrl) {
    $("a").each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href");
      if (!href) return;
      if (!prevUrl && (text === "Chương trước" || text === "上一章" || text === "上一页")) prevUrl = href;
      if (!nextUrl && (text === "Tiếp theo" || text === "Chương sau" || text === "下一章" || text === "下一页")) nextUrl = href;
    });
  }

  if (!prevUrl) prevUrl = $("a.truoc").attr("href") || null;
  if (!nextUrl) nextUrl = $("a.sau").attr("href") || null;

  return { prevUrl, nextUrl };
}

function extractTitles($: cheerio.CheerioAPI): { fullTitle: string; h1: string } {
  return {
    fullTitle: $("title").text().trim() || "",
    h1: $("h1").first().text().trim() || "",
  };
}

function parseHtml(html: string, siteConfig: SiteConfig, baseUrl: string) {
  const $ = cheerio.load(html);

  if (siteConfig.removeSelectors) {
    for (const sel of siteConfig.removeSelectors) {
      $(siteConfig.content).find(sel).remove();
    }
  }

  const contentEl = $(siteConfig.content);
  if (!contentEl.length) {
    return null;
  }

  const text = contentEl.text();
  const { fullTitle, h1 } = extractTitles($);
  let { prevUrl, nextUrl } = extractNav($);

  const origin = new URL(baseUrl).origin;
  if (prevUrl && !prevUrl.startsWith("http")) prevUrl = origin + prevUrl;
  if (nextUrl && !nextUrl.startsWith("http")) nextUrl = origin + nextUrl;

  return { text, fullTitle, h1, prevUrl, nextUrl };
}

async function fetchWithCheerio(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,vi;q=0.6",
      Referer: new URL(url).origin + "/",
    },
  });

  if (!res.ok) return null;

  const html = await res.text();
  // Detect Cloudflare challenge page
  if (html.includes("Just a moment") || html.includes("challenge-platform")) {
    return null;
  }
  return html;
}

async function fetchWithPuppeteer(url: string, contentSelector: string): Promise<string> {
  const puppeteer = await import("puppeteer-core");
  const isDev = process.env.NODE_ENV === "development";

  let executablePath: string;
  let args: string[];

  if (isDev) {
    // Local: use installed Chrome
    const possiblePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ];
    executablePath = possiblePaths.find((p) => {
      try { require("fs").accessSync(p); return true; } catch { return false; }
    }) || possiblePaths[0];
    args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"];
  } else {
    // Production (Vercel): use @sparticuz/chromium-min with remote binary
    const chromium = await import("@sparticuz/chromium-min");
    executablePath = await chromium.default.executablePath(
      "https://github.com/nichochar/chromium-brotli/releases/download/v143.0.0/chromium-v143.0.0-pack.tar"
    );
    args = chromium.default.args;
  }

  const browser = await puppeteer.default.launch({
    args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Hide webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for content to appear (Cloudflare challenge may take a few seconds)
    await page.waitForSelector(contentSelector, { timeout: 15000 });

    return await page.content();
  } finally {
    await browser.close();
  }
}

export async function POST(req: Request) {
  try {
    const { url, html: providedHtml } = await req.json();

    if (!url || typeof url !== "string") {
      return Response.json({ error: "Missing URL" }, { status: 400 });
    }

    const siteConfig = getSiteConfig(url);
    if (!siteConfig) {
      const supported = Object.keys(SITE_SELECTORS).join(", ");
      return Response.json(
        { error: `Unsupported site. Supported: ${supported}` },
        { status: 400 }
      );
    }

    const fetchUrl = rewriteUrl(url);

    // 1. Use provided HTML if available
    // 2. Try simple fetch
    // 3. Fallback to Puppeteer for Cloudflare-protected sites
    let pageHtml = providedHtml || (await fetchWithCheerio(fetchUrl));

    if (!pageHtml) {
      pageHtml = await fetchWithPuppeteer(fetchUrl, siteConfig.content);
    }

    const result = parseHtml(pageHtml, siteConfig, fetchUrl);

    if (!result || !result.text.trim()) {
      return Response.json(
        { error: "Could not find chapter content on this page" },
        { status: 422 }
      );
    }

    const cleaned = result.text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    let novelName = "";
    let chapterName = "";
    const titleStr = result.fullTitle || result.h1 || "";

    if (siteConfig.lang === "zh") {
      // Try splitting title by common separators: "_" or " - "
      // 22biqu:   "第2章 飞剑_叩问仙道_笔趣阁"  → chapter_novel_site
      // quanben:  "第1章 山边小村 凡人修仙传 - 全本小说网" → h1 + novel - site
      const underscoreParts = result.fullTitle.split("_");
      if (underscoreParts.length >= 3) {
        // Format: chapterName_novelName_siteName
        chapterName = underscoreParts[0].trim();
        novelName = underscoreParts[1].trim();
      } else {
        // H1 is the chapter title (quanben style)
        chapterName = result.h1 || "";

        // Derive novel name: remove h1 and site name from full title
        if (result.fullTitle && chapterName) {
          let remaining = result.fullTitle;
          remaining = remaining.replace(chapterName, "").trim();
          remaining = remaining.split(" - ")[0].trim();
          if (remaining) novelName = remaining;
        }

        // Fallback: if title has " - " pattern like "Novel - Chapter - Site"
        if (!novelName && !chapterName) {
          const parts = titleStr.split(" - ");
          if (parts.length >= 2) {
            novelName = parts[0].trim();
            chapterName = parts[1].trim();
          } else {
            chapterName = titleStr;
          }
        }
      }
    }

    return Response.json({
      text: cleaned,
      prevUrl: result.prevUrl,
      nextUrl: result.nextUrl,
      title: titleStr,
      novelName,
      chapterName,
      lang: siteConfig.lang || "vi",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
