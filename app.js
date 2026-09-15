// Application bootstrap and DOM wiring. This is the only module that talks
// to the DOM directly for app-wide concerns; it composes chat.js (state),
// ollama.js (local AI), storage.js (persistence), and ui.js (render helpers).
//
// Future backend swap: everything below that calls `ollama.*` is the seam
// where a real backend's `POST /api/chat` would be called instead. See the
// header comment in ollama.js and README.md for details.

import { OllamaService, OllamaError, ConnectionState } from './ollama.js';
import { ChatStore } from './chat.js';
import { getSettings, saveSettings } from './storage.js';
import {
  renderMarkdown,
  escapeHtml,
  formatRelativeDateGroup,
  buildSourcesHtml,
  buildContextHtml,
  scrollToBottom,
  autosizeTextarea,
} from './ui.js';
import { suggestionPrompts, mockSourcesForLiveResponse, mockContextForLiveResponse, mockUser } from '../data/mock-data.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const settings = getSettings();
const ollama = new OllamaService(settings.ollamaUrl);
const store = new ChatStore();

let isGenerating = false;
let currentConnectionState = ConnectionState.CONNECTING;
let toastTimer = null;

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const el = {
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  newChatBtn: document.getElementById('newChatBtn'),
  searchChats: document.getElementById('searchChats'),
  conversationList: document.getElementById('conversationList'),
  sidebarStatusDot: document.getElementById('sidebarStatusDot'),
  sidebarStatusText: document.getElementById('sidebarStatusText'),
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userRole: document.getElementById('userRole'),

  conversationTitle: document.getElementById('conversationTitle'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  currentModelBadge: document.getElementById('currentModelBadge'),
  settingsBtn: document.getElementById('settingsBtn'),

  errorBanner: document.getElementById('errorBanner'),
  errorBannerText: document.getElementById('errorBannerText'),
  errorBannerAction: document.getElementById('errorBannerAction'),

  chatMessages: document.getElementById('chatMessages'),
  emptyState: document.getElementById('emptyState'),
  suggestionGrid: document.getElementById('suggestionGrid'),

  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  stopBtn: document.getElementById('stopBtn'),
  attachBtn: document.getElementById('attachBtn'),

  settingsOverlay: document.getElementById('settingsOverlay'),
  settingsCloseBtn: document.getElementById('settingsCloseBtn'),
  settingsCancelBtn: document.getElementById('settingsCancelBtn'),
  ollamaUrlInput: document.getElementById('ollamaUrlInput'),
  modelSelect: document.getElementById('modelSelect'),
  modelHint: document.getElementById('modelHint'),
  temperatureInput: document.getElementById('temperatureInput'),
  temperatureValue: document.getElementById('temperatureValue'),
  maxTokensInput: document.getElementById('maxTokensInput'),
  themeOptions: Array.from(document.querySelectorAll('[data-theme-choice]')),
  clearCurrentBtn: document.getElementById('clearCurrentBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),

  toast: document.getElementById('toast'),
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  el.userAvatar.textContent = mockUser.initials;
  el.userName.textContent = mockUser.name;
  el.userRole.textContent = mockUser.role;

  applyTheme(settings.theme);
  renderSuggestions();
  renderSidebar();
  renderConversation(store.getCurrentConversation());

  wireEvents();
  updateSendAvailability();
  refreshConnection();
  setInterval(refreshConnection, 15000);
}

// ---------------------------------------------------------------------------
// Sidebar rendering
// ---------------------------------------------------------------------------

function renderSidebar(query = '') {
  const conversations = query ? store.searchConversations(query) : store.getConversations();
  el.conversationList.innerHTML = '';

  if (conversations.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'no-results';
    empty.textContent = query ? 'No matching conversations.' : 'No conversations yet.';
    el.conversationList.appendChild(empty);
    return;
  }

  let lastGroup = null;
  for (const conv of conversations) {
    const group = formatRelativeDateGroup(conv.updatedAt);
    if (group !== lastGroup) {
      const label = document.createElement('div');
      label.className = 'conversation-group-label';
      label.textContent = group;
      el.conversationList.appendChild(label);
      lastGroup = group;
    }

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'conversation-item' + (conv.id === store.currentConversationId ? ' active' : '');
    item.setAttribute('aria-current', conv.id === store.currentConversationId ? 'true' : 'false');

    const title = document.createElement('span');
    title.className = 'conv-title';
    title.textContent = conv.title;
    item.appendChild(title);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'conv-delete';
    del.setAttribute('aria-label', `Delete conversation "${conv.title}"`);
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${conv.title}"? This cannot be undone.`)) {
        store.deleteConversation(conv.id);
        renderSidebar(el.searchChats.value);
        renderConversation(store.getCurrentConversation());
      }
    });
    item.appendChild(del);

    item.addEventListener('click', () => {
      store.selectConversation(conv.id);
      renderSidebar(el.searchChats.value);
      renderConversation(store.getCurrentConversation());
      closeMobileSidebar();
    });

    el.conversationList.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// Conversation / message rendering
// ---------------------------------------------------------------------------

function renderSuggestions() {
  el.suggestionGrid.innerHTML = '';
  for (const prompt of suggestionPrompts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggestion-card';
    btn.textContent = prompt;
    btn.addEventListener('click', () => sendMessage(prompt));
    el.suggestionGrid.appendChild(btn);
  }
}

function renderConversation(conv) {
  el.conversationTitle.textContent = conv?.title || 'New conversation';
  el.chatMessages.innerHTML = '';

  if (!conv || conv.messages.length === 0) {
    el.chatMessages.appendChild(buildEmptyState());
    return;
  }

  for (const message of conv.messages) {
    const { row } = createMessageElement(message);
    el.chatMessages.appendChild(row);
  }
  scrollToBottom(el.chatMessages);
}

function buildEmptyState() {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';
  wrap.innerHTML = `
    <h2>AI Compliance Assistant</h2>
    <p>Ask questions about AI regulations, company policies, and governance documentation.</p>
    <div class="suggestion-grid" id="suggestionGridInline"></div>
  `;
  const grid = wrap.querySelector('#suggestionGridInline');
  for (const prompt of suggestionPrompts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggestion-card';
    btn.textContent = prompt;
    btn.addEventListener('click', () => sendMessage(prompt));
    grid.appendChild(btn);
  }
  return wrap;
}

function createMessageElement(message, { streaming = false } = {}) {
  const row = document.createElement('div');
  row.className = `message-row ${message.role}`;

  if (message.role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'assistant-avatar';
    avatar.textContent = 'AI';
    avatar.setAttribute('aria-hidden', 'true');
    row.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content' + (streaming ? ' streaming-cursor' : '');
  contentDiv.innerHTML = renderMarkdown(message.content || '');
  bubble.appendChild(contentDiv);

  if (message.sources && message.sources.length > 0) {
    const wrap = document.createElement('div');
    wrap.innerHTML = buildSourcesHtml(message.sources);
    const sourcesEl = wrap.firstElementChild;
    sourcesEl.querySelectorAll('.source-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.sourceIndex);
        const src = message.sources[idx];
        showToast(`"${src.document}", page ${src.page} — document preview will be available once RAG retrieval is connected.`);
      });
    });
    bubble.appendChild(sourcesEl);
  }

  if (message.context) {
    const wrap = document.createElement('div');
    wrap.innerHTML = buildContextHtml(message.context);
    bubble.appendChild(wrap.firstElementChild);
  }

  row.appendChild(bubble);
  return { row, contentDiv };
}

