/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ProseDocument, ProseNode } from '../types';
import { generateId } from '../core/commands';
import { paginateProseDocument, ProsePage, wrapTextToLines, stripHtmlTags } from '../core/screenplay_layout';
import { ActiveFormattingState, getActiveFormattingState } from '../core/rich_text';
import { FileText, Type } from 'lucide-react';

interface ProseEditorProps {
  document: ProseDocument;
  onUpdateDocument: (doc: ProseDocument) => void;
}

interface ProseNodeItemProps {
  node: ProseNode;
  index: number;
  fontFamily: 'sans' | 'serif';
  styleConfig: { className: string; placeholder: string };
  registerTextareaRef: (nodeId: string, el: HTMLTextAreaElement | null) => void;
  adjustHeight: (el: HTMLTextAreaElement) => void;
  handleNodeTextChange: (nodeId: string, newText: string, offset?: number) => void;
  setCaretOffset: (offset: number) => void;
  setFocusedNodeId: (nodeId: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, node: ProseNode, index: number) => void;
  onToggleFormat: (format: 'bold' | 'italic' | 'underline') => void;
  activeFormatting?: { bold: boolean; italic: boolean; underline: boolean; uppercase?: boolean };
  onSelectionChange?: (nodeId: string, start: number, end: number) => void;
}

const ProseNodeItem: React.FC<ProseNodeItemProps> = React.memo(({
  node,
  index,
  fontFamily,
  styleConfig,
  registerTextareaRef,
  adjustHeight,
  handleNodeTextChange,
  setCaretOffset,
  setFocusedNodeId,
  handleKeyDown,
  onToggleFormat,
  activeFormatting,
  onSelectionChange,
}) => {
  const [showFloatingBar, setShowFloatingBar] = useState(false);

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (el.selectionStart !== el.selectionEnd) {
      setShowFloatingBar(true);
    } else {
      setShowFloatingBar(false);
    }
    setCaretOffset(el.selectionStart);
    onSelectionChange?.(node.id, el.selectionStart, el.selectionEnd);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowFloatingBar(false);
    }, 180);
  };

  return (
    <div className="relative group transition-[background-color,opacity,border-color,transform] duration-150 ease-out p-1 -m-1">
      {showFloatingBar && (
        <div 
          className="absolute -top-11 left-1/2 -translate-x-1/2 flex items-center bg-ink text-paper rounded-[var(--radius-modal)] shadow-2xl py-1.5 px-2 gap-1 z-40 select-none animate-in fade-in zoom-in-95 duration-200"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          <button
            type="button"
            onClick={() => onToggleFormat('bold')}
            className={`p-1 rounded-[var(--radius-ui)] font-bold text-xs w-7 h-7 flex items-center justify-center transition-colors cursor-pointer border-none ${
              activeFormatting?.bold ? 'bg-paper text-ink shadow-sm' : 'text-paper hover:bg-white/10'
            }`}
            title="Bold (Cmd+B)"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => onToggleFormat('italic')}
            className={`p-1 rounded-[var(--radius-ui)] italic text-xs w-7 h-7 flex items-center justify-center transition-colors cursor-pointer border-none ${
              activeFormatting?.italic ? 'bg-paper text-ink shadow-sm' : 'text-paper hover:bg-white/10'
            }`}
            title="Italic (Cmd+I)"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => onToggleFormat('underline')}
            className={`p-1 rounded-[var(--radius-ui)] underline text-xs w-7 h-7 flex items-center justify-center transition-colors cursor-pointer border-none ${
              activeFormatting?.underline ? 'bg-paper text-ink shadow-sm' : 'text-paper hover:bg-white/10'
            }`}
            title="Underline (Cmd+U)"
          >
            U
          </button>
        </div>
      )}

      <textarea
        ref={(el) => registerTextareaRef(node.id, el)}
        rows={1}
        value={node.text}
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck="true"
        onChange={(e) => {
          adjustHeight(e.target);
          handleNodeTextChange(node.id, e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => handleKeyDown(e, node, index)}
        onFocus={() => {
          setFocusedNodeId(node.id);
        }}
        onClick={(e) => {
          setFocusedNodeId(node.id);
          setCaretOffset(e.currentTarget.selectionStart);
        }}
        onSelect={handleSelect}
        onBlur={handleBlur}
        className={`${styleConfig.className} ${fontFamily === 'sans' ? 'font-sans' : 'font-serif'} placeholder:font-sans`}
        style={{
          resize: 'none',
        }}
      />
    </div>
  );
});

