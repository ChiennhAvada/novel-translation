"use client";

import { ReaderSettings, BG_OPTIONS, getApiKeyForModel } from "../lib/types";
import { Translations } from "../lib/i18n";

interface Props {
  settings: ReaderSettings;
  textColor: string;
  t: Translations;
  url: string;
  onUrlChange: (url: string) => void;
  onTranslate: () => void;
  isLoading: boolean;
  buttonLabel: string;
  onUpdate: (patch: Partial<ReaderSettings>) => void;
}

export default function SettingsPanel({ settings, textColor, t, url, onUrlChange, onTranslate, isLoading, buttonLabel, onUpdate }: Props) {
  const inputStyle = {
    backgroundColor: "transparent",
    borderColor: textColor + "30",
    color: textColor,
  };

  return (
    <div
      className="mb-4 p-3 sm:p-4 rounded-lg border"
      style={{ borderColor: textColor + "20" }}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-2">{t.pastePlaceholder}</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  onTranslate();
                }
              }}
              placeholder={t.pastePlaceholder}
              className="flex-1 px-3 py-2 rounded border text-sm min-w-0"
              style={{ backgroundColor: "transparent", borderColor: textColor + "30", color: textColor }}
            />
            <button
              onClick={onTranslate}
              disabled={isLoading || !url.trim() || !getApiKeyForModel(settings)?.trim()}
              className="px-5 py-2 cursor-pointer bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {buttonLabel}
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: textColor + "50" }}>
            {t.linkHelpText}{" "}
            <a
              href="https://quanben.io/n/yuanlaiwoshixiuxiandalao/1.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-70"
            >
              quanben.io/n/yuanlaiwoshixiuxiandalao/1.html
            </a>
          </p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">{t.language}</label>
          <select
            value={settings.appLang}
            onChange={(e) => onUpdate({ appLang: e.target.value as "en" | "vi" })}
            className="w-full px-3 py-2 rounded border text-sm"
            style={inputStyle}
          >
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">{t.background}</label>
          <div className="flex flex-wrap gap-2">
            {BG_OPTIONS.map((opt) => (
              <button
                key={opt.bg}
                onClick={() => onUpdate({ bgColor: opt.bg })}
                className="w-10 h-10 rounded-lg border-2 transition-all cursor-pointer hover:opacity-80"
                style={{
                  backgroundColor: opt.bg,
                  borderColor:
                    settings.bgColor === opt.bg ? "#3b82f6" : textColor + "20",
                  transform:
                    settings.bgColor === opt.bg ? "scale(1.1)" : "scale(1)",
                }}
                title={opt.label}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">
            {t.fontSize}: {settings.fontSize}px
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                onUpdate({ fontSize: Math.max(12, settings.fontSize - 2) })
              }
              className="w-8 h-8 rounded border flex items-center justify-center cursor-pointer transition-colors hover:opacity-70"
              style={{ borderColor: textColor + "30", color: textColor }}
            >
              -
            </button>
            <input
              type="range"
              min={12}
              max={32}
              step={1}
              value={settings.fontSize}
              onChange={(e) =>
                onUpdate({ fontSize: parseInt(e.target.value, 10) })
              }
              className="flex-1"
            />
            <button
              onClick={() =>
                onUpdate({ fontSize: Math.min(32, settings.fontSize + 2) })
              }
              className="w-8 h-8 rounded border flex items-center justify-center cursor-pointer transition-colors hover:opacity-70"
              style={{ borderColor: textColor + "30", color: textColor }}
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">
            {t.lineSpacing}: {settings.lineSpacing}
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                onUpdate({ lineSpacing: Math.max(1, +(settings.lineSpacing - 0.2).toFixed(1)) })
              }
              className="w-8 h-8 rounded border flex items-center justify-center cursor-pointer transition-colors hover:opacity-70"
              style={{ borderColor: textColor + "30", color: textColor }}
            >
              -
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.2}
              value={settings.lineSpacing}
              onChange={(e) =>
                onUpdate({ lineSpacing: parseFloat(e.target.value) })
              }
              className="flex-1"
            />
            <button
              onClick={() =>
                onUpdate({ lineSpacing: Math.min(3, +(settings.lineSpacing + 0.2).toFixed(1)) })
              }
              className="w-8 h-8 rounded border flex items-center justify-center cursor-pointer transition-colors hover:opacity-70"
              style={{ borderColor: textColor + "30", color: textColor }}
            >
              +
            </button>
          </div>
        </div>

        <div>
          <div
            className="flex items-center justify-between gap-3 cursor-pointer"
            onClick={() => onUpdate({ autoLineBreak: !settings.autoLineBreak })}
          >
            <span className="text-sm font-medium">{t.autoLineBreak}</span>
            <div
              className="relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200"
              style={{
                backgroundColor: settings.autoLineBreak ? "#3b82f6" : textColor + "20",
              }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                style={{
                  transform: settings.autoLineBreak ? "translateX(22px)" : "translateX(2px)",
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">{t.supportedSites}</p>
          <ul className="text-xs space-y-0.5" style={{ color: textColor + "70" }}>
            <li>
              <a href="https://www.quanben.io" target="_blank" rel="noopener noreferrer" className="underline cursor-pointer hover:opacity-70">quanben.io</a> (Chinese novels)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