// ---------------------------------------------------------------------------
// Sending messages / streaming
// ---------------------------------------------------------------------------

function sendMessage(text) {
  const trimmed = (text ?? el.chatInput.value).trim();
  if (!trimmed || isGenerating) return;

  let conv = store.getCurrentConversation();
  if (!conv) conv = store.createConversation();

  store.addMessage(conv.id, { role: 'user', content: trimmed });
  renderConversation(store.getCurrentConversation());
  renderSidebar(el.searchChats.value);

  el.chatInput.value = '';
  autosizeTextarea(el.chatInput);

  generateAssistantReply(conv.id);
}

async function generateAssistantReply(conversationId) {
  hideErrorBanner();

  if (currentConnectionState !== ConnectionState.CONNECTED) {
    showErrorBanner('Local AI is unavailable. Make sure Ollama is running, then retry.', {
      actionLabel: 'Retry',
      action: refreshConnection,
    });
    return;
  }
  if (!settings.model) {
    showErrorBanner('No model selected. Choose an installed model in Settings.', {
      actionLabel: 'Open settings',
      action: openSettings,
    });
    return;
  }

  const conv = store.conversations.find((c) => c.id === conversationId);
  if (!conv) return;

  const historyForModel = conv.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  store.addMessage(conversationId, { role: 'assistant', content: '' });
  renderSidebar(el.searchChats.value);

  const placeholderMsg = conv.messages[conv.messages.length - 1];
  let { row, contentDiv } = createMessageElement(placeholderMsg, { streaming: true });
  el.chatMessages.appendChild(row);
  scrollToBottom(el.chatMessages);

  setGeneratingState(true);

  try {
    const fullText = await ollama.generateResponse({
      model: settings.model,
      messages: historyForModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      onToken: (_, full) => {
        contentDiv.innerHTML = renderMarkdown(full);
        scrollToBottom(el.chatMessages);
      },
    });

    const finalContent = fullText.trim() || '_The model returned an empty response._';
    store.updateLastMessage(conversationId, {
      content: finalContent,
      sources: mockSourcesForLiveResponse,
      context: mockContextForLiveResponse,
    });

    row.remove();
    const finalMsg = store.conversations.find((c) => c.id === conversationId).messages.at(-1);
    const rendered = createMessageElement(finalMsg);
    el.chatMessages.appendChild(rendered.row);
    scrollToBottom(el.chatMessages);
    renderSidebar(el.searchChats.value);
  } catch (err) {
    handleGenerationError(err, conversationId, row, contentDiv);
  } finally {
    setGeneratingState(false);
  }
}

