// Wraps all localStorage access. Only settings and the single current
// conversation are persisted (see chat.js) — there is deliberately no saved
// history of past conversations, to keep the app's local data footprint
// minimal.

const KEYS = {
  settings: 'aica.settings.v1',
  conversation: 'aica.conversation.v1',
};

export const defaultSettings = {
  ollamaUrl: 'http://localhost:11434',
  model: '', // empty = "not selected yet", populated from getModels()
  temperature: 0.3,
  maxTokens: 1024,
  theme: 'light', // one of the ids in js/themes.js
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

export function getStoredConversation() {
  try {
    const raw = localStorage.getItem(KEYS.conversation);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredConversation(conversation) {
  try {
    localStorage.setItem(KEYS.conversation, JSON.stringify(conversation));
  } catch {
    // Ignore quota/availability errors — chat still works for the session.
  }
}

export function clearStoredConversation() {
  localStorage.removeItem(KEYS.conversation);
}
