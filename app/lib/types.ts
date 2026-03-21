export interface SavedChapter {
  url: string;
  title: string;
  novelName: string;
  novelSlug: string;
  simplifiedText: string;
  prevUrl: string | null;
  nextUrl: string | null;
  savedAt: number;
}

export type AIProvider = "openai" | "gemini" | "claude" | "openrouter";

export interface AIModelOption {
  provider: AIProvider;
  label: string;
  models: string[];
}

export const AI_MODEL_OPTIONS: AIModelOption[] = [
  {
    provider: "openai",
    label: "OpenAI",
    models: [
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
    ],
  },
  {
    provider: "gemini",
    label: "Google Gemini",
    models: [
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
    ],
  },
  {
    provider: "claude",
    label: "Anthropic Claude",
    models: [
      "claude-opus-4-6-20260313",
      "claude-sonnet-4-6-20260313",
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-5-20250929"
    ],
  },
  {
    provider: "openrouter",
    label: "OpenRouter (Free)",
    models: [
      "z-ai/glm-4.5-air:free",
      "qwen/qwen3-coder:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "stepfun/step-3.5-flash:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ],
  },
];

export type MassTranslateMode = "one-by-one" | "batch-together" | "batch-in-groups";

export interface TOCChapter {
  index: number;
  title: string;
  url: string;
}

export interface ReaderSettings {
  bgColor: string;
  fontSize: number;
  lineSpacing: number;
  autoLineBreak: boolean;
  openaiApiKey: string;
  geminiApiKey: string;
  claudeApiKey: string;
  openrouterApiKey: string;
  aiModel: string;
  customPrompt: string;
  appLang: "en" | "vi";
  autoClearChapters: boolean;
  autoClearChaptersKeep: number;
  autoClearNovels: boolean;
  massTranslateMode: MassTranslateMode;
  massTranslateGroupSize: number;
}

export function getProviderForModel(model: string): AIProvider {
  if (model.startsWith("gemini")) return "gemini";
  if (model.startsWith("claude")) return "claude";
  // OpenRouter models have org/model:free format
  if (model.includes("/")) return "openrouter";
  return "openai";
}

export function getApiKeyForModel(settings: ReaderSettings): string {
  const provider = getProviderForModel(settings.aiModel);
  switch (provider) {
    case "gemini": return settings.geminiApiKey;
    case "claude": return settings.claudeApiKey;
    case "openrouter": return settings.openrouterApiKey;
    default: return settings.openaiApiKey;
  }
}

export const BG_OPTIONS = [
  { bg: "#ffffff", text: "#1a1a1a", label: "White" },
  { bg: "#f5f5dc", text: "#3b3024", label: "Sepia" },
  { bg: "#d4edda", text: "#1b3a26", label: "Green" },
  { bg: "#1a1a2e", text: "#d4d4d4", label: "Dark" },
  { bg: "#0d0d0d", text: "#cccccc", label: "Black" },
];

export function getTextColor(bgColor: string): string {
  return BG_OPTIONS.find((o) => o.bg === bgColor)?.text ?? "#1a1a1a";
}
