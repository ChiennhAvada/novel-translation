"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { SavedChapter, ReaderSettings, getTextColor, getApiKeyForModel } from "./lib/types";
import {
  getSavedChapters,
  saveChapter,
  clearNovelChapters,
  extractNovelSlug,
  getCurrentUrl,
  setCurrentUrl,
  getSettings,
  saveSettings,
  getScrollPosition,
  saveScrollPosition,
} from "./lib/storage";
import { fetchChapterContent, simplifyText, translateTitle } from "./lib/api";
import SettingsPanel from "./components/SettingsPanel";
import AISettingsPanel from "./components/AISettingsPanel";
import SavedChaptersList from "./components/SavedChaptersList";
import SavedNovelsList from "./components/SavedNovelsList";
import NavButtons from "./components/NavButtons";
import { getTranslations } from "./lib/i18n";

type Panel = "none" | "chapters" | "novels" | "settings" | "ai-settings";

export default function Home() {
  const [url, setUrl] = useState("");
  const [simplifiedText, setSimplifiedText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [simplifying, setSimplifying] = useState(false);
  const [title, setTitle] = useState("");
  const [novelName, setNovelName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [savedChapters, setSavedChapters] = useState<SavedChapter[]>([]);
  const [activePanel, setActivePanel] = useState<Panel>("none");
  const [settings, setSettings] = useState<ReaderSettings>({
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
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const t = getTranslations(settings.appLang);

  const currentNovelSlug = url ? extractNovelSlug(url) : null;

  const currentNovelChapters = currentNovelSlug
    ? savedChapters.filter((c) => c.novelSlug === currentNovelSlug)
    : [];

  useEffect(() => {
    setSavedChapters(getSavedChapters());
    setSettings(getSettings());

    const currentUrl = getCurrentUrl();
    if (currentUrl) {
      const chapter = getSavedChapters().find((c) => c.url === currentUrl);
      if (chapter) {
        setUrl(chapter.url);
        setTitle(chapter.title);
        setSimplifiedText(chapter.simplifiedText);
        setPrevUrl(chapter.prevUrl || null);
        setNextUrl(chapter.nextUrl || null);
        // Restore scroll position after content renders
        requestAnimationFrame(() => {
          const saved = getScrollPosition(currentUrl);
          if (saved) window.scrollTo(0, saved);
        });
      } else {
        setUrl(currentUrl);
      }
    }
  }, []);

  // Save scroll position on scroll (debounced) and show/hide scroll-to-top button
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
      if (!url) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveScrollPosition(url, window.scrollY);
      }, 300);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [url]);

  function togglePanel(panel: Panel) {
    setActivePanel((prev) => (prev === panel ? "none" : panel));
  }

  function updateSettings(patch: Partial<ReaderSettings>) {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    saveSettings(updated);
  }

  function refreshSaved() {
    setSavedChapters(getSavedChapters());
  }

  const handleFetchAndSimplify = useCallback(
    async (targetUrl?: string) => {
      const fetchUrl = targetUrl || url;
      if (!fetchUrl.trim() || fetching || simplifying) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFetching(true);
      setSimplifiedText("");
      setTitle("");
      setNovelName("");
      setChapterName("");
      setPrevUrl(null);
      setNextUrl(null);
      if (targetUrl) setUrl(targetUrl);
      window.scrollTo(0, 0);

      try {
        const data = await fetchChapterContent(fetchUrl, controller.signal);
        let chapterTitle = data.title;

        setTitle(chapterTitle);
        setNovelName(data.novelName);
        setChapterName(data.chapterName);
        setPrevUrl(data.prevUrl);
        setNextUrl(data.nextUrl);
        setFetching(false);
        setSimplifying(true);

        const result = await simplifyText(
          data.text,
          getApiKeyForModel(settings),
          settings.aiModel,
          data.lang,
          settings.autoLineBreak,
          controller.signal,
          setSimplifiedText,
          settings.customPrompt
        );

        // Translate title if Chinese
        if (data.lang === "zh") {
          try {
            if (data.chapterName) {
              const [cName,nName] = await Promise.all([translateTitle(
                  data.chapterName,
                  getApiKeyForModel(settings),
                  settings.aiModel,
                  "Dịch tiêu đề truyện sau từ tiếng Trung sang tiếng Việt (ưu tiên Hán Việt) phổ thông dễ hiểu. KHÔNG được để lại bất kỳ chữ Trung Quốc nào. Giữ nguyên dấu '-' phân cách giữa tên truyện và tên chương. Chỉ trả về bản dịch, không giải thích."
              ),translateTitle(
                  data.novelName,
                  getApiKeyForModel(settings),
                  settings.aiModel,
                  "Dịch tiêu đề truyện sau từ tiếng Trung sang tiếng Việt (ưu tiên Hán Việt) phổ thông dễ hiểu. KHÔNG được để lại bất kỳ chữ Trung Quốc nào. Giữ nguyên dấu '-' phân cách giữa tên truyện và tên chương. Chỉ trả về bản dịch, không giải thích."
              )]);

              setChapterName(cName);
              setNovelName(nName)
              setTitle(cName);
              data.chapterName = cName;
              data.novelName = nName;
            }
          } catch { /* keep original */ }
        }

        saveChapter({
          url: fetchUrl,
          title: data.chapterName || chapterTitle || fetchUrl,
          novelName: data.novelName || "",
          novelSlug: extractNovelSlug(fetchUrl),
          simplifiedText: result,
          prevUrl: data.prevUrl,
          nextUrl: data.nextUrl,
          savedAt: Date.now(),
        });
        refreshSaved();
        setCurrentUrl(fetchUrl);
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError") {
          setSimplifiedText(`Error: ${e.message}`);
        }
      } finally {
        setFetching(false);
        setSimplifying(false);
      }
    },
    [url, fetching, simplifying, getApiKeyForModel(settings), settings.aiModel]
  );

  async function navigateToChapter(targetUrl: string) {
    window.scrollTo(0, 0);
    const saved = getSavedChapters().find((c) => c.url === targetUrl);
    if (saved) {
      await loadSavedChapter(saved);
    } else {
      await handleFetchAndSimplify(targetUrl);
    }
  }

  async function loadSavedChapter(chapter: SavedChapter) {
    setUrl(chapter.url);
    setTitle(chapter.title);
    setNovelName(chapter.novelName || "");
    setChapterName(chapter.title || "");
    setSimplifiedText(chapter.simplifiedText);
    setPrevUrl(chapter.prevUrl || null);
    setNextUrl(chapter.nextUrl || null);
    setActivePanel("none");
    setCurrentUrl(chapter.url);
    // Restore scroll position after content renders
    requestAnimationFrame(() => {
      const saved = getScrollPosition(chapter.url);
      window.scrollTo(0, saved);
    });

    if (!chapter.prevUrl && !chapter.nextUrl) {
      try {
        const data = await fetchChapterContent(chapter.url);
        setPrevUrl(data.prevUrl);
        setNextUrl(data.nextUrl);
        saveChapter({ ...chapter, prevUrl: data.prevUrl, nextUrl: data.nextUrl });
        refreshSaved();
      } catch {
        // Ignore
      }
    }
  }

  function handleSelectNovel(slug: string) {
    const novelChapters = savedChapters.filter((c) => c.novelSlug === slug);
    const latest = novelChapters.reduce((a, b) => (a.savedAt > b.savedAt ? a : b));
    loadSavedChapter(latest);
  }

  function handleClearNovel(novelSlug: string) {
    clearNovelChapters(novelSlug);
    refreshSaved();
    if (url && extractNovelSlug(url) === novelSlug) {
      setSimplifiedText("");
      setTitle("");
      setUrl("");
      setPrevUrl(null);
      setNextUrl(null);
    }
  }

  const isLoading = fetching || simplifying;
  const buttonLabel = fetching
    ? t.fetching
    : simplifying
      ? t.simplifying
      : t.translate;
  const textColor = getTextColor(settings.bgColor);
  const btnStyle = { borderColor: textColor + "30", color: textColor, backgroundColor: settings.bgColor };
  const btnClass = "panel-btn px-3 py-1.5 rounded-lg text-sm font-medium border transition-all cursor-pointer";

  return (
    <main
      className="min-h-screen transition-colors duration-200"
      style={{ backgroundColor: settings.bgColor, color: textColor }}
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h1 className="text-lg sm:text-xl font-bold">{t.appTitle}</h1>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => togglePanel("chapters")}
              disabled={!currentNovelSlug || currentNovelChapters.length === 0}
              className={btnClass + " text-xs sm:text-sm disabled:opacity-30 disabled:cursor-not-allowed" + (activePanel === "chapters" ? " active" : "")}
              style={btnStyle}
            >
              {t.chapters} ({currentNovelChapters.length})
            </button>
            <button
              onClick={() => togglePanel("novels")}
              className={btnClass + " text-xs sm:text-sm" + (activePanel === "novels" ? " active" : "")}
              style={btnStyle}
            >
              {t.novels}
            </button>
            <button
              onClick={() => togglePanel("ai-settings")}
              className={btnClass + " text-xs sm:text-sm" + (activePanel === "ai-settings" ? " active" : "")}
              style={btnStyle}
            >
              {t.aiSettings}
            </button>
            <button
              onClick={() => togglePanel("settings")}
              className={btnClass + " text-xs sm:text-sm" + (activePanel === "settings" ? " active" : "")}
              style={btnStyle}
            >
              {t.settings}
            </button>
          </div>
        </div>

        {activePanel === "ai-settings" && (
          <AISettingsPanel
            settings={settings}
            textColor={textColor}
            t={t}
            onUpdate={updateSettings}
          />
        )}

        {activePanel === "settings" && (
          <SettingsPanel
            settings={settings}
            textColor={textColor}
            t={t}
            url={url}
            onUrlChange={setUrl}
            onTranslate={() => {
              setActivePanel("none");
              handleFetchAndSimplify();
            }}
            isLoading={isLoading}
            buttonLabel={buttonLabel}
            onUpdate={updateSettings}
          />
        )}

        {activePanel === "novels" && (
          <SavedNovelsList
            chapters={savedChapters}
            settings={settings}
            textColor={textColor}
            currentNovelSlug={currentNovelSlug}
            t={t}
            onSelectNovel={handleSelectNovel}
            onClearNovel={handleClearNovel}
          />
        )}

        {activePanel === "chapters" && (
          <SavedChaptersList
            chapters={currentNovelChapters}
            settings={settings}
            textColor={textColor}
            t={t}
            onLoad={loadSavedChapter}
          />
        )}

        {(novelName || chapterName || title) && (
          <div className="text-center mb-4">
            {novelName && (
              <h2 className="text-lg font-semibold">{novelName}</h2>
            )}
            {chapterName && (
              <p className="text-sm mt-1" style={{ color: textColor + "80" }}>{chapterName}</p>
            )}
            {!novelName && !chapterName && title && (
              <h2 className="text-lg font-semibold">{title}</h2>
            )}
          </div>
        )}

        <NavButtons prevUrl={prevUrl} nextUrl={nextUrl} disabled={isLoading || !getApiKeyForModel(settings)?.trim()} textColor={textColor} prevLabel={t.previous} nextLabel={t.next} onNavigate={navigateToChapter} />

        <div
          className="min-h-[60vh] px-1 sm:px-2 py-4 whitespace-pre-wrap"
          style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineSpacing }}
        >
          {simplifiedText || (
            <span style={{ color: textColor + "40" }}>{t.contentPlaceholder}</span>
          )}
        </div>

        <NavButtons prevUrl={prevUrl} nextUrl={nextUrl} disabled={isLoading || !getApiKeyForModel(settings)?.trim()} textColor={textColor} prevLabel={t.previous} nextLabel={t.next} onNavigate={navigateToChapter} />
      </div>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer z-50"
          style={{
            backgroundColor: textColor + "20",
            color: textColor,
            border: `1px solid ${textColor}30`,
            backdropFilter: "blur(8px)",
          }}
          aria-label="Scroll to top"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}
    </main>
  );
}
