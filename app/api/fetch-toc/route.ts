import * as cheerio from "cheerio";

interface TOCSiteConfig {
  // CSS selector for chapter links (applied to the correct container)
  linkSelector: string;
  // CSS selector for the container holding the full chapter list
  // If multiple matches, uses the last one (to skip "latest chapters" sections)
  containerSelector: string;
  // How to build the TOC URL from user input
  buildTocUrl?: (url: string) => string;
  // Whether to follow pagination links
  paginated?: boolean;
  // Max pages to follow (safety limit)
  maxPages?: number;
}

const TOC_SELECTORS: Record<string, TOCSiteConfig> = {
  "22biqu.com": {
    containerSelector: ".section-box",
    linkSelector: ".section-list a",
    paginated: true,
    maxPages: 50,
    // Rewrite m.22biqu.com → www.22biqu.com for full chapter list
    buildTocUrl: (url: string) => url.replace("://m.22biqu.com", "://www.22biqu.com"),
  },
  "quanben.io": {
    containerSelector: ".list2",
    linkSelector: "a[href]",
    buildTocUrl: (url: string) => {
      const clean = url.replace(/\/$/, "");
      if (!clean.endsWith("/list.html")) return clean + "/list.html";
      return clean;
    },
  },
};

function getTOCConfig(url: string): { domain: string; config: TOCSiteConfig } | null {
  for (const [domain, config] of Object.entries(TOC_SELECTORS)) {
    if (url.includes(domain)) return { domain, config };
  }
  return null;
}

async function fetchPage(url: string): Promise<string | null> {
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
  if (html.includes("Just a moment") || html.includes("challenge-platform")) return null;
  return html;
}

interface ChapterEntry {
  title: string;
  url: string;
}

function extractChapters(
  html: string,
  config: TOCSiteConfig,
  baseUrl: string
): { chapters: ChapterEntry[]; nextPageUrl: string | null } {
  const $ = cheerio.load(html);
  const origin = new URL(baseUrl).origin;
  const chapters: ChapterEntry[] = [];

  // Use the last matching container to skip "latest chapters" sections
  const containers = $(config.containerSelector);
  const container = containers.length > 1 ? containers.last() : containers.first();

  container.find(config.linkSelector).each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (!href || !text) return;
    // Skip non-chapter links (pagination, etc.)
    if (!href.includes(".html")) return;
    const fullUrl = href.startsWith("http") ? href : origin + href;
    chapters.push({ title: text, url: fullUrl });
  });

  // Find next page link for pagination
  let nextPageUrl: string | null = null;
  if (config.paginated) {
    $("a").each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href");
      if (text === "下一页" && href) {
        nextPageUrl = href.startsWith("http") ? href : origin + href;
      }
    });
  }

  return { chapters, nextPageUrl };
}

function extractNovelName(html: string): string {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const underscoreParts = title.split("_");
  if (underscoreParts.length >= 2) return underscoreParts[0].trim();
  const dashParts = title.split(" - ");
  if (dashParts.length >= 2) return dashParts[0].trim();
  return title;
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return Response.json({ error: "Missing URL" }, { status: 400 });
    }

    const match = getTOCConfig(url);
    if (!match) {
      const supported = Object.keys(TOC_SELECTORS).join(", ");
      return Response.json(
        { error: `Unsupported site for TOC. Supported: ${supported}` },
        { status: 400 }
      );
    }

    const { config } = match;
    const tocUrl = config.buildTocUrl ? config.buildTocUrl(url) : url;

    const firstHtml = await fetchPage(tocUrl);
    if (!firstHtml) {
      return Response.json(
        { error: "Could not fetch TOC page" },
        { status: 422 }
      );
    }

    const novelName = extractNovelName(firstHtml);
    const allChapters: ChapterEntry[] = [];

    // First page
    let { chapters, nextPageUrl } = extractChapters(firstHtml, config, tocUrl);
    allChapters.push(...chapters);

    // Follow pagination
    if (config.paginated) {
      let pageCount = 1;
      const maxPages = config.maxPages || 50;
      while (nextPageUrl && pageCount < maxPages) {
        const pageHtml = await fetchPage(nextPageUrl);
        if (!pageHtml) break;
        const result = extractChapters(pageHtml, config, nextPageUrl);
        allChapters.push(...result.chapters);
        nextPageUrl = result.nextPageUrl;
        pageCount++;
      }
    }

    if (allChapters.length === 0) {
      return Response.json(
        { error: "No chapters found on this page" },
        { status: 422 }
      );
    }

    return Response.json({
      chapters: allChapters.map((c, i) => ({
        index: i,
        title: c.title,
        url: c.url,
      })),
      novelName,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
