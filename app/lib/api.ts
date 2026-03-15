export interface FetchContentResult {
  text: string;
  title: string;
  novelName: string;
  chapterName: string;
  prevUrl: string | null;
  nextUrl: string | null;
  lang: string;
}

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchViaProxy(url: string): Promise<string | null> {
  for (const makeProxy of CORS_PROXIES) {
    try {
      const res = await fetch(makeProxy(url));
      if (!res.ok) continue;
      const html = await res.text();
      if (html.includes("Just a moment") || html.includes("challenge-platform")) continue;
      return html;
    } catch {
      continue;
    }
  }
  return null;
}

async function callParseApi(
  url: string,
  html: string | null,
  signal?: AbortSignal
): Promise<FetchContentResult | null> {
  const res = await fetch("/api/fetch-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, html }),
    signal,
  });

  const data = await res.json();

  if (data.error === "BLOCKED" || data.error === "PUPPETEER_FAILED") {
    return null;
  }

  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to fetch content");
  }

  return {
    text: data.text,
    title: data.title || "",
    novelName: data.novelName || "",
    chapterName: data.chapterName || "",
    prevUrl: data.prevUrl || null,
    nextUrl: data.nextUrl || null,
    lang: data.lang || "vi",
  };
}

export async function fetchChapterContent(
  url: string,
  signal?: AbortSignal
): Promise<FetchContentResult> {
  // 1. Try server-side fetch
  const serverResult = await callParseApi(url, null, signal);
  if (serverResult) return serverResult;

  // 2. Server blocked — try client-side via CORS proxy
  const html = await fetchViaProxy(url);
  if (html) {
    const proxyResult = await callParseApi(url, html, signal);
    if (proxyResult) return proxyResult;
  }

  throw new Error("Could not fetch content. The site may be blocking all automated requests.");
}

export async function translateTitle(
  title: string,
  apiKey: string,
  model: string,
  prompt?: string
): Promise<string> {
  if (!title.trim() || !apiKey) return title;

  try {
    const res = await fetch("/api/translate-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, apiKey, model, prompt }),
    });

    if (!res.ok) return title;

    const data = await res.json();
    return data.translated || title;
  } catch {
    return title;
  }
}

export async function simplifyText(
  text: string,
  apiKey: string,
  model: string,
  lang?: string,
  signal?: AbortSignal,
  onChunk?: (accumulated: string) => void
): Promise<string> {
  const res = await fetch("/api/simplify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, apiKey, model, lang: lang || "vi" }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to simplify");
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let result = "";

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
      onChunk?.(result);
    }
  }

  return result;
}
