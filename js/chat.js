// Conversation state management: create/select/delete conversations, append
// messages, persist to storage. No DOM access and no Ollama calls happen
// here — app.js wires this to the UI and to ollama.js.

import { getStoredConversations, saveStoredConversations, clearConversationHistory } from './storage.js';
import { mockConversations } from '../data/mock-data.js';

export class ChatStore {
  constructor() {
    const stored = getStoredConversations();
    this.conversations = stored.length > 0 ? stored : cloneMock();
    this.currentConversationId = this.getConversations()[0]?.id ?? null;
    if (stored.length === 0) this._persist();
  }

  getConversations() {
    return [...this.conversations].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  getCurrentConversation() {
    return this.conversations.find((c) => c.id === this.currentConversationId) ?? null;
  }

  createConversation() {
    const conv = {
      id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: 'New conversation',
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    this.conversations.unshift(conv);
    this.currentConversationId = conv.id;
    this._persist();
    return conv;
  }

  selectConversation(id) {
    if (this.conversations.some((c) => c.id === id)) {
      this.currentConversationId = id;
    }
    return this.getCurrentConversation();
  }

  deleteConversation(id) {
    this.conversations = this.conversations.filter((c) => c.id !== id);
    if (this.currentConversationId === id) {
      this.currentConversationId = this.conversations[0]?.id ?? null;
    }
    this._persist();
  }

  clearCurrentConversation() {
    const conv = this.getCurrentConversation();
    if (!conv) return;
    conv.messages = [];
    conv.title = 'New conversation';
    conv.updatedAt = new Date().toISOString();
    this._persist();
  }

  clearAllHistory() {
    clearConversationHistory();
    this.conversations = [];
    this.currentConversationId = null;
  }

  addMessage(conversationId, message) {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv) return;
    conv.messages.push(message);
    conv.updatedAt = new Date().toISOString();
    if (conv.title === 'New conversation' && message.role === 'user') {
      conv.title = deriveTitle(message.content);
    }
    this._persist();
  }

  updateLastMessage(conversationId, patch) {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv || conv.messages.length === 0) return;
    Object.assign(conv.messages[conv.messages.length - 1], patch);
    this._persist();
  }

  removeLastMessage(conversationId) {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv || conv.messages.length === 0) return;
    conv.messages.pop();
    this._persist();
  }

  searchConversations(query) {
    const q = query.trim().toLowerCase();
    if (!q) return this.getConversations();
    return this.getConversations().filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content?.toLowerCase().includes(q))
    );
  }

  _persist() {
    saveStoredConversations(this.conversations);
  }
}

function deriveTitle(content) {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed || 'New conversation';
}

function cloneMock() {
  return JSON.parse(JSON.stringify(mockConversations));
}
