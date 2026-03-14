import puppeteer from "puppeteer";

interface SiteConfig {
  wait: string;
  content: string;
  lang?: "vi" | "zh";
  extract?: string; // custom JS to run for content extraction
}

const SITE_SELECTORS: Record<string, SiteConfig> = {
  "tangthuvien.net": {
    wait: 'div[class*="box-chap"]',
    content: 'div[class*="box-chap box-chap-"]',
  },
  "webnovel.vn": {
    wait: ".reader__content",
    content: ".reader__content",
  },
  "tvtruyen.com": {
    wait: "#chapter-content",
    content: "#chapter-content",
  },
  "69shuba": {
    wait: "div.txtnav",
    content: "div.txtnav",
    lang: "zh",
  },
  "69shu": {
    wait: "div.txtnav",
    content: "div.txtnav",
    lang: "zh",
  },
};

function rewriteUrl(url: string): string {
  // 69shuba.tw has unbypassable CAPTCHA — reject it
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

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      await page.goto(fetchUrl, { waitUntil: "networkidle2", timeout: 30000 });

      await page.waitForSelector(siteConfig.wait, { timeout: 10000 });

      const result = await page.evaluate((selector: string, lang: string) => {
        const el = document.querySelector(selector);

        // For 69shu: remove non-content elements inside txtnav
        if (lang === "zh" && el) {
          const toRemove = el.querySelectorAll("h1, div.txtinfo, div#txtright, script, .ad, .ads");
          toRemove.forEach((e) => e.remove());
        }

        const text = el?.textContent ?? "";

        // Extract prev/next navigation links
        let prevUrl: string | null = null;
        let nextUrl: string | null = null;

        // Method 1: rel="prev" / rel="next" (webnovel.vn)
        const relPrev = document.querySelector('a[rel="prev"]') as HTMLAnchorElement | null;
        const relNext = document.querySelector('a[rel="next"]') as HTMLAnchorElement | null;
        if (relPrev) prevUrl = relPrev.href;
        if (relNext) nextUrl = relNext.href;

        // Method 2: text-based "Chương trước" / "Tiếp theo" (tvtruyen.com)
        if (!prevUrl || !nextUrl) {
          const allLinks = document.querySelectorAll("a");
          for (const link of allLinks) {
            const linkText = link.textContent?.trim() ?? "";
            if (!prevUrl && (linkText === "Chương trước" || linkText === "上一章")) prevUrl = link.href;
            if (!nextUrl && (linkText === "Tiếp theo" || linkText === "Chương sau" || linkText === "下一章")) nextUrl = link.href;
          }
        }

        // Method 3: class-based navigation (tangthuvien.net)
        if (!prevUrl || !nextUrl) {
          const prevEl = document.querySelector('a.truoc') as HTMLAnchorElement | null;
          const nextEl = document.querySelector('a.sau') as HTMLAnchorElement | null;
          if (prevEl && !prevUrl) prevUrl = prevEl.href;
          if (nextEl && !nextUrl) nextUrl = nextEl.href;
        }

        // Extract title
        const rawTitle =
          document.querySelector("h1")?.textContent?.trim() ||
          document.querySelector("title")?.textContent?.trim() ||
          "";

        return { text, prevUrl, nextUrl, title: rawTitle };
      }, siteConfig.content, siteConfig.lang || "vi");

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
      const titleStr = result.title || "";

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
    } finally {
      await browser.close();
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
