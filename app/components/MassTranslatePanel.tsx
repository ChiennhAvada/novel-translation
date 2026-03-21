"use client";

import { useState, useRef, useCallback } from "react";
import { ReaderSettings, TOCChapter, MassTranslateMode, getApiKeyForModel } from "../lib/types";
import { Translations } from "../lib/i18n";
import { fetchTOC, fetchChapterContent, simplifyText, translateTitles } from "../lib/api";
import { saveChapter, deduplicateTitle, extractNovelSlug } from "../lib/storage";

interface Props {
  settings: ReaderSettings;
  textColor: string;
  t: Translations;
  onUpdate: (patch: Partial<ReaderSettings>) => void;
  onComplete: () => void;
}

interface Progress {
  status: "idle" | "fetching-toc" | "translating" | "done" | "stopped" | "error";
  current: number;
  total: number;
  completed: number;
  message?: string;
}

const TITLE_TRANSLATE_PROMPT =
  "Dịch tiêu đề truyện sau từ tiếng Trung sang tiếng Việt (ưu tiên Hán Việt) phổ thông dễ hiểu. KHÔNG được để lại bất kỳ chữ Trung Quốc nào. Chỉ trả về bản dịch, không giải thích.";

export default function MassTranslatePanel({ settings, textColor, t, onUpdate, onComplete }: Props) {
  const [tocUrl, setTocUrl] = useState("");
  const [chapters, setChapters] = useState<TOCChapter[]>([]);
  const [novelName, setNovelName] = useState("");
  const [fromChapter, setFromChapter] = useState(1);
  const [toChapter, setToChapter] = useState(1);
  const [progress, setProgress] = useState<Progress>({
    status: "idle",
    current: 0,
    total: 0,
    completed: 0,
  });
  const abortRef = useRef<AbortController | null>(null);

  const inputStyle = {
    backgroundColor: "transparent",
    borderColor: textColor + "30",
    color: textColor,
  };

  const apiKey = getApiKeyForModel(settings);
  const isRunning = progress.status === "fetching-toc" || progress.status === "translating";

  const handleFetchTOC = useCallback(async () => {
    if (!tocUrl.trim() || isRunning) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setProgress({ status: "fetching-toc", current: 0, total: 0, completed: 0 });
    setChapters([]);

    try {
      const data = await fetchTOC(tocUrl, controller.signal);
      setChapters(data.chapters);
      setNovelName(data.novelName);
      setFromChapter(1);
      setToChapter(data.chapters.length);
      setProgress({ status: "idle", current: 0, total: 0, completed: 0 });
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setProgress({ status: "error", current: 0, total: 0, completed: 0, message: e.message });
      }
    }
  }, [tocUrl, isRunning]);

  const translateOneByOne = useCallback(
    async (selected: TOCChapter[], signal: AbortSignal) => {
      for (let i = 0; i < selected.length; i++) {
        if (signal.aborted) break;

        const ch = selected[i];
        setProgress((p) => ({ ...p, current: i + 1, message: `${t.massTranslateFetchingChapter} "${ch.title}"...` }));

        try {
          const data = await fetchChapterContent(ch.url, signal);
          if (signal.aborted) break;

          setProgress((p) => ({ ...p, message: `${t.massTranslateProgress} "${ch.title}"...` }));

          const result = await simplifyText(
            data.text,
            apiKey,
            settings.aiModel,
            data.lang,
            settings.autoLineBreak,
            signal,
            undefined,
            settings.customPrompt
          );
          if (signal.aborted) break;

          // Translate titles
          let chapterName = data.chapterName;
          let nName = data.novelName || novelName;
          if (data.lang === "zh" && data.chapterName) {
            try {
              const translated = await translateTitles(
                [data.chapterName, nName],
                apiKey,
                settings.aiModel,
                TITLE_TRANSLATE_PROMPT
              );
              chapterName = translated[0] || data.chapterName;
              nName = translated[1] || nName;
            } catch { /* keep original */ }
          }

          const chapterSlug = extractNovelSlug(ch.url);
          const dedupedTitle = deduplicateTitle(chapterName || data.title || ch.title, chapterSlug);

          saveChapter({
            url: ch.url,
            title: dedupedTitle,
            novelName: nName,
            novelSlug: chapterSlug,
            simplifiedText: result,
            prevUrl: data.prevUrl,
            nextUrl: data.nextUrl,
            savedAt: Date.now(),
          }, true);

          setProgress((p) => ({ ...p, completed: p.completed + 1 }));
          onComplete();
        } catch (e: unknown) {
          if (e instanceof Error && e.name === "AbortError") break;
          // Skip failed chapter, continue
          setProgress((p) => ({ ...p, completed: p.completed + 1, message: `Error on "${ch.title}": ${e instanceof Error ? e.message : "Unknown"}` }));
        }

        // Small delay to avoid rate limiting
        if (i < selected.length - 1 && !signal.aborted) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    },
    [apiKey, settings, novelName, onComplete, t]
  );

  const translateBatch = useCallback(
    async (selected: TOCChapter[], groupSize: number, signal: AbortSignal) => {
      // Split into groups
      const groups: TOCChapter[][] = [];
      for (let i = 0; i < selected.length; i += groupSize) {
        groups.push(selected.slice(i, i + groupSize));
      }

      let completedCount = 0;

      for (const group of groups) {
        if (signal.aborted) break;

        // Fetch all chapters in the group
        const fetchedData: { ch: TOCChapter; data: Awaited<ReturnType<typeof fetchChapterContent>> }[] = [];

        for (const ch of group) {
          if (signal.aborted) break;
          setProgress((p) => ({
            ...p,
            current: completedCount + fetchedData.length + 1,
            message: `${t.massTranslateFetchingChapter} "${ch.title}"...`,
          }));

          try {
            const data = await fetchChapterContent(ch.url, signal);
            fetchedData.push({ ch, data });
          } catch (e: unknown) {
            if (e instanceof Error && e.name === "AbortError") break;
            completedCount++;
            setProgress((p) => ({ ...p, completed: completedCount }));
          }
        }

        if (signal.aborted || fetchedData.length === 0) break;

        // Concatenate with delimiters
        const delimiter = (i: number, title: string) => `\n===CHAPTER ${i + 1}: ${title}===\n`;
        let concatenated = "";
        for (let i = 0; i < fetchedData.length; i++) {
          concatenated += delimiter(i, fetchedData[i].ch.title);
          concatenated += fetchedData[i].data.text;
        }

        setProgress((p) => ({
          ...p,
          message: `${t.massTranslateProgress} ${group.length} ${t.chaptersFound}...`,
        }));

        // Translate concatenated text
        try {
          const batchPrompt = settings.customPrompt
            ? settings.customPrompt + "\n\nIMPORTANT: The text contains multiple chapters separated by ===CHAPTER N: title===. Translate each chapter and keep the same separators in your output."
            : "IMPORTANT: The text contains multiple chapters separated by ===CHAPTER N: title===. Translate each chapter and keep the same separators in your output.";

          const result = await simplifyText(
            concatenated,
            apiKey,
            settings.aiModel,
            fetchedData[0].data.lang,
            settings.autoLineBreak,
            signal,
            undefined,
            batchPrompt
          );

          if (signal.aborted) break;

          // Split result by delimiters
          const parts = result.split(/===CHAPTER \d+:.*?===/);
          const translatedTexts = parts.filter((p) => p.trim()).map((p) => p.trim());

          // Translate all titles in one batch
          const allTitles = fetchedData.map((fd) => fd.data.chapterName || fd.ch.title);
          const allNovelNames = fetchedData.map((fd) => fd.data.novelName || novelName);
          let translatedTitles = allTitles;
          let translatedNovelName = novelName;

          if (fetchedData[0].data.lang === "zh") {
            try {
              const toTranslate = [...allTitles, allNovelNames[0]];
              const translated = await translateTitles(toTranslate, apiKey, settings.aiModel, TITLE_TRANSLATE_PROMPT);
              translatedTitles = translated.slice(0, allTitles.length);
              translatedNovelName = translated[allTitles.length] || novelName;
            } catch { /* keep original */ }
          }

          // Save each chapter
          for (let i = 0; i < fetchedData.length; i++) {
            const { ch, data } = fetchedData[i];
            const text = translatedTexts[i] || "";
            const chapterSlug = extractNovelSlug(ch.url);
            const title = translatedTitles[i] || ch.title;
            const dedupedTitle = deduplicateTitle(title, chapterSlug);

            saveChapter({
              url: ch.url,
              title: dedupedTitle,
              novelName: translatedNovelName || data.novelName || novelName,
              novelSlug: chapterSlug,
              simplifiedText: text,
              prevUrl: data.prevUrl,
              nextUrl: data.nextUrl,
              savedAt: Date.now(),
            }, true);

            completedCount++;
          }

          setProgress((p) => ({ ...p, completed: completedCount }));
          onComplete();
        } catch (e: unknown) {
          if (e instanceof Error && e.name === "AbortError") break;
          completedCount += fetchedData.length;
          setProgress((p) => ({
            ...p,
            completed: completedCount,
            message: `Error: ${e instanceof Error ? e.message : "Unknown"}`,
          }));
        }

        // Delay between groups
        if (!signal.aborted) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    },
    [apiKey, settings, novelName, onComplete, t]
  );

  const handleStart = useCallback(async () => {
    if (chapters.length === 0 || isRunning || !apiKey?.trim()) return;

    // Disable auto-clear to preserve all mass-translated chapters
    if (settings.autoClearChapters || settings.autoClearNovels) {
      onUpdate({ autoClearChapters: false, autoClearNovels: false });
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const from = Math.max(1, fromChapter);
    const to = Math.min(chapters.length, toChapter);
    const selected = chapters.slice(from - 1, to);

    setProgress({ status: "translating", current: 0, total: selected.length, completed: 0 });

    try {
      if (settings.massTranslateMode === "one-by-one") {
        await translateOneByOne(selected, controller.signal);
      } else if (settings.massTranslateMode === "batch-together") {
        await translateBatch(selected, selected.length, controller.signal);
      } else {
        await translateBatch(selected, settings.massTranslateGroupSize, controller.signal);
      }

      if (!controller.signal.aborted) {
        setProgress((p) => ({ ...p, status: "done", message: `${t.massTranslateDone} ${p.completed}/${selected.length}` }));
      }
    } catch {
      // handled inside
    }

    if (controller.signal.aborted) {
      setProgress((p) => ({ ...p, status: "stopped", message: `${t.massTranslateStopped} ${p.completed}/${selected.length}` }));
    }
  }, [chapters, fromChapter, toChapter, isRunning, apiKey, settings, translateOneByOne, translateBatch, t]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-lg border" style={{ borderColor: textColor + "20" }}>
      <div className="flex flex-col gap-4">
        {/* TOC URL input */}
        <div>
          <label className="text-sm font-medium block mb-2">{t.massTranslateTocUrl}</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={tocUrl}
              onChange={(e) => setTocUrl(e.target.value)}
              placeholder={t.massTranslateTocUrl}
              className="flex-1 px-3 py-2 rounded border text-sm min-w-0"
              style={inputStyle}
              disabled={isRunning}
            />
            <button
              onClick={handleFetchTOC}
              disabled={isRunning || !tocUrl.trim()}
              className="px-5 py-2 cursor-pointer bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {progress.status === "fetching-toc" ? t.fetchingToc : t.fetchChapters}
            </button>
          </div>
        </div>

        {/* Chapter info & range */}
        {chapters.length > 0 && (
          <>
            <div className="text-sm" style={{ color: textColor + "80" }}>
              <span className="font-medium">{novelName}</span>
              {" — "}
              {chapters.length} {t.chaptersFound}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-xs block mb-1" style={{ color: textColor + "70" }}>{t.fromChapter}</label>
                <input
                  type="number"
                  min={1}
                  max={chapters.length}
                  value={fromChapter}
                  onChange={(e) => setFromChapter(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={inputStyle}
                  disabled={isRunning}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs block mb-1" style={{ color: textColor + "70" }}>{t.toChapter}</label>
                <input
                  type="number"
                  min={1}
                  max={chapters.length}
                  value={toChapter}
                  onChange={(e) => setToChapter(Math.min(chapters.length, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={inputStyle}
                  disabled={isRunning}
                />
              </div>
            </div>

            {/* Mode selector */}
            <div>
              <label className="text-sm font-medium block mb-2">{t.translateMode}</label>
              <select
                value={settings.massTranslateMode}
                onChange={(e) => onUpdate({ massTranslateMode: e.target.value as MassTranslateMode })}
                className="w-full px-3 py-2 rounded border text-sm"
                style={inputStyle}
                disabled={isRunning}
              >
                <option value="one-by-one">{t.modeOneByOne}</option>
                <option value="batch-together">{t.modeBatchTogether}</option>
                <option value="batch-in-groups">{t.modeBatchInGroups}</option>
              </select>
            </div>

            {/* Group size (only for batch-in-groups) */}
            {settings.massTranslateMode === "batch-in-groups" && (
              <div>
                <label className="text-sm font-medium block mb-2">{t.groupSize}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.massTranslateGroupSize}
                  onChange={(e) =>
                    onUpdate({ massTranslateGroupSize: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 3)) })
                  }
                  className="w-24 px-3 py-2 rounded border text-sm"
                  style={inputStyle}
                  disabled={isRunning}
                />
              </div>
            )}

            {/* Start/Stop button */}
            <div>
              {isRunning ? (
                <button
                  onClick={handleStop}
                  className="w-full px-5 py-2 cursor-pointer bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  {t.stopMassTranslate}
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={!apiKey?.trim() || fromChapter > toChapter}
                  className="w-full px-5 py-2 cursor-pointer bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t.startMassTranslate} ({Math.max(0, toChapter - fromChapter + 1)} {t.chaptersFound})
                </button>
              )}
            </div>
          </>
        )}

        {/* Progress */}
        {progress.status !== "idle" && progress.status !== "fetching-toc" && (
          <div>
            {/* Progress bar */}
            {progress.total > 0 && (
              <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: textColor + "15" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor:
                      progress.status === "done" ? "#22c55e" :
                      progress.status === "error" ? "#ef4444" :
                      progress.status === "stopped" ? "#eab308" :
                      "#3b82f6",
                  }}
                />
              </div>
            )}

            {/* Status text */}
            <p className="text-xs" style={{ color: textColor + "70" }}>
              {progress.message || `${progress.completed}/${progress.total}`}
            </p>
          </div>
        )}

        {/* Error display */}
        {progress.status === "error" && progress.message && (
          <p className="text-xs text-red-400">{progress.message}</p>
        )}
      </div>
    </div>
  );
}
