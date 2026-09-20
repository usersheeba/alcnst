/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes rich text HTML for screenplay and prose nodes.
 * Converts legacy markdown syntax (**bold**, *italic*) to visual HTML tags (<strong>, <em>, <u>)
 * and normalizes browser-generated tags (<b> -> <strong>, <i> -> <em>).
 */
export function normalizeRichTextHtml(input: string): string {
  if (!input) return '';

  let res = input;

  // Convert legacy markdown **bold** -> <strong>bold</strong>
  res = res.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert legacy markdown *italic* -> <em>italic</em> (without touching existing tags)
  res = res.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

  // Normalize <b> to <strong>, <i> to <em>
  res = res.replace(/<b(\s+[^>]*)?>/gi, '<strong>').replace(/<\/b>/gi, '</strong>');
  res = res.replace(/<i(\s+[^>]*)?>/gi, '<em>').replace(/<\/i>/gi, '</em>');

  // Clean empty formatting tags
  res = res
    .replace(/<strong>\s*<\/strong>/gi, '')
    .replace(/<em>\s*<\/em>/gi, '')
    .replace(/<u>\s*<\/u>/gi, '');

  return res;
}

/**
 * Strips all HTML tags and decodes entities to get plain text.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Converts rich HTML to standard Markdown formatting.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let res = html;
  res = res.replace(/<br\s*\/?>/gi, '\n');
  res = res.replace(/<strong(\s+[^>]*)?>(.*?)<\/strong>/gi, '**$2**');
  res = res.replace(/<b(\s+[^>]*)?>(.*?)<\/b>/gi, '**$2**');
  res = res.replace(/<em(\s+[^>]*)?>(.*?)<\/em>/gi, '*$2*');
  res = res.replace(/<i(\s+[^>]*)?>(.*?)<\/i>/gi, '*$2*');
  res = res.replace(/<u(\s+[^>]*)?>(.*?)<\/u>/gi, '<u>$2</u>');
  res = stripHtml(res);
  return res;
}

/**
 * Converts rich HTML to Fountain screenplay format.
 */
export function htmlToFountain(html: string): string {
  if (!html) return '';
  let res = html;
  res = res.replace(/<br\s*\/?>/gi, '\n');
  res = res.replace(/<strong(\s+[^>]*)?>(.*?)<\/strong>/gi, '**$2**');
  res = res.replace(/<b(\s+[^>]*)?>(.*?)<\/b>/gi, '**$2**');
  res = res.replace(/<em(\s+[^>]*)?>(.*?)<\/em>/gi, '*$2*');
  res = res.replace(/<i(\s+[^>]*)?>(.*?)<\/i>/gi, '*$2*');
  res = res.replace(/<u(\s+[^>]*)?>(.*?)<\/u>/gi, '_$2_');
  res = stripHtml(res);
  return res;
}

/**
 * Escapes XML text for Final Draft (FDX) export.
 */
export function htmlToFdxClean(html: string): string {
  const plain = stripHtml(html);
  return plain
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calculates the exact character offset within a contentEditable container.
 */
export function getCaretCharacterOffsetWithin(element: HTMLElement): number {
  let caretOffset = 0;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretOffset = preCaretRange.toString().length;
  }
  return caretOffset;
}

/**
 * Sets the caret position accurately at the given character offset in a contentEditable element.
 */
export function setCaretPosition(el: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  let currentOffset = 0;
  const result: { node: Node | null; offset: number } = { node: null, offset: 0 };

  function findTextNode(node: Node) {
    if (result.node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const textLen = (node.textContent || '').length;
      if (currentOffset + textLen >= offset) {
        result.node = node;
        result.offset = Math.max(0, offset - currentOffset);
        return;
      }
      currentOffset += textLen;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        findTextNode(node.childNodes[i]);
      }
    }
  }

  findTextNode(el);

  const range = document.createRange();
  if (result.node && result.node.textContent) {
    const maxLen = result.node.textContent.length;
    range.setStart(result.node, Math.min(result.offset, maxLen));
    range.collapse(true);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

export interface ActiveFormattingState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
}

/**
 * Queries active formatting state from browser selection.
 */
export function getActiveFormattingState(): ActiveFormattingState {
  if (typeof document === 'undefined') {
    return { bold: false, italic: false, underline: false, uppercase: false };
  }
  try {
    const bold = document.queryCommandState('bold');
    const italic = document.queryCommandState('italic');
    const underline = document.queryCommandState('underline');
    return {
      bold,
      italic,
      underline,
      uppercase: false,
    };
  } catch {
    return { bold: false, italic: false, underline: false, uppercase: false };
  }
}
