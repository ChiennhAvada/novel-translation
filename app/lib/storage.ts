import { SavedChapter, ReaderSettings } from "./types";

const STORAGE_KEY = "novel-translator-chapters";
const CURRENT_KEY = "novel-translator-current";
const SETTINGS_KEY = "novel-translator-settings";
const SCROLL_KEY = "novel-translator-scroll";

const DEFAULT_SETTINGS: ReaderSettings = {
  bgColor: "#1a1a2e",
  fontSize: 18,
  lineSpacing: 1.8,
  autoLineBreak: true,
  openaiApiKey: "",
  geminiApiKey: "",
  claudeApiKey: "",
  aiModel: "gemini-3-flash-preview",
  customPrompt: "",
  appLang: "vi",
  autoClearChapters: true,
  autoClearChaptersKeep: 20,
  autoClearNovels: false,
};

// Extract novel slug from URL
// tvtruyen.com:    /tien-vo-de-ton-dich/chuong-1-xxx  → tien-vo-de-ton-dich
// tangthuvien.net: /doc-truyen/novel-slug/chuong-1     → novel-slug
// webnovel.vn:     /novel-slug/chuong-1/               → novel-slug
export function extractNovelSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, "");
    const parts = pathname.split("/").filter(Boolean);

    if (url.includes("tangthuvien.net")) {
      // /doc-truyen/novel-slug/chuong-X
      const idx = parts.indexOf("doc-truyen");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }

    // quanben.io: /n/novel-slug/1.html → novel-slug
    if (url.includes("quanben.io")) {
      const nIdx = parts.indexOf("n");
      if (nIdx >= 0 && parts[nIdx + 1]) return parts[nIdx + 1];
    }

    // 22biqu.com: /biqu59699/30115507.html → biqu59699
    if (url.includes("22biqu.com")) {
      if (parts.length >= 1) return parts[0];
    }

    // 69shuba.com: /txt/NOVEL_ID/CHAPTER_ID → NOVEL_ID
    if (url.includes("69shuba") || url.includes("69shu")) {
      const txtIdx = parts.indexOf("txt");
      if (txtIdx >= 0 && parts[txtIdx + 1]) return parts[txtIdx + 1];
      const bookIdx = parts.indexOf("book");
      if (bookIdx >= 0 && parts[bookIdx + 1]) return parts[bookIdx + 1].replace(".htm", "");
    }

    // tvtruyen.com: /novel-slug/chuong-X
    // webnovel.vn:  /novel-slug/chuong-X
    if (parts.length >= 2) return parts[0];
    return parts[0] || "unknown";
  } catch {
    return "unknown";
  }
}

export function getSavedChapters(): SavedChapter[] {
  try {
    const chapters: SavedChapter[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    return chapters.map((c) => ({
      ...c,
      novelName: c.novelName || "",
      novelSlug: c.novelSlug || extractNovelSlug(c.url),
      prevUrl: c.prevUrl ?? null,
      nextUrl: c.nextUrl ?? null,
    }));
  } catch {
    return [];
  }
}

export function deduplicateTitle(title: string, novelSlug: string, chapters?: SavedChapter[]): string {
  const all = chapters ?? getSavedChapters();
  const sameNameCount = all.filter(
    (c) => c.novelSlug === novelSlug && c.title === title
  ).length;
  return sameNameCount > 0 ? `${title} (${sameNameCount + 1})` : title;
}

export function saveChapter(chapter: SavedChapter) {
  let chapters = getSavedChapters();
  const existing = chapters.findIndex((c) => c.url === chapter.url);
  if (existing >= 0) {
    chapters[existing] = chapter;
  } else {
    chapter = { ...chapter, title: deduplicateTitle(chapter.title, chapter.novelSlug, chapters) };
    chapters.unshift(chapter);
  }

  const settings = getSettings();

  // Auto-clear: keep only N newest chapters per novel
  if (settings.autoClearChapters && settings.autoClearChaptersKeep > 0) {
    const novelSlug = chapter.novelSlug;
    const novelChapters = chapters.filter((c) => c.novelSlug === novelSlug);
    if (novelChapters.length > settings.autoClearChaptersKeep) {
      // Sort by savedAt desc, keep only the newest N
      const sorted = novelChapters.sort((a, b) => b.savedAt - a.savedAt);
      const toRemove = new Set(sorted.slice(settings.autoClearChaptersKeep).map((c) => c.url));
      chapters = chapters.filter((c) => c.novelSlug !== novelSlug || !toRemove.has(c.url));
    }
  }

  // Auto-clear: keep only the current novel, remove all others
  if (settings.autoClearNovels) {
    chapters = chapters.filter((c) => c.novelSlug === chapter.novelSlug);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
}

export function deleteChapter(url: string) {
  const chapters = getSavedChapters().filter((c) => c.url !== url);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
}

export function clearNovelChapters(novelSlug: string) {
  const chapters = getSavedChapters().filter((c) => c.novelSlug !== novelSlug);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
  // Clear current URL if it belonged to this novel
  const currentUrl = getCurrentUrl();
  if (currentUrl && extractNovelSlug(currentUrl) === novelSlug) {
    localStorage.removeItem(CURRENT_KEY);
  }
}

export function getCurrentUrl(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}

export function setCurrentUrl(url: string) {
  localStorage.setItem(CURRENT_KEY, url);
}

export function getSettings(): ReaderSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (!stored) return DEFAULT_SETTINGS;
    const settings = { ...DEFAULT_SETTINGS, ...stored };
    // Migrate legacy single apiKey to openaiApiKey
    if (stored.apiKey && !stored.openaiApiKey) {
      settings.openaiApiKey = stored.apiKey;
    }
    delete (settings as Record<string, unknown>).apiKey;
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ReaderSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getScrollPosition(url: string): number {
  try {
    const positions = JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}");
    return positions[url] || 0;
  } catch {
    return 0;
  }
}

export function saveScrollPosition(url: string, position: number) {
  try {
    const positions = JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}");
    positions[url] = position;
    localStorage.setItem(SCROLL_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
}

export function extractChapterNumber(title: string): number | null {
  const match =
    title.match(/(?:ch(?:ương|apter|ap)?|chương)\s*(\d+)/i) ||
    title.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