function handleGenerationError(err, conversationId, row, contentDiv) {
  contentDiv.classList.remove('streaming-cursor');

  if (err instanceof OllamaError && err.type === 'aborted') {
    const partial = (err.partialText || '').trim();
    const content = partial ? `${partial}\n\n*(Generation stopped.)*` : '*(Generation stopped before any output.)*';
    store.updateLastMessage(conversationId, { content });
    contentDiv.innerHTML = renderMarkdown(content);
    return;
  }

  row.remove();
  store.removeLastMessage(conversationId);
  console.error('Generation failed:', err?.type ?? 'unknown', err?.message);
  showErrorBanner(friendlyErrorMessage(err), { actionLabel: 'Retry', action: () => generateAssistantReply(conversationId) });
}

function friendlyErrorMessage(err) {
  if (err instanceof OllamaError) {
    switch (err.type) {
      case 'unreachable':
        return "Can't reach the local AI service. Make sure Ollama is running.";
      case 'model_not_found':
        return 'The selected model is not available. Choose another model in Settings.';
      case 'invalid_response':
        return 'Local AI returned an unexpected response. Please try again.';
      case 'http_error':
        return 'Local AI returned an error while generating a response.';
      default:
        return 'Something went wrong while generating a response.';
    }
  }
  return 'Something went wrong while generating a response.';
}

function setGeneratingState(generating) {
  isGenerating = generating;
  el.sendBtn.hidden = generating;
  el.stopBtn.hidden = !generating;
  el.chatInput.disabled = generating;
  updateSendAvailability();
}

function stopGeneration() {
  ollama.cancelGeneration();
}

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------

