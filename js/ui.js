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
  let text = escaped.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang.trim(), code: code.replace(/\n$/, '') });
    return `
