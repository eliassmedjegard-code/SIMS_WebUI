// All direct communication with Ollama lives here. Nothing else in the app
// should call fetch() against an Ollama URL.
//
// Future replacement path: once the backend in the architecture diagram
// exists, swap this module's generateResponse/getModels implementations to
// call `POST /api/chat` on your own backend instead of Ollama directly. The
// call sites in chat.js only depend on the method signatures below, not on
// Ollama's wire format, so the rest of the app should not need to change.

export const ConnectionState = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

export class OllamaError extends Error {
  constructor(type, message, cause) {
    super(message);
    this.name = 'OllamaError';
    this.type = type; // 'unreachable' | 'model_not_found' | 'invalid_response' | 'aborted' | 'http_error' | 'unknown'
    this.cause = cause;
  }
}

export class OllamaService {
  constructor(baseUrl) {
    this.baseUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    this._activeController = null;
  }

  setBaseUrl(url) {
    this.baseUrl = (url || 'http://localhost:11434').replace(/\/+$/, '');
  }

  /** Lightweight reachability + liveness check. Never throws. */
  async checkConnection() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      if (!res.ok) {
        return { state: ConnectionState.ERROR, message: `Ollama responded with HTTP ${res.status}` };
      }
      return { state: ConnectionState.CONNECTED, message: 'Local AI connected' };
    } catch (err) {
      return {
        state: ConnectionState.DISCONNECTED,
        message: 'Ollama is not running',
        cause: err,
      };
    }
  }

  /** Returns an array of installed model names, e.g. ["qwen2.5:7b", "llama3.1:8b"]. */
  async getModels() {
    let res;
    try {
      res = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
    } catch (err) {
      throw new OllamaError('unreachable', 'Could not reach Ollama.', err);
    }
    if (!res.ok) {
      throw new OllamaError('http_error', `Ollama responded with HTTP ${res.status}.`);
    }
    let data;
    try {
      data = await res.json();
    } catch (err) {
      throw new OllamaError('invalid_response', 'Ollama returned an unreadable response.', err);
    }
    if (!data || !Array.isArray(data.models)) {
      throw new OllamaError('invalid_response', 'Ollama returned an unexpected response shape.');
    }
    return data.models.map((m) => m.name).filter(Boolean);
  }

  /** Aborts any in-flight generateResponse() call. Safe to call when idle. */
  cancelGeneration() {
    if (this._activeController) {
      this._activeController.abort();
      this._activeController = null;
    }
  }

  /**
   * Streams a chat completion from Ollama.
   *
   * @param {Object} params
   * @param {string} params.model
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {number} [params.temperature]
   * @param {number} [params.maxTokens]
   * @param {(chunkText: string, fullText: string) => void} [params.onToken]
   * @returns {Promise<string>} the full accumulated response text
   */
  async generateResponse({ model, messages, temperature, maxTokens, onToken }) {
    if (!model) {
      throw new OllamaError('model_not_found', 'No model selected.');
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new OllamaError('unknown', 'No messages to send.');
    }

    const controller = new AbortController();
    this._activeController = controller;

    let res;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: {
            temperature: temperature ?? 0.3,
            num_predict: maxTokens ?? 1024,
          },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      this._activeController = null;
      if (err.name === 'AbortError') {
        throw new OllamaError('aborted', 'Generation was cancelled.', err);
      }
      throw new OllamaError('unreachable', 'Could not reach Ollama.', err);
    }

    if (!res.ok) {
      this._activeController = null;
      if (res.status === 404) {
        throw new OllamaError('model_not_found', `Model "${model}" is not available.`);
      }
      throw new OllamaError('http_error', `Ollama responded with HTTP ${res.status}.`);
    }

    if (!res.body) {
      this._activeController = null;
      throw new OllamaError('invalid_response', 'Ollama did not return a readable stream.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          fullText = this._consumeLine(trimmed, fullText, onToken);
        }
      }
      if (buffer.trim()) {
        fullText = this._consumeLine(buffer.trim(), fullText, onToken);
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        const abortErr = new OllamaError('aborted', 'Generation was cancelled.', err);
        abortErr.partialText = fullText;
        throw abortErr;
      }
      throw new OllamaError('unknown', 'Streaming failed unexpectedly.', err);
    } finally {
      this._activeController = null;
    }

    return fullText;
  }

  _consumeLine(line, fullText, onToken) {
    let json;
    try {
      json = JSON.parse(line);
    } catch {
      return fullText; // skip malformed NDJSON line
    }
    if (json.error) {
      throw new OllamaError('http_error', json.error);
    }
    const piece = json.message?.content ?? '';
    if (piece) {
      fullText += piece;
      onToken?.(piece, fullText);
    }
    return fullText;
  }
}
