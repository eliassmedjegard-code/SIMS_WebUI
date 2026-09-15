// Wraps all localStorage access. No sensitive data (message content is kept
// local-only by design of this prototype; a real backend should decide what,
// if anything, is safe to persist client-side).

const KEYS = {
  settings: 'aica.settings.v1',
  conversations: 'aica.conversations.v1',
};

export const defaultSettings = {
  ollamaUrl: 'http://localhost:11434',
  model: '', // empty = "not selected yet", populated from getModels()
  temperature: 0.3,
  maxTokens: 1024,
  theme: 'light', // 'light' | 'dark' | 'system'
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
  } catch {
    // localStorage unavailable (private mode, quota) — settings simply won't persist.
  }
}

export function getStoredConversations() {
  try {
    const raw = localStorage.getItem(KEYS.conversations);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredConversations(conversations) {
  try {
    localStorage.setItem(KEYS.conversations, JSON.stringify(conversations));
  } catch {
    // Ignore quota/availability errors — chat still works for the session.
  }
}

export function clearConversationHistory() {
  localStorage.removeItem(KEYS.conversations);
}
