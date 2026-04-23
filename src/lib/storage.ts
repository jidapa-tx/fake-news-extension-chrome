import type { SiteSettings, HistoryEntry } from "./types";

const SETTINGS_KEY = "sbs_settings";
const HISTORY_KEY = "sbs_history";

const DEFAULT_SETTINGS: SiteSettings = {
  enabled: true,
  sites: { facebook: false, twitter: false, lineToday: false },
};

function isChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage;
}

export const storage = {
  async getSettings(): Promise<SiteSettings> {
    if (isChromeStorage()) {
      return new Promise((resolve) =>
        chrome.storage.local.get(SETTINGS_KEY, (r) =>
          resolve(r[SETTINGS_KEY] ?? DEFAULT_SETTINGS),
        ),
      );
    }
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  },

  async saveSettings(s: SiteSettings): Promise<void> {
    if (isChromeStorage()) {
      return new Promise((resolve) =>
        chrome.storage.local.set({ [SETTINGS_KEY]: s }, resolve),
      );
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  },

  async getHistory(): Promise<HistoryEntry[]> {
    if (isChromeStorage()) {
      return new Promise((resolve) =>
        chrome.storage.local.get(HISTORY_KEY, (r) =>
          resolve(r[HISTORY_KEY] ?? []),
        ),
      );
    }
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  async addHistory(entry: HistoryEntry): Promise<void> {
    const hist = await this.getHistory();
    const updated = [entry, ...hist].slice(0, 50);
    if (isChromeStorage()) {
      return new Promise((resolve) =>
        chrome.storage.local.set({ [HISTORY_KEY]: updated }, resolve),
      );
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  },

  async clearHistory(): Promise<void> {
    if (isChromeStorage()) {
      return new Promise((resolve) =>
        chrome.storage.local.remove(HISTORY_KEY, resolve),
      );
    }
    localStorage.removeItem(HISTORY_KEY);
  },

  async clearAll(): Promise<void> {
    if (isChromeStorage()) {
      return new Promise((resolve) => chrome.storage.local.clear(resolve));
    }
    localStorage.clear();
  },
};
