import * as cheerio from "cheerio";

interface SiteConfig {
  content: string;
  lang?: "vi" | "zh";
  removeSelectors?: string[];
}

const SITE_SELECTORS: Record<string, SiteConfig> = {
  "webnovel.vn": {
    content: ".reader__content",
  },
  "tvtruyen.com": {
    content: "#chapter-content",
  },
  "69shuba": {
    content: "div.txtnav",
    lang: "zh",
    removeSelectors: ["h1", "div.txtinfo", "div#txtright", "script", ".ad", ".ads"],
  },
  "69shu": {
    content: "div.txtnav",
    lang: "zh",
    removeSelectors: ["h1", "div.txtinfo", "div#txtright", "script", ".ad", ".ads"],
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

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function extractNav($: cheerio.CheerioAPI): { prevUrl: string | null; nextUrl: string | null } {
  let prevUrl: string | null = null;
  let nextUrl: string | null = null;

  // Method 1: rel="prev" / rel="next"
  const relPrev = $('a[rel="prev"]').attr("href");
  const relNext = $('a[rel="next"]').attr("href");
  if (relPrev) prevUrl = relPrev;
  if (relNext) nextUrl = relNext;

  // Method 2: text-based links
  if (!prevUrl || !nextUrl) {
    $("a").each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href");
      if (!href) return;
      if (!prevUrl && (text === "Chương trước" || text === "上一章")) prevUrl = href;
      if (!nextUrl && (text === "Tiếp theo" || text === "Chương sau" || text === "下一章")) nextUrl = href;
    });
  }

  // Method 3: class-based
  if (!prevUrl) prevUrl = $("a.truoc").attr("href") || null;
  if (!nextUrl) nextUrl = $("a.sau").attr("href") || null;

  return { prevUrl, nextUrl };
}

function extractTitle($: cheerio.CheerioAPI): string {
  return $("h1").first().text().trim() || $("title").text().trim() || "";
}

async function fetchWithCheerio(fetchUrl: string, siteConfig: SiteConfig) {
  const res = await fetch(fetchUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,vi;q=0.6",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Sec-Ch-Ua": '"Chromium";v="120", "Not_A Brand";v="8"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"macOS"',
      "Referer": new URL(fetchUrl).origin + "/",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch page: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove unwanted elements
  if (siteConfig.removeSelectors) {
    for (const sel of siteConfig.removeSelectors) {
      $(siteConfig.content).find(sel).remove();
    }
  }

  const contentEl = $(siteConfig.content);
  if (!contentEl.length) {
    throw new Error("Could not find chapter content on this page");
  }

  const text = contentEl.text();
  const titleStr = extractTitle($);
  const { prevUrl, nextUrl } = extractNav($);

  return { text, titleStr, prevUrl, nextUrl };
}


export async function POST(req: Request) {
  try {
    const { url } = await req.json();

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

    const result = await fetchWithCheerio(fetchUrl, siteConfig);

    if (!result.text.trim()) {
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

    // Parse title: 69shuba format is "Novel - Chapter - Website"
    let novelName = "";
    let chapterName = "";
    const titleStr = result.titleStr || "";

    if (siteConfig.lang === "zh") {
      const parts = titleStr.split(" - ");
      if (parts.length >= 3) {
        novelName = parts[0].trim();
        chapterName = parts[1].trim();
      } else if (parts.length === 2) {
        novelName = parts[0].trim();
        chapterName = parts[1].trim();
      } else {
        chapterName = titleStr;
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
