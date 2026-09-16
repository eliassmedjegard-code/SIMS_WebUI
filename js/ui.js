// DOM rendering helpers: markdown rendering, message/source/context markup,
// status badges, and small utilities. Keeps chat.js and app.js free of
// string-building HTML.

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Minimal, dependency-free Markdown -> HTML renderer covering the subset
 * this app needs: headings, bold/italic, inline code, fenced code blocks,
 * unordered/ordered lists, tables, and paragraphs. All text is HTML-escaped
 * before any markup is applied, so model output can never inject HTML.
 */
export function renderMarkdown(rawText) {
  const escaped = escapeHtml(rawText ?? '');

  // Pull out fenced code blocks first so their content is immune to every
  // other transformation, then restore them at the end.
  const codeBlocks = [];
  const text = escaped.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang.trim(), code: code.replace(/\n$/, '') });
    return `\n%%CODEBLOCK_${idx}%%\n`;
  });

  const lines = text.split('\n');
  const htmlParts = [];
  let paragraphBuffer = [];
  let listBuffer = null; // { type: 'ul' | 'ol', items: string[] }
  let tableBuffer = null; // { header: string[], rows: string[][] }

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      htmlParts.push(`<p>${applyInline(paragraphBuffer.join(' '))}</p>`);
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer) {
      const items = listBuffer.items.map((item) => `<li>${applyInline(item)}</li>`).join('');
      htmlParts.push(`<${listBuffer.type}>${items}</${listBuffer.type}>`);
      listBuffer = null;
    }
  };

  const flushTable = () => {
    if (tableBuffer) {
      const head = `<tr>${tableBuffer.header.map((c) => `<th>${applyInline(c)}</th>`).join('')}</tr>`;
      const body = tableBuffer.rows
        .map((row) => `<tr>${row.map((c) => `<td>${applyInline(c)}</td>`).join('')}</tr>`)
        .join('');
      htmlParts.push(`<table><thead>${head}</thead><tbody>${body}</tbody></table>`);
      tableBuffer = null;
    }
  };

  const headingRe = /^(#{1,4})\s+(.*)$/;
  const ulRe = /^[-*]\s+(.*)$/;
  const olRe = /^\d+\.\s+(.*)$/;
  const blockquoteRe = /^&gt;\s?(.*)$/; // '>' was already HTML-escaped above
  const tableRowRe = /^\|(.+)\|$/;
  const tableSepRe = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/;
  const codeBlockPlaceholderRe = /^%%CODEBLOCK_(\d+)%%$/;

  const splitTableRow = (row) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    const placeholderMatch = trimmed.match(codeBlockPlaceholderRe);
    if (placeholderMatch) {
      flushParagraph();
      flushList();
      flushTable();
      const block = codeBlocks[Number(placeholderMatch[1])];
      const langClass = block.lang ? ` class="language-${block.lang}"` : '';
      htmlParts.push(`<pre><code${langClass}>${block.code}</code></pre>`);
      i++;
      continue;
    }

    if (trimmed === '') {
      flushParagraph();
      flushList();
      flushTable();
      i++;
      continue;
    }

    const headingMatch = trimmed.match(headingRe);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushTable();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${applyInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    if (tableRowRe.test(trimmed) && i + 1 < lines.length && tableSepRe.test(lines[i + 1].trim())) {
      flushParagraph();
      flushList();
      tableBuffer = { header: splitTableRow(trimmed), rows: [] };
      i += 2;
      while (i < lines.length && tableRowRe.test(lines[i].trim())) {
        tableBuffer.rows.push(splitTableRow(lines[i]));
        i++;
      }
      flushTable();
      continue;
    }

    const ulMatch = trimmed.match(ulRe);
    if (ulMatch) {
      flushParagraph();
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(ulMatch[1]);
      i++;
      continue;
    }

    const olMatch = trimmed.match(olRe);
    if (olMatch) {
      flushParagraph();
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(olMatch[1]);
      i++;
      continue;
    }

    const blockquoteMatch = trimmed.match(blockquoteRe);
    if (blockquoteMatch) {
      flushParagraph();
      flushList();
      flushTable();
      htmlParts.push(`<blockquote>${applyInline(blockquoteMatch[1])}</blockquote>`);
      i++;
      continue;
    }

    flushList();
    flushTable();
    paragraphBuffer.push(trimmed);
    i++;
  }

  flushParagraph();
  flushList();
  flushTable();

  return htmlParts.join('\n');
}

function applyInline(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
}

/** Builds the "Sources" chip list attached under an assistant message. */
export function buildSourcesHtml(sources) {
  const items = sources
    .map(
      (src, idx) => `
        <li>
          <button type="button" class="source-chip" data-source-index="${idx}">
            <span class="source-title">${escapeHtml(src.title)}</span>
            <span class="source-meta">${escapeHtml(src.section)} · ${escapeHtml(src.document)}, p. ${escapeHtml(String(src.page))}</span>
          </button>
        </li>`
    )
    .join('');

  return `
    <div class="message-sources">
      <div class="sources-label">Sources</div>
      <ul class="sources-list">${items}</ul>
    </div>`;
}

/** Builds the collapsible "N documents · N sections referenced" indicator. */
export function buildContextHtml(context) {
  const docs = context.documents.map((d) => `<li>${escapeHtml(d)}</li>`).join('');
  const docLabel = context.documentCount === 1 ? 'document' : 'documents';
  const sectionLabel = context.sectionCount === 1 ? 'section' : 'sections';

  return `
    <details class="context-indicator">
      <summary>${context.documentCount} ${docLabel} · ${context.sectionCount} ${sectionLabel} referenced</summary>
      <ul class="context-doc-list">${docs}</ul>
    </details>`;
}

export function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}

/** Grows a textarea to fit its content, up to the CSS max-height (200px, overflow scrolls beyond that). */
export function autosizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}