async function refreshConnection() {
  setStatusUI(ConnectionState.CONNECTING, 'Checking connection…', 'Checking local AI…');

  const result = await ollama.checkConnection();

  if (result.state !== ConnectionState.CONNECTED) {
    currentConnectionState = ConnectionState.DISCONNECTED;
    setStatusUI(ConnectionState.DISCONNECTED, 'Local AI unavailable · Ollama is not running', 'Local AI unavailable');
    el.currentModelBadge.hidden = true;
    populateModelSelect([]);
    updateSendAvailability();
    return;
  }

  try {
    const models = await ollama.getModels();
    populateModelSelect(models);

    if (models.length === 0) {
      currentConnectionState = ConnectionState.ERROR;
      setStatusUI(ConnectionState.ERROR, 'Ollama connected · no models installed', 'No models installed');
      el.currentModelBadge.hidden = true;
    } else {
      if (!settings.model || !models.includes(settings.model)) {
        settings.model = models[0];
        saveSettings(settings);
      }
      currentConnectionState = ConnectionState.CONNECTED;
      setStatusUI(ConnectionState.CONNECTED, `Local AI connected · Model: ${settings.model}`, 'Local AI connected');
      el.currentModelBadge.hidden = false;
      el.currentModelBadge.textContent = settings.model;
    }
  } catch (err) {
    currentConnectionState = ConnectionState.ERROR;
    setStatusUI(ConnectionState.ERROR, 'Connected, but failed to list models', 'Connected · model list failed');
    el.currentModelBadge.hidden = true;
  }

  updateSendAvailability();
}

function setStatusUI(state, headerText, sidebarText) {
  el.statusDot.className = `status-dot ${state}`;
  el.statusText.textContent = headerText;
  el.sidebarStatusDot.className = `status-dot ${state}`;
  el.sidebarStatusText.textContent = sidebarText;
}

// The send button is only gated on "is there text" and "is generation in
// progress" — it stays enabled even when Ollama is unreachable or no model
// is selected, since clicking it then surfaces a specific, actionable error
// banner instead of a silently disabled control with no explanation.
function updateSendAvailability() {
  el.sendBtn.disabled = isGenerating || el.chatInput.value.trim().length === 0;
}

// ---------------------------------------------------------------------------
// Settings modal
// ---------------------------------------------------------------------------

function openSettings() {
  el.ollamaUrlInput.value = settings.ollamaUrl;
  el.temperatureInput.value = settings.temperature;
  el.temperatureValue.textContent = settings.temperature;
  el.maxTokensInput.value = settings.maxTokens;
  updateThemeButtons();
  el.settingsOverlay.hidden = false;
  refreshModelListForSettings();
  el.settingsCloseBtn.focus();
  document.addEventListener('keydown', onSettingsKeydown);
}

function closeSettings() {
  el.settingsOverlay.hidden = true;
  document.removeEventListener('keydown', onSettingsKeydown);
  el.settingsBtn.focus();
}

function onSettingsKeydown(e) {
  if (e.key === 'Escape') closeSettings();
}

async function refreshModelListForSettings() {
  el.modelHint.textContent = 'Loading models…';
  try {
    const models = await ollama.getModels();
    populateModelSelect(models);
    el.modelHint.textContent = models.length
      ? `${models.length} model${models.length === 1 ? '' : 's'} found on this Ollama instance.`
      : 'Ollama is reachable but no models are installed. Run "ollama pull <model>".';
  } catch (err) {
    populateModelSelect([]);
    el.modelHint.textContent = 'Could not load models. Check the Ollama URL and connection.';
  }
}

function populateModelSelect(models) {
  el.modelSelect.innerHTML = '';
  if (models.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No models found';
    el.modelSelect.appendChild(opt);
    el.modelSelect.disabled = true;
    return;
  }
  el.modelSelect.disabled = false;
  for (const name of models) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === settings.model) opt.selected = true;
    el.modelSelect.appendChild(opt);
  }
}

function updateThemeButtons() {
  el.themeOptions.forEach((btn) => {
    const active = btn.dataset.themeChoice === settings.theme;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
  });
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// ---------------------------------------------------------------------------
// Toast / error banner
// ---------------------------------------------------------------------------

function showToast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 3500);
}

