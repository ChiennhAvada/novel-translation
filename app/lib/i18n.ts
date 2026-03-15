export type AppLang = "en" | "vi";

const translations = {
  en: {
    appTitle: "Novel Translator",
    chapters: "Chapters",
    novels: "Novels",
    settings: "Settings",
    translate: "Translate",
    fetching: "Fetching...",
    simplifying: "Simplifying...",
    pastePlaceholder: "Paste chapter link...",
    contentPlaceholder: "Content will appear here...",
    previous: "Previous",
    next: "Next",
    noChapters: "No chapters found",
    noNovels: "No saved novels",
    searchChapter: "Search by chapter number...",
    clear: "Clear",
    aiModel: "AI Model",
    apiKey: "API Key",
    apiKeyPlaceholder: "Enter your API key...",
    apiKeyNote: "Key is stored locally in your browser only.",
    background: "Background",
    fontSize: "Font size",
    lineSpacing: "Line spacing",
    autoLineBreak: "Auto paragraph breaks (AI detects where to break lines)",
    supportedSites: "Supported websites",
    language: "Language",
  },
  vi: {
    appTitle: "Dịch Truyện",
    chapters: "Chương",
    novels: "Truyện",
    settings: "Cài đặt",
    translate: "Dịch",
    fetching: "Đang tải...",
    simplifying: "Đang dịch...",
    pastePlaceholder: "Dán link chương truyện...",
    contentPlaceholder: "Nội dung sẽ hiển thị ở đây...",
    previous: "Trước",
    next: "Sau",
    noChapters: "Không tìm thấy chương",
    noNovels: "Chưa có truyện nào",
    searchChapter: "Tìm theo số chương...",
    clear: "Xóa",
    aiModel: "Mô hình AI",
    apiKey: "Khóa API",
    apiKeyPlaceholder: "Nhập khóa API...",
    apiKeyNote: "Khóa chỉ lưu trên trình duyệt của bạn.",
    background: "Nền",
    fontSize: "Cỡ chữ",
    lineSpacing: "Giãn dòng",
    autoLineBreak: "Tự động ngắt đoạn (AI tự nhận diện chỗ xuống dòng)",
    supportedSites: "Trang web hỗ trợ",
    language: "Ngôn ngữ",
  },
} as const;

export type Translations = Record<keyof typeof translations.en, string>;

export function getTranslations(lang: AppLang): Translations {
  return translations[lang] as Translations;
}