export const ProseEditor: React.FC<ProseEditorProps> = ({
  document,
  onUpdateDocument,
}) => {
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [caretOffset, setCaretOffset] = useState<number>(0);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif'>('sans');
  const [viewMode, setViewMode] = useState<'seamless' | 'page'>('seamless');

  // Combined text for stats
  const fullText = useMemo(() => {
    return document.nodes.map((n) => n.text).join('\n\n');
  }, [document.nodes]);

  const registerTextareaRef = (nodeId: string, el: HTMLTextAreaElement | null) => {
    if (el) {
      textareaRefs.current.set(nodeId, el);
    } else {
      textareaRefs.current.delete(nodeId);
    }
  };

  // Adjust height of a specific textarea
  const adjustHeight = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  // Keep heights sync'd on document layout changes
  useEffect(() => {
    textareaRefs.current.forEach((el) => {
      if (el) {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }
    });
  }, [document.nodes]);

  // Handle caret focus tracking
  useEffect(() => {
    if (focusedNodeId) {
      const textarea = textareaRefs.current.get(focusedNodeId);
      if (textarea) {
        const safeOffset = Math.min(caretOffset, textarea.value.length);
        if (window.document.activeElement !== textarea) {
          textarea.focus();
          textarea.setSelectionRange(safeOffset, safeOffset);
        } else {
          if (textarea.selectionStart === textarea.selectionEnd && textarea.selectionStart !== safeOffset) {
            textarea.setSelectionRange(safeOffset, safeOffset);
          }
        }
      }
    }
  }, [focusedNodeId, caretOffset]);

  /**
   * Automatically split and layout paragraphs as the user types
   * so they flow naturally onto the next page instead of growing infinitely.
   */
  const ensureProsePagination = (
    nodes: ProseNode[],
    activeNodeId: string,
    currentText: string,
    cursorOffset: number
  ) => {
    const maxLines = 28;
    const charsPerLine = 75;
    const resultNodes: ProseNode[] = [];
    let currentPageLines = 0;
    let nextNodeIdToFocus = activeNodeId;
    let nextOffsetToSet = cursorOffset;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const text = node.id === activeNodeId ? currentText : node.text;

      // Handle empty paragraphs
      if (text.trim() === '') {
        const needed = 1 + (currentPageLines > 0 ? 1 : 0);
        if (currentPageLines + needed <= maxLines || currentPageLines === 0) {
          currentPageLines += needed;
          resultNodes.push({ ...node, text: '' });
        } else {
          currentPageLines = 1;
          resultNodes.push({ ...node, text: '' });
        }
        continue;
      }

      // Split text by manual newlines
      const paragraphsText = text.split('\n');
      let lines: string[] = [];
      for (const para of paragraphsText) {
        lines = lines.concat(wrapTextToLines(para, charsPerLine));
      }

      const neededLines = lines.length + (currentPageLines > 0 ? 1 : 0);

      if (currentPageLines + neededLines <= maxLines || currentPageLines === 0) {
        currentPageLines += neededLines;
        resultNodes.push({ ...node, text });
      } else {
        // It overflows this physical sheet!
        const availableLines = maxLines - currentPageLines - (currentPageLines > 0 ? 1 : 0);

        if (availableLines > 0 && availableLines < lines.length) {
          // Split paragraph node at the physical page line boundary
          const firstPartLines = lines.slice(0, availableLines);
          const secondPartLines = lines.slice(availableLines);

          const firstPartText = firstPartLines.join(' ');
          const secondPartText = secondPartLines.join(' ');

          const splitNodeId = generateId('pr_node');
          resultNodes.push({ ...node, text: firstPartText });
          resultNodes.push({
            id: splitNodeId,
            type: 'paragraph',
            text: secondPartText,
          });

          // Move the cursor focus to the newly created page node if we split underneath it
          if (node.id === activeNodeId) {
            const firstPartLen = firstPartText.length;
            if (cursorOffset > firstPartLen) {
              nextNodeIdToFocus = splitNodeId;
              nextOffsetToSet = Math.max(0, cursorOffset - firstPartLen - 1);
            }
          }

          currentPageLines = secondPartLines.length;
        } else {
          // Push entire paragraph to the next page
          currentPageLines = lines.length;
          resultNodes.push({ ...node, text });
        }
      }
    }

    return {
      nodes: resultNodes,
      nextNodeIdToFocus,
      nextOffsetToSet,
    };
  };

  const handleNodeTextChange = (nodeId: string, newText: string, cursorOffset?: number) => {
    const originalNode = document.nodes.find((n) => n.id === nodeId);
    const originalText = originalNode ? originalNode.text : '';

    let formattedText = newText;
    // Auto-capitalize if text is added
    if (newText.length > originalText.length) {
      // 1. Capitalize first letter of entire block if it is lowercase
      formattedText = formattedText.replace(/^([a-z])/, (m) => m.toUpperCase());
      // 2. Capitalize first letter after period, question mark, exclamation mark followed by whitespace
      formattedText = formattedText.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
      // 3. Capitalize first letter after newlines
      formattedText = formattedText.replace(/(\n)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
      // 4. Capitalize standalone "i" pronoun and its common contractions (i'm, i've, i'd, i'll)
      formattedText = formattedText.replace(/(^|\s)i('(?:m|ve|d|ll))?(\s|[.,!?]|$)/gi, (match, p1, p2, p3) => {
        const contraction = p2 || '';
        return p1 + 'I' + contraction.toLowerCase() + p3;
      });
    }

    const updatedNodesRaw = document.nodes.map((node) => {
      if (node.id === nodeId) {
        return { ...node, text: formattedText };
      }
      return node;
    });

    // Run proactive pagination splitting
    const offset = cursorOffset !== undefined ? cursorOffset : caretOffset;
    const { nodes: updatedNodes, nextNodeIdToFocus, nextOffsetToSet } = ensureProsePagination(
      updatedNodesRaw,
      nodeId,
      formattedText,
      offset
    );

    onUpdateDocument({
      ...document,
      nodes: updatedNodes,
      version: document.version + 1,
      updatedAt: Date.now(),
    });

    setFocusedNodeId(nextNodeIdToFocus);
    setCaretOffset(nextNodeIdToFocus !== nodeId ? nextOffsetToSet : offset);
  };

  const handleContentChange = (fullNewText: string) => {
    const paragraphs = fullNewText.split(/\n\n+/);
    const newNodes = paragraphs.map((paraText, i) => {
      const existingNode = document.nodes[i];
      return {
        id: existingNode?.id || generateId('pr_node'),
        type: existingNode?.type || 'paragraph',
        text: paraText,
      };
    });

    onUpdateDocument({
      ...document,
      nodes: newNodes.length > 0 ? newNodes : [{ id: generateId('pr_node'), type: 'paragraph', text: '' }],
      version: document.version + 1,
      updatedAt: Date.now(),
    });
  };

  // Active formatting state synchronized between Top Toolbar & Floating Popovers
  const [activeFormatting, setActiveFormatting] = useState<ActiveFormattingState>({
    bold: false,
    italic: false,
    underline: false,
    uppercase: false,
  });

  const updateActiveFormatting = useCallback((nodeId: string, start?: number, end?: number) => {
    const targetNode = document.nodes.find((n) => n.id === nodeId);
    const textarea = textareaRefs.current.get(nodeId);
    if (!targetNode || !textarea) return;

    const sStart = start !== undefined ? start : textarea.selectionStart;
    const sEnd = end !== undefined ? end : textarea.selectionEnd;
    const text = targetNode.text;

    if (sStart !== undefined && sEnd !== undefined && sStart !== sEnd) {
      const sMin = Math.min(sStart, sEnd);
      const sMax = Math.max(sStart, sEnd);
      const sel = text.slice(sMin, sMax);
      const before = text.slice(0, sMin);
      const after = text.slice(sMax);

      const hasBold =
        (sel.startsWith('**') && sel.endsWith('**') && sel.length >= 4) ||
        (before.endsWith('**') && after.startsWith('**'));
      const hasItalic =
        (sel.startsWith('*') && sel.endsWith('*') && sel.length >= 2) ||
        (before.endsWith('*') && after.startsWith('*'));
      const hasUnderline =
        (sel.startsWith('<u>') && sel.endsWith('</u>') && sel.length >= 7) ||
        (before.endsWith('<u>') && after.startsWith('</u>'));

      setActiveFormatting({
        bold: Boolean(hasBold),
        italic: Boolean(hasItalic),
        underline: Boolean(hasUnderline),
        uppercase: false,
      });
    } else {
      setActiveFormatting({
        bold: false,
        italic: false,
        underline: false,
        uppercase: false,
      });
    }
  }, [document.nodes]);

  const handleSelectionChange = useCallback((nodeId: string, start: number, end: number) => {
    updateActiveFormatting(nodeId, start, end);
  }, [updateActiveFormatting]);

  // Inline formatting wrappers (Bold, Italic, Underline)
  const handleToggleFormat = useCallback((format: 'bold' | 'italic' | 'underline') => {
    if (!focusedNodeId) return;
    const el = textareaRefs.current.get(focusedNodeId);
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;

    if (start === end) {
      setActiveFormatting((prev) => ({ ...prev, [format]: !prev[format] }));
      return;
    }

    let prefix = '**';
    let suffix = '**';
    if (format === 'italic') {
      prefix = '*';
      suffix = '*';
    } else if (format === 'underline') {
      prefix = '<u>';
      suffix = '</u>';
    }

    const selectedText = val.slice(start, end);
    let newText = val;
    let newStart = start;
    let newEnd = end;

    // Check if selection is already wrapped in this formatting
    if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix) && selectedText.length >= prefix.length + suffix.length) {
      const unwrapped = selectedText.slice(prefix.length, selectedText.length - suffix.length);
      newText = val.slice(0, start) + unwrapped + val.slice(end);
      newEnd = start + unwrapped.length;
    } else if (
      val.slice(Math.max(0, start - prefix.length), start) === prefix &&
      val.slice(end, end + suffix.length) === suffix
    ) {
      newText = val.slice(0, start - prefix.length) + selectedText + val.slice(end + suffix.length);
      newStart = start - prefix.length;
      newEnd = newStart + selectedText.length;
    } else {
      const formatted = `${prefix}${selectedText}${suffix}`;
      newText = val.slice(0, start) + formatted + val.slice(end);
      newEnd = start + formatted.length;
    }

    handleNodeTextChange(focusedNodeId, newText, newEnd);
    setActiveFormatting((prev) => ({ ...prev, [format]: !prev[format] }));

    setTimeout(() => {
      const activeEl = textareaRefs.current.get(focusedNodeId);
      if (activeEl) {
        activeEl.focus();
        activeEl.setSelectionRange(newStart, newEnd);
      }
    }, 20);
  }, [focusedNodeId, handleNodeTextChange]);

  // Block level prefix formatting (Heading, Quote, List)
  const applyBlockFormat = (prefix: string) => {
    if (!focusedNodeId) return;
    const el = textareaRefs.current.get(focusedNodeId);
    if (!el) return;

    const val = el.value;
    const cleanLine = val.replace(/^([#>\-\d\.]+\s*)/, '');
    const newLine = `${prefix}${cleanLine}`;

    handleNodeTextChange(focusedNodeId, newLine, newLine.length);

    setTimeout(() => {
      const activeEl = textareaRefs.current.get(focusedNodeId);
      if (activeEl) {
        activeEl.focus();
        activeEl.setSelectionRange(
          prefix.length,
          newLine.length
        );
      }
    }, 20);
  };

  // Keyboard navigation & split/merge operations
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    node: ProseNode,
    index: number
  ) => {
    const el = e.currentTarget;
    const selectionStart = el.selectionStart;
    const selectionEnd = el.selectionEnd;
    const textLength = el.value.length;

    // Command shortcuts
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        handleToggleFormat('bold');
        return;
      } else if (k === 'i') {
        e.preventDefault();
        handleToggleFormat('italic');
        return;
      } else if (k === 'u' && !e.shiftKey) {
        e.preventDefault();
        handleToggleFormat('underline');
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Split current paragraph node
      const leftText = node.text.slice(0, selectionStart);
      const rightText = node.text.slice(selectionStart);
      const newNodeId = generateId('pr_node');

      let capitalizedRightText = rightText;
      capitalizedRightText = capitalizedRightText.replace(/^([a-z])/, (m) => m.toUpperCase());
      capitalizedRightText = capitalizedRightText.replace(/(^|\s)i('(?:m|ve|d|ll))?(\s|[.,!?]|$)/gi, (match, p1, p2, p3) => {
        const contraction = p2 || '';
        return p1 + 'I' + contraction.toLowerCase() + p3;
      });

      const updatedNodes = [...document.nodes];
      updatedNodes[index] = { ...node, text: leftText };
      updatedNodes.splice(index + 1, 0, {
        id: newNodeId,
        type: 'paragraph',
        text: capitalizedRightText,
      });

      onUpdateDocument({
        ...document,
        nodes: updatedNodes,
        version: document.version + 1,
        updatedAt: Date.now(),
      });

      setFocusedNodeId(newNodeId);
      setCaretOffset(0);
      return;
    }

    if (e.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0) {
      if (index > 0) {
        e.preventDefault();
        // Merge with previous paragraph node
        const prevNode = document.nodes[index - 1];
        const prevTextLength = prevNode.text.length;
        const mergedText = prevNode.text + node.text;

        const updatedNodes = [...document.nodes];
        updatedNodes[index - 1] = { ...prevNode, text: mergedText };
        updatedNodes.splice(index, 1);

        onUpdateDocument({
          ...document,
          nodes: updatedNodes,
          version: document.version + 1,
          updatedAt: Date.now(),
        });

        setFocusedNodeId(prevNode.id);
        setCaretOffset(prevTextLength);
        return;
      }
    }

    // Caret Navigation between blocks
    if (e.key === 'ArrowUp' && selectionStart === 0 && selectionEnd === 0 && index > 0) {
      e.preventDefault();
      const prevNode = document.nodes[index - 1];
      setFocusedNodeId(prevNode.id);
      setCaretOffset(prevNode.text.length);
    } else if (
      e.key === 'ArrowDown' &&
      selectionStart === textLength &&
      selectionEnd === textLength &&
      index < document.nodes.length - 1
    ) {
      e.preventDefault();
      const nextNode = document.nodes[index + 1];
      setFocusedNodeId(nextNode.id);
      setCaretOffset(0);
    }
  };

  const getParagraphStyles = (text: string) => {
    if (text.startsWith('# ')) {
      return {
        className: 'text-2xl font-bold text-ink mt-8 mb-4 tracking-tight block w-full bg-transparent border-none outline-none resize-none p-0 focus:ring-0 placeholder:text-graphite/30',
        placeholder: 'Chapter Title...',
      };
    }
    if (text.startsWith('## ')) {
      return {
        className: 'text-xl font-bold text-ink mt-6 mb-3 tracking-tight block w-full bg-transparent border-none outline-none resize-none p-0 focus:ring-0 placeholder:text-graphite/30',
        placeholder: 'Heading 2...',
      };
    }
    if (text.startsWith('### ')) {
      return {
        className: 'text-lg font-bold text-ink mt-4 mb-2 block w-full bg-transparent border-none outline-none resize-none p-0 focus:ring-0 placeholder:text-graphite/30',
        placeholder: 'Heading 3...',
      };
    }
    if (text.startsWith('> ')) {
      return {
        className: 'pl-4 border-l-2 border-editor-red italic text-graphite bg-neutral-100/30 py-2 block w-full outline-none resize-none p-0 focus:ring-0 placeholder:text-graphite/30',
        placeholder: 'Blockquote...',
      };
    }
    if (text.startsWith('- ') || text.startsWith('* ')) {
      return {
        className: 'pl-2 text-ink list-item list-disc ml-6 block w-full bg-transparent border-none outline-none resize-none p-0 focus:ring-0 placeholder:text-graphite/30',
        placeholder: 'List item...',
      };
    }
    if (/^\d+\.\s/.test(text)) {
      return {
        className: 'pl-2 text-ink list-item list-decimal ml-6 block w-full bg-transparent border-none outline-none resize-none p-0 focus:ring-0 placeholder:text-graphite/30',
        placeholder: 'List item...',
      };
    }
    // Standard paragraph
    return {
      className: 'text-ink leading-[1.8] text-[17px] tracking-normal mb-6 block w-full bg-transparent border-none outline-none resize-none p-0 focus:ring-0 placeholder:text-graphite/30',
      placeholder: 'Type a paragraph...',
    };
  };

  const wordCount = useMemo(() => {
    return fullText
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [fullText]);

  // Derive pages mapping using dynamic line layout
  const pages = useMemo(() => {
    return paginateProseDocument(document.nodes);
  }, [document.nodes]);

  const pageBreakMap = useMemo(() => {
    const map = new Map<number, ProsePage>();
    pages.forEach((page) => {
      if (page.pageNumber > 1) {
        map.set(page.startsAtNodeIndex, page);
      }
    });
    return map;
  }, [pages]);

  const currentCaretPage = useMemo(() => {
    if (!focusedNodeId) return 1;
    const activeIndex = document.nodes.findIndex((n) => n.id === focusedNodeId);
    if (activeIndex === -1) return 1;
    const matchedPage = pages.find(
      (p) => activeIndex >= p.startsAtNodeIndex && activeIndex <= p.endsAtNodeIndex
    );
    return matchedPage ? matchedPage.pageNumber : 1;
  }, [focusedNodeId, document.nodes, pages]);

  const focusedNode = document.nodes.find((n) => n.id === focusedNodeId);
  const currentBlockType = useMemo(() => {
    if (!focusedNode) return 'p';
    const text = focusedNode.text;
    if (text.startsWith('# ')) return 'h1';
    if (text.startsWith('## ')) return 'h2';
    if (text.startsWith('### ')) return 'h3';
    if (text.startsWith('> ')) return 'quote';
    if (text.startsWith('- ') || text.startsWith('* ')) return 'bullet';
    if (/^\d+\.\s/.test(text)) return 'number';
    return 'p';
  }, [focusedNode]);

  return (
    <div className="flex-1 flex flex-col h-full bg-paper overflow-hidden">
      {/* Prose Formatting Toolbar */}
      <div className="h-12 bg-paper border-b border-rule px-4 flex items-center justify-between text-xs shrink-0 z-10 select-none">
        <div className="flex items-center gap-2">
          {/* Block Type Dropdown Selector */}
          <select
            value={currentBlockType}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'h1') applyBlockFormat('# ');
              else if (val === 'h2') applyBlockFormat('## ');
              else if (val === 'h3') applyBlockFormat('### ');
              else if (val === 'quote') applyBlockFormat('> ');
              else if (val === 'bullet') applyBlockFormat('- ');
              else if (val === 'number') applyBlockFormat('1. ');
              else if (val === 'p') applyBlockFormat('');
            }}
            className="text-[11px] font-bold bg-paper hover:bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] px-3 py-1 text-ink outline-none cursor-pointer transition-colors uppercase tracking-wider"
          >
            <option value="p">Paragraph</option>
            <option value="h1">Chapter Heading</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="quote">Quote</option>
            <option value="bullet">Bullet List</option>
            <option value="number">Numbered List</option>
          </select>

          <div className="h-4 w-px bg-rule mx-2" />

          {/* Typography Font Switcher */}
          <div className="flex items-center rounded-[var(--radius-ui)] bg-neutral-100/50 p-0.5 border border-rule text-[11px]">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setFontFamily('sans')}
              className={`px-3 py-1 rounded-[var(--radius-ui)] font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                fontFamily === 'sans'
                  ? 'bg-paper text-ink shadow-sm'
                  : 'text-graphite hover:text-ink'
              }`}
              title="Sans-Serif Font Family"
            >
              <Type className="w-3.5 h-3.5 opacity-60" />
              <span>SANS</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setFontFamily('serif')}
              className={`px-3 py-1 rounded-[var(--radius-ui)] font-bold cursor-pointer transition-all font-serif flex items-center gap-1.5 ${
                fontFamily === 'serif'
                  ? 'bg-paper text-ink shadow-sm'
                  : 'text-graphite hover:text-ink'
              }`}
              title="Serif Font Family"
            >
              <Type className="w-3.5 h-3.5 opacity-60" />
              <span>SERIF</span>
            </button>
          </div>

          <div className="h-4 w-px bg-rule mx-2" />

          {/* View Mode Switcher */}
          <div className="flex items-center rounded-[var(--radius-ui)] bg-neutral-100/50 p-0.5 border border-rule text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('seamless')}
              className={`px-3 py-1 rounded-[var(--radius-ui)] font-bold transition-all cursor-pointer ${
                viewMode === 'seamless'
                  ? 'bg-paper text-ink shadow-sm'
                  : 'text-graphite hover:text-ink'
              }`}
              title="Seamless Continuous Canvas"
            >
              SEAMLESS
            </button>
            <button
              type="button"
              onClick={() => setViewMode('page')}
              className={`px-3 py-1 rounded-[var(--radius-ui)] font-bold transition-all cursor-pointer ${
                viewMode === 'page'
                  ? 'bg-paper text-ink shadow-sm'
                  : 'text-graphite hover:text-ink'
              }`}
              title="Physical Page View"
            >
              PAGES
            </button>
          </div>
        </div>

        {/* Right Toolbar: Actions & Word Count */}
        <div className="flex items-center gap-6">
          {isConfirmingClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-editor-red font-bold uppercase tracking-widest">Clear manuscript?</span>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  handleContentChange('');
                  setIsConfirmingClear(false);
                }}
                className="text-[10px] bg-editor-red hover:bg-ink text-paper font-bold px-2 py-0.5 rounded-[var(--radius-ui)] cursor-pointer shadow-sm transition-colors border-none"
              >
                CLEAR
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsConfirmingClear(false)}
                className="text-[10px] text-graphite hover:text-ink px-1 py-0.5 rounded cursor-pointer border-none bg-transparent font-bold"
              >
                CANCEL
              </button>
            </div>
          ) : (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsConfirmingClear(true)}
              className="text-[10px] text-graphite hover:text-editor-red cursor-pointer font-bold uppercase tracking-widest transition-colors border-none bg-transparent"
              title="Clear manuscript content"
            >
              Clear Text
            </button>
          )}
          <span className="text-[11px] text-ink font-bold tracking-widest opacity-40 uppercase">
            {wordCount} {wordCount === 1 ? 'WORD' : 'WORDS'}
          </span>
        </div>
      </div>

      {/* Switchable Manuscript Canvas (Seamless / Page View) */}
      {viewMode === 'seamless' ? (
        <div 
          className="flex-1 overflow-y-auto px-6 py-12 md:px-12 md:py-20 flex flex-col items-center cursor-text bg-white"
          onClick={() => {
            if (document.nodes.length > 0) {
              const lastNode = document.nodes[document.nodes.length - 1];
              setFocusedNodeId(lastNode.id);
              setCaretOffset(lastNode.text.length);
            }
          }}
        >
          <div 
            id="prose-page-marker-1"
            className="w-full max-w-[800px] flex flex-col transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {document.nodes.map((node, index) => {
              const styleConfig = getParagraphStyles(node.text);
              const isPageBreak = pageBreakMap.has(index);
              const breakPage = pageBreakMap.get(index);

              return (
                <React.Fragment key={node.id}>
                  {isPageBreak && breakPage && (
                    <div 
                      id={`prose-page-marker-${breakPage.pageNumber}`}
                      className="w-full my-12 flex items-center gap-6 select-none pointer-events-none transition-all"
                    >
                      <div className="h-px flex-1 border-t border-dashed border-rule" />
                      <span className="text-[10px] font-bold text-graphite opacity-40 uppercase tracking-[0.2em] bg-white px-3">
                        PAGE {breakPage.pageNumber}
                      </span>
                      <div className="h-px flex-1 border-t border-dashed border-rule" />
                    </div>
                  )}
                  <ProseNodeItem
                    node={node}
                    index={index}
                    fontFamily={fontFamily}
                    styleConfig={styleConfig}
                    registerTextareaRef={registerTextareaRef}
                    adjustHeight={adjustHeight}
                    handleNodeTextChange={handleNodeTextChange}
                    setCaretOffset={setCaretOffset}
                    setFocusedNodeId={setFocusedNodeId}
                    handleKeyDown={handleKeyDown}
                    onToggleFormat={handleToggleFormat}
                    activeFormatting={activeFormatting}
                    onSelectionChange={handleSelectionChange}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : (
        <div 
          className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center cursor-text bg-[#FAF9F6]"
          onClick={() => {
            if (document.nodes.length > 0) {
              const lastNode = document.nodes[document.nodes.length - 1];
              setFocusedNodeId(lastNode.id);
              setCaretOffset(lastNode.text.length);
            }
          }}
        >
          <div className="flex flex-col items-center w-full" onClick={(e) => e.stopPropagation()}>
            {pages.map((page) => (
              <div
                id={`prose-page-marker-${page.pageNumber}`}
                key={page.pageNumber}
                className="bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-rule relative text-ink transition-all mb-12 shrink-0 select-text"
                style={{
                  width: '8.5in',
                  minHeight: '11in',
                  paddingTop: '1in',
                  paddingRight: '1.2in',
                  paddingBottom: '1in',
                  paddingLeft: '1.2in',
                  boxSizing: 'border-box',
                }}
              >
                {/* Top Right Page Number Header */}
                <div 
                  className="absolute select-none pointer-events-none text-graphite opacity-40 font-bold text-[11px] tracking-widest"
                  style={{ top: '0.5in', right: '1.2in' }}
                >
                  {page.pageNumber}
                </div>

                {/* Node item textareas belonging to this page */}
                <div className="flex flex-col h-full justify-start w-full gap-4">
                  {document.nodes
                    .slice(page.startsAtNodeIndex, page.endsAtNodeIndex + 1)
                    .map((node, offsetIndex) => {
                      const absoluteIndex = page.startsAtNodeIndex + offsetIndex;
                      const styleConfig = getParagraphStyles(node.text);
                      return (
                        <ProseNodeItem
                          key={node.id}
                          node={node}
                          index={absoluteIndex}
                          fontFamily={fontFamily}
                          styleConfig={styleConfig}
                          registerTextareaRef={registerTextareaRef}
                          adjustHeight={adjustHeight}
                          handleNodeTextChange={handleNodeTextChange}
                          setCaretOffset={setCaretOffset}
                          setFocusedNodeId={setFocusedNodeId}
                          handleKeyDown={handleKeyDown}
                          onToggleFormat={handleToggleFormat}
                          activeFormatting={activeFormatting}
                          onSelectionChange={handleSelectionChange}
                        />
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