function showErrorBanner(message, { actionLabel = 'Dismiss', action = null } = {}) {
  el.errorBannerText.textContent = message;
  el.errorBannerAction.textContent = actionLabel;
  el.errorBannerAction.onclick = () => {
    hideErrorBanner();
    action?.();
  };
  el.errorBanner.hidden = false;
}

function hideErrorBanner() {
  el.errorBanner.hidden = true;
}

// ---------------------------------------------------------------------------
// Mobile sidebar
// ---------------------------------------------------------------------------

function openMobileSidebar() {
  el.sidebar.classList.add('open');
  el.sidebarOverlay.classList.add('open');
  el.sidebarToggle.setAttribute('aria-expanded', 'true');
}

function closeMobileSidebar() {
  el.sidebar.classList.remove('open');
  el.sidebarOverlay.classList.remove('open');
  el.sidebarToggle.setAttribute('aria-expanded', 'false');
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function wireEvents() {
  el.newChatBtn.addEventListener('click', () => {
    store.createConversation();
    renderSidebar(el.searchChats.value);
    renderConversation(store.getCurrentConversation());
    closeMobileSidebar();
  });

  el.searchChats.addEventListener('input', () => renderSidebar(el.searchChats.value));

  el.sidebarToggle.addEventListener('click', () => {
    const isOpen = el.sidebar.classList.contains('open');
    isOpen ? closeMobileSidebar() : openMobileSidebar();
  });
  el.sidebarOverlay.addEventListener('click', closeMobileSidebar);

  el.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  el.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  el.chatInput.addEventListener('input', () => {
    autosizeTextarea(el.chatInput);
    updateSendAvailability();
  });

  el.stopBtn.addEventListener('click', stopGeneration);

  el.settingsBtn.addEventListener('click', openSettings);
  el.settingsCloseBtn.addEventListener('click', closeSettings);
  el.settingsCancelBtn.addEventListener('click', closeSettings);
  el.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === el.settingsOverlay) closeSettings();
  });

  el.ollamaUrlInput.addEventListener('change', () => {
    const url = el.ollamaUrlInput.value.trim() || 'http://localhost:11434';
    settings.ollamaUrl = url;
    saveSettings(settings);
    ollama.setBaseUrl(url);
    refreshConnection();
    refreshModelListForSettings();
  });

  el.modelSelect.addEventListener('change', () => {
    settings.model = el.modelSelect.value;
    saveSettings(settings);
    if (currentConnectionState === ConnectionState.CONNECTED) {
      setStatusUI(ConnectionState.CONNECTED, `Local AI connected · Model: ${settings.model}`, 'Local AI connected');
      el.currentModelBadge.hidden = false;
      el.currentModelBadge.textContent = settings.model;
    }
    updateSendAvailability();
  });

  el.temperatureInput.addEventListener('input', () => {
    el.temperatureValue.textContent = el.temperatureInput.value;
  });
  el.temperatureInput.addEventListener('change', () => {
    settings.temperature = Number(el.temperatureInput.value);
    saveSettings(settings);
  });

  el.maxTokensInput.addEventListener('change', () => {
    const value = Math.max(64, Math.min(8192, Number(el.maxTokensInput.value) || 1024));
    el.maxTokensInput.value = value;
    settings.maxTokens = value;
    saveSettings(settings);
  });

  el.themeOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      settings.theme = btn.dataset.themeChoice;
      saveSettings(settings);
      applyTheme(settings.theme);
      updateThemeButtons();
    });
  });

  el.clearCurrentBtn.addEventListener('click', () => {
    if (!store.getCurrentConversation()) return;
    if (confirm('Clear all messages in this conversation?')) {
      store.clearCurrentConversation();
      renderConversation(store.getCurrentConversation());
      renderSidebar(el.searchChats.value);
    }
  });

  el.clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Delete all conversation history? This cannot be undone.')) {
      store.clearAllHistory();
      renderSidebar();
      renderConversation(null);
    }
  });
}

// ---------------------------------------------------------------------------

init();
