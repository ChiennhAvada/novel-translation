"use client";

import { ReaderSettings, AI_MODEL_OPTIONS, getProviderForModel, getApiKeyForModel } from "../lib/types";
import { Translations } from "../lib/i18n";

interface Props {
  settings: ReaderSettings;
  textColor: string;
  t: Translations;
  onUpdate: (patch: Partial<ReaderSettings>) => void;
}

export default function AISettingsPanel({ settings, textColor, t, onUpdate }: Props) {
  const inputStyle = {
    backgroundColor: "transparent",
    borderColor: textColor + "30",
    color: textColor,
  };

  const provider = getProviderForModel(settings.aiModel);
  const keyFieldMap: Record<string, "openaiApiKey" | "geminiApiKey" | "claudeApiKey" | "openrouterApiKey"> = {
    gemini: "geminiApiKey",
    claude: "claudeApiKey",
    openrouter: "openrouterApiKey",
    openai: "openaiApiKey",
  };
  const labelMap: Record<string, string> = {
    gemini: t.geminiApiKey,
    claude: t.claudeApiKey,
    openrouter: t.openrouterApiKey,
    openai: t.openaiApiKey,
  };
  const keyField = keyFieldMap[provider] || "openaiApiKey";
  const label = labelMap[provider] || t.openaiApiKey;

  return (
    <div
      className="mb-4 p-3 sm:p-4 rounded-lg border"
      style={{ borderColor: textColor + "20" }}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-2">{t.aiModel}</label>
          <select
            value={settings.aiModel}
            onChange={(e) => onUpdate({ aiModel: e.target.value })}
            className="w-full px-3 py-2 rounded border text-sm"
            style={inputStyle}
          >
            {AI_MODEL_OPTIONS.map((group) => (
              <optgroup key={group.provider} label={group.label}>
                {group.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">{label}</label>
          <input
            type="password"
            value={settings[keyField]}
            onChange={(e) => onUpdate({ [keyField]: e.target.value })}
            placeholder={t.apiKeyPlaceholder}
            className="w-full px-3 py-2 rounded border text-sm"
            style={inputStyle}
          />
          <p className="text-xs mt-1" style={{ color: textColor + "50" }}>
            {t.apiKeyNote}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">{t.customPrompt}</label>
          <textarea
            value={settings.customPrompt}
            onChange={(e) => onUpdate({ customPrompt: e.target.value })}
            placeholder={t.customPromptPlaceholder}
            rows={4}
            className="w-full px-3 py-2 rounded border text-sm resize-y"
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}
