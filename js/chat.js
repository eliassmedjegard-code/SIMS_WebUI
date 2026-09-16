// Conversation state management for the single ongoing conversation: append
// messages, persist it, clear it. No DOM access and no Ollama calls happen
// here — app.js wires this to the UI and to ollama.js.
//
// Deliberately no multi-conversation history: only the current conversation
// is ever kept, so there is no "recent chats" list and no cross-session log
// of what was asked.

import { getStoredConversation, saveStoredConversation, clearStoredConversation } from './storage.js';

export class ChatStore {
  constructor() {
    this.conversation = getStoredConversation() ?? createEmptyConversation();
  }

  getConversation() {
    return this.conversation;
  }

  addMessage(message) {
    this.conversation.messages.push(message);
    this.conversation.updatedAt = new Date().toISOString();
    this._persist();
  }

  updateLastMessage(patch) {
    if (this.conversation.messages.length === 0) return;
    Object.assign(this.conversation.messages[this.conversation.messages.length - 1], patch);
    this._persist();
  }

  removeLastMessage() {
    if (this.conversation.messages.length === 0) return;
    this.conversation.messages.pop();
    this._persist();
  }

  clearConversation() {
    this.conversation = createEmptyConversation();
    clearStoredConversation();
  }

  _persist() {
    saveStoredConversation(this.conversation);
  }
}

function createEmptyConversation() {
  return { messages: [], updatedAt: new Date().toISOString() };
}
