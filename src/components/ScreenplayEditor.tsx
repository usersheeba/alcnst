/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  ScreenplayDocument,
  ScreenplayNode,
  ScreenplayNodeType,
  CaretPosition,
  EditorCommand,
  DocumentFormattingSettings,
} from '../types';
import {
  SCREENPLAY_NODE_TYPES,
  getNextNodeTypeOnTab,
  getPreviousNodeTypeOnTab,
} from '../core/schema';
import { ALT_KEY_TYPE_MAP } from '../core/interaction_matrix';
import {
  PageFormat,
  PAGE_GEOMETRIES,
  ELEMENT_SPECS,
  collapseMargins,
  paginateScreenplayDocument,
  LINE_HEIGHT_PT,
  FONT_SIZE_PT,
  ScreenplayPage,
} from '../core/screenplay_layout';
import {
  ActiveFormattingState,
  getActiveFormattingState,
  normalizeRichTextHtml,
  stripHtml,
} from '../core/rich_text';
import {
  ChevronDown,
  FileText,
  Image,
  Footprints,
  User,
  MessageSquare,
  Camera,
  ArrowRightLeft,
  StickyNote,
} from 'lucide-react';

interface ScreenplayEditorProps {
  document: ScreenplayDocument;
  caret: CaretPosition | null;
  formattingSettings?: DocumentFormattingSettings;
  onOpenSettings?: (tab?: 'elements' | 'typography' | 'titlePage' | 'geometry' | 'production') => void;
  onDispatchCommand: (command: EditorCommand) => void;
  onCaretChange: (caret: CaretPosition | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  viewMode?: 'seamless' | 'page';
  onViewModeChange?: (mode: 'seamless' | 'page') => void;
}

const ELEMENT_LABELS: Record<ScreenplayNodeType, { label: string; shortcut: string }> = {
  sceneHeading: { label: 'Scene Heading', shortcut: 'Alt+1' },
  action: { label: 'Action', shortcut: 'Alt+2' },
  character: { label: 'Character', shortcut: 'Alt+3' },
  parenthetical: { label: 'Parenthetical', shortcut: 'Alt+4' },
  dialogue: { label: 'Dialogue', shortcut: 'Alt+5' },
  transition: { label: 'Transition', shortcut: 'Alt+6' },
  shot: { label: 'Shot', shortcut: 'Alt+7' },
  textNote: { label: 'Note', shortcut: 'Alt+8' },
  newAct: { label: 'New Act', shortcut: '' },
  endOfAct: { label: 'End of Act', shortcut: '' },
  outline: { label: 'Outline', shortcut: '' },
};

// Helper to adjust textarea height smoothly based on content pitch
const adjustHeight = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  const lines = Math.max(1, Math.round(el.scrollHeight / 16));
  el.style.height = `${lines * 16}px`;
};

// Helpers for parenthetical node caret position conversion
// Visible text for parenthetical is `(${storedText})`.
const toStoredPos = (visiblePos: number, textLength: number): number => {
  return Math.max(0, Math.min(visiblePos - 1, textLength));
};

const toVisiblePos = (storedPos: number): number => {
  return storedPos + 1;
};

const CHARACTER_EXTENSION_PRESETS = ['(V.O.)', '(O.S.)', '(O.C.)', "(CONT'D)", '(PRE-LAP)', '(FILTERED)', '(ON PHONE)', '(MUMBLED)'];
const TRANSITION_PRESETS = ['CUT TO:', 'FADE IN:', 'FADE OUT:', 'FADE TO BLACK.', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:', 'INTERCUT WITH:', 'FLASHCUT TO:'];
const SCENE_MODIFIER_PRESETS = ['DAY', 'NIGHT', 'CONTINUOUS', 'SAME', 'MOMENTS LATER', 'LATER', 'MORNING', 'EVENING', 'DAWN', 'DUSK', 'NIGHT - CONTINUOUS'];

interface ScreenplayNodeItemProps {
  node: ScreenplayNode;
  index: number;
  prevNodeType: ScreenplayNodeType | null;
  sceneNumber?: number;
  geom: typeof PAGE_GEOMETRIES['US_LETTER'];
  formattingSettings?: DocumentFormattingSettings;
  onTextChange: (nodeId: string, newText: string, cursorOffset: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, node: ScreenplayNode, index: number) => void;
  onCaretSelect: (nodeId: string, offset: number) => void;
  registerTextareaRef: (nodeId: string, el: HTMLTextAreaElement | null) => void;
  characterSuggestions: string[];
  sceneHeadingSuggestions: string[];
}

const getScreenplayPlaceholderIcon = (type: string) => {
  switch (type) {
    case 'sceneHeading':
      return <Image className="w-3.5 h-3.5 text-neutral-400" />;
    case 'action':
      return <Footprints className="w-3.5 h-3.5 text-neutral-400" />;
    case 'character':
      return <User className="w-3.5 h-3.5 text-neutral-400" />;
    case 'dialogue':
      return <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />;
    case 'parenthetical':
      return <MessageSquare className="w-3.5 h-3.5 text-neutral-400 opacity-80" />;
    case 'shot':
      return <Camera className="w-3.5 h-3.5 text-neutral-400" />;
    case 'transition':
      return <ArrowRightLeft className="w-3.5 h-3.5 text-neutral-400" />;
    case 'textNote':
      return <StickyNote className="w-3.5 h-3.5 text-neutral-400" />;
    case 'newAct':
    case 'endOfAct':
      return <FileText className="w-3.5 h-3.5 text-neutral-400" />;
    case 'outline':
      return <FileText className="w-3.5 h-3.5 text-purple-500" />;
    default:
      return null;
  }
};

// Memoized Individual Node Component to prevent re-rendering untouched nodes on every keystroke
const ScreenplayNodeItem = React.memo<ScreenplayNodeItemProps & { isProgrammaticFocusRef?: React.RefObject<boolean> }>(({
  node,
  index,
  prevNodeType,
  sceneNumber,
  geom,
  formattingSettings,
  onTextChange,
  onKeyDown,
  onCaretSelect,
  registerTextareaRef,
  characterSuggestions,
  sceneHeadingSuggestions,
  isProgrammaticFocusRef,
}) => {
  const spec = ELEMENT_SPECS[node.type] || ELEMENT_SPECS.action;
  const collapsedMarginLines = collapseMargins(prevNodeType, node.type);

  const leftIndentIn = spec.leftIn - geom.marginLeftIn;
  const rightIndentIn = spec.rightIn - geom.marginRightIn;

  const showSceneNumbers =
    formattingSettings?.showSceneNumbers !== false &&
    formattingSettings?.sceneNumberPosition !== 'none';
  const scenePos = formattingSettings?.sceneNumberPosition || 'both';

  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const autocompleteSuggestions = useMemo(() => {
    if (!isFocused) return [];
    const typed = node.text.trim().toUpperCase();

    if (node.type === 'character') {
      // Check if user is typing an extension with '('
      if (node.text.includes('(')) {
        const lastParenIdx = node.text.lastIndexOf('(');
        const baseChar = node.text.slice(0, lastParenIdx).trim().toUpperCase();
        const extQuery = node.text.slice(lastParenIdx + 1).toUpperCase().replace(/\)/g, '').trim();

        const matchingPresets = CHARACTER_EXTENSION_PRESETS.filter((p) => {
          const inner = p.replace(/[()]/g, '');
          return !extQuery || inner.startsWith(extQuery);
        });

        return matchingPresets.map((p) => (baseChar ? `${baseChar} ${p}` : p));
      }

      if (!typed) {
        return characterSuggestions.slice(0, 5);
      }
      return characterSuggestions.filter((item) => item.startsWith(typed) && item !== typed).slice(0, 5);
    }

    if (node.type === 'sceneHeading') {
      // Scene Heading autocompletion (prefixes or scene time modifiers)
      if (typed.includes(' - ') || typed.includes('-')) {
        const parts = typed.split(/-+/);
        const baseScene = parts[0].trim();
        const modQuery = parts[parts.length - 1].trim();

        const matchingMods = SCENE_MODIFIER_PRESETS.filter((m) =>
          !modQuery || m.startsWith(modQuery)
        );
        return matchingMods.map((m) => `${baseScene} - ${m}`);
      }

      if (!typed) {
        const defaultHeadings = ['INT.', 'EXT.', 'INT./EXT.', 'I/E.'];
        return defaultHeadings;
      }
      return sceneHeadingSuggestions.filter((item) => item.startsWith(typed) && item !== typed).slice(0, 5);
    }

    if (node.type === 'transition') {
      if (!typed) {
        return TRANSITION_PRESETS;
      }
      return TRANSITION_PRESETS.filter((t) => t.startsWith(typed) && t !== typed);
    }

    return [];
  }, [node.type, node.text, isFocused, characterSuggestions, sceneHeadingSuggestions]);

  const handleApplyExtension = (ext: string) => {
    let base = node.text.trim();
    if (/\s*\([^)]*\)$/.test(base)) {
      base = base.replace(/\s*\([^)]*\)$/, '').trim();
    }
    const newText = base ? `${base} ${ext}` : ext;
    onTextChange(node.id, newText, newText.length);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onTextChange(node.id, suggestion, suggestion.length);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsFocused(false);
    }, 180);
  };

  return (
    <React.Fragment>
      <div
        className="relative group transition-[background-color,opacity,border-color,transform] duration-150 ease-out p-1 -m-1"
        style={{
          marginLeft: `${leftIndentIn}in`,
          marginRight: `${rightIndentIn}in`,
          marginTop: `${index === 0 ? 0 : collapsedMarginLines * LINE_HEIGHT_PT}pt`,
          marginBottom: '0pt',
          textAlign: spec.align,
        }}
      >
        {/* Floating Element Type Indicator (Pencil mark style) */}
        {isFocused && (
          <div className="absolute top-1/2 -translate-y-1/2 -left-12 flex flex-col items-end gap-1 opacity-100 transition-opacity select-none z-30">
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 opacity-80">
              {ELEMENT_LABELS[node.type]?.label?.slice(0, 3) || 'ACT'}
            </span>
          </div>
        )}

        {/* Character Quick Extensions Pill Bar */}
        {node.type === 'character' && isFocused && (
          <div 
            className="absolute -top-7 right-0 flex items-center gap-1 bg-paper border border-rule rounded-[var(--radius-ui)] px-1.5 py-0.5 shadow-xl z-30 select-none animate-in fade-in duration-150"
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="text-[10px] font-bold text-graphite opacity-40 uppercase tracking-widest px-0.5">EXT</span>
            {CHARACTER_EXTENSION_PRESETS.slice(0, 6).map((ext) => (
              <button
                key={ext}
                type="button"
                onClick={() => handleApplyExtension(ext)}
                className="px-1.5 py-0.5 text-[11px] font-mono font-bold rounded-[var(--radius-ui)] hover:bg-ink hover:text-paper text-ink transition-colors cursor-pointer"
                title={`Append ${ext}`}
              >
                {ext}
              </button>
            ))}
          </div>
        )}

        {/* Dynamic Scene Number badges in margins if scene heading and enabled */}
        {node.type === 'sceneHeading' && showSceneNumbers && sceneNumber !== undefined && (
          <>
            {(scenePos === 'left' || scenePos === 'both') && (
              <span
                className="absolute select-none font-bold text-graphite opacity-40"
                style={{
                  left: '-0.6in',
                  top: '4px',
                  fontFamily: '"Courier Prime", monospace',
                  fontSize: `${FONT_SIZE_PT}pt`,
                  lineHeight: `${LINE_HEIGHT_PT}pt`,
                }}
              >
                {sceneNumber}
              </span>
            )}
            {(scenePos === 'right' || scenePos === 'both') && (
              <span
                className="absolute select-none font-bold text-graphite opacity-40"
                style={{
                  right: '-0.6in',
                  top: '4px',
                  fontFamily: '"Courier Prime", monospace',
                  fontSize: `${FONT_SIZE_PT}pt`,
                  lineHeight: `${LINE_HEIGHT_PT}pt`,
                }}
              >
                {sceneNumber}
              </span>
            )}
          </>
        )}

        {/* Visual Icon Placeholder when node.text is empty */}
        {!node.text && node.type !== 'parenthetical' && (
          <div 
            className="absolute inset-x-0 top-1 select-none pointer-events-none opacity-20 flex items-center text-ink"
            style={{
              justifyContent: spec.align === 'right' ? 'flex-end' : 'flex-start',
              height: `${LINE_HEIGHT_PT}pt`,
              paddingLeft: spec.align === 'right' ? '0' : '4px',
              paddingRight: spec.align === 'right' ? '4px' : '0',
            }}
          >
            {getScreenplayPlaceholderIcon(node.type)}
          </div>
        )}

        {(() => {
          const elemStyle =
            formattingSettings?.elementStyles?.[
              node.type as keyof typeof formattingSettings.elementStyles
            ];

          const fontFamilyStr =
            elemStyle?.fontFamily
              ? elemStyle.fontFamily
              : node.type === 'outline'
              ? 'Arial, sans-serif'
              : formattingSettings?.fontFamily === 'courier_new'
              ? '"Courier New", Courier, monospace'
              : formattingSettings?.fontFamily === 'pt_mono'
              ? '"PT Mono", monospace'
              : formattingSettings?.fontFamily === 'times'
              ? '"Times New Roman", Times, serif'
              : formattingSettings?.fontFamily === 'georgia'
              ? 'Georgia, serif'
              : 'var(--screenplay-font, "Courier Prime", "Courier New", Courier, monospace)';

          const textColorStr = elemStyle?.color
            ? elemStyle.color
            : node.type === 'outline'
            ? 'var(--outline-color, #8b5cf6)'
            : 'var(--ink)';

          return (
            <div className="relative w-full">
              <textarea
                rows={1}
                className="screenplay-editor-textarea"
                value={node.type === 'parenthetical' ? `(${node.text.replace(/^\(|\)$/g, '')})` : node.text}
                onChange={(e) => {
                  adjustHeight(e.target);
                  let val = e.target.value;
                  if (node.type === 'parenthetical') {
                    if (val.startsWith('(') && val.endsWith(')')) {
                      val = val.slice(1, -1);
                    } else if (val.startsWith('(')) {
                      val = val.slice(1);
                    } else if (val.endsWith(')')) {
                      val = val.slice(0, -1);
                    }
                  }
                  const pos = node.type === 'parenthetical' ? toStoredPos(e.target.selectionStart, val.length) : e.target.selectionStart;
                  onTextChange(node.id, val, pos);
                }}
                onKeyDown={(e) => {
                  if (autocompleteSuggestions.length > 0 && e.key === 'Tab') {
                    e.preventDefault();
                    handleSelectSuggestion(autocompleteSuggestions[0]);
                    return;
                  }
                  onKeyDown(e, node, index);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const pos = node.type === 'parenthetical' ? toStoredPos(e.currentTarget.selectionStart, node.text.length) : e.currentTarget.selectionStart;
                  onCaretSelect(node.id, pos);
                }}
                onSelect={(e) => {
                  const el = e.currentTarget;
                  const pos = node.type === 'parenthetical' ? toStoredPos(el.selectionStart, node.text.length) : el.selectionStart;
                  onCaretSelect(node.id, pos);
                }}
                onFocus={(e) => {
                  setIsFocused(true);
                  if (!isProgrammaticFocusRef?.current) {
                    const targetStart = e.currentTarget.selectionStart;
                    const pos = node.type === 'parenthetical' ? toStoredPos(targetStart, node.text.length) : targetStart;
                    onCaretSelect(node.id, pos);
                  }
                }}
                onBlur={handleBlur}
                style={{
                  fontFamily: fontFamilyStr,
                  fontSize: `${FONT_SIZE_PT}pt`,
                  lineHeight: `${LINE_HEIGHT_PT}pt`,
                  letterSpacing: '0px',
                  wordSpacing: '0px',
                  fontVariantLigatures: 'none',
                  textRendering: 'geometricPrecision',
                  textAlign: spec.align,
                  textTransform: (() => {
                    if (elemStyle !== undefined) {
                      return elemStyle.uppercase ? 'uppercase' : 'none';
                    }
                    return spec.uppercase ? 'uppercase' : 'none';
                  })(),
                  fontStyle: (() => {
                    if (elemStyle !== undefined) {
                      return elemStyle.fontStyle;
                    }
                    return 'normal';
                  })(),
                  fontWeight: (() => {
                    if (elemStyle !== undefined) {
                      return elemStyle.fontWeight;
                    }
                    if (node.type === 'character' || node.type === 'outline') return 'bold';
                    if (node.type === 'sceneHeading') {
                      return formattingSettings?.sceneHeadingStyle === 'bold' ||
                        formattingSettings?.sceneHeadingStyle === 'boldUnderline'
                        ? 'bold'
                        : 'normal';
                    }
                    return 'normal';
                  })(),
                  textDecoration: (() => {
                    if (elemStyle !== undefined) {
                      return elemStyle.textDecoration;
                    }
                    if (
                      node.type === 'sceneHeading' &&
                      (formattingSettings?.sceneHeadingStyle === 'underline' ||
                        formattingSettings?.sceneHeadingStyle === 'boldUnderline')
                    ) {
                      return 'underline';
                    }
                    return 'none';
                  })(),
                  color: textColorStr,
                  resize: 'none',
                  overflow: 'hidden',
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: node.type === 'parenthetical' ? '1.5ch' : 0,
                  paddingRight: node.type === 'parenthetical' ? '1.5ch' : 0,
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  display: 'block',
                  boxSizing: 'border-box',
                  background: 'transparent',
                }}
                ref={(el) => {
                  textareaRef.current = el;
                  registerTextareaRef(node.id, el);
                }}
              />

              {autocompleteSuggestions.length > 0 && (
                <div 
                  className="absolute left-0 mt-1.5 bg-paper border border-rule rounded-[var(--radius-modal)] shadow-2xl z-50 overflow-hidden divide-y divide-rule max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200"
                  style={{
                    top: '100%',
                    minWidth: '240px',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                >
                  {autocompleteSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-graphite hover:text-ink hover:bg-neutral-100/50 font-mono flex items-center justify-between cursor-pointer border-none bg-transparent transition-colors"
                    >
                      <span>{suggestion}</span>
                      <span className="text-[10px] bg-neutral-200/50 text-graphite opacity-60 px-1.5 py-0.5 rounded font-sans uppercase tracking-widest font-bold">
                        TAB
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </React.Fragment>
  );
});

export const ScreenplayEditor: React.FC<ScreenplayEditorProps> = ({
  document,
  caret,
  formattingSettings,
  onOpenSettings,
  onDispatchCommand,
  onCaretChange,
  onUndo,
  onRedo,
  viewMode = 'seamless',
  onViewModeChange,
}) => {
  // Physical Page Format state
  const [pageFormat, setPageFormat] = useState<PageFormat>(
    formattingSettings?.paperFormat || 'US_LETTER'
  );

  useEffect(() => {
    if (formattingSettings?.paperFormat && formattingSettings.paperFormat !== pageFormat) {
      setPageFormat(formattingSettings.paperFormat);
    }
  }, [formattingSettings?.paperFormat]);

  // Canvas Zoom state (50% to 200%)
  const [zoom, setZoom] = useState<number>(100);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Non-passive wheel event listener for Ctrl/Cmd + Mouse Wheel zooming
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const step = 5;
        const direction = e.deltaY < 0 ? 1 : -1;
        setZoom((prev) => Math.min(200, Math.max(50, Math.round((prev + direction * step) / 5) * 5)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Element menu dropdown state
  const [isElementMenuOpen, setIsElementMenuOpen] = useState(false);
  const elementMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (elementMenuRef.current && !elementMenuRef.current.contains(e.target as Node)) {
        setIsElementMenuOpen(false);
      }
    };
    if (isElementMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isElementMenuOpen]);

  // Map of textarea DOM refs
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const isTypingRef = useRef<boolean>(false);
  const isProgrammaticFocusRef = useRef<boolean>(false);

  // Active node under caret
  const activeNodeIndex = caret
    ? document.nodes.findIndex((n) => n.id === caret.nodeId)
    : 0;
  const activeNode: ScreenplayNode =
    document.nodes[activeNodeIndex >= 0 ? activeNodeIndex : 0] || document.nodes[0];

  // Active geometry and deterministic pagination
  const geom = PAGE_GEOMETRIES[pageFormat];
  const pages = useMemo(
    () =>
      paginateScreenplayDocument(document.nodes, pageFormat, formattingSettings),
    [document.nodes, pageFormat, formattingSettings]
  );

  const characterSuggestions = useMemo(() => {
    const set = new Set<string>();
    if (formattingSettings?.customCharacters) {
      formattingSettings.customCharacters.forEach((c) => set.add(c.trim().toUpperCase()));
    }
    document.nodes.forEach((n) => {
      if (n.type === 'character' && n.text.trim()) {
        const cleanName = n.text.replace(/\s*\([^)]*\)$/, '').trim().toUpperCase();
        if (cleanName) set.add(cleanName);
      }
    });
    return Array.from(set).sort();
  }, [document.nodes, formattingSettings?.customCharacters]);

  const sceneHeadingSuggestions = useMemo(() => {
    const set = new Set<string>();
    if (formattingSettings?.customSceneHeadings) {
      formattingSettings.customSceneHeadings.forEach((s) => set.add(s.trim().toUpperCase()));
    }
    document.nodes.forEach((n) => {
      if (n.type === 'sceneHeading' && n.text.trim()) {
        set.add(n.text.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [document.nodes, formattingSettings?.customSceneHeadings]);

  // O(1) Page break lookup map
  const pageBreakMap = useMemo(() => {
    const map = new Map<number, ScreenplayPage>();
    for (const p of pages) {
      if (p.pageNumber > 1) {
        map.set(p.startsAtNodeIndex, p);
      }
    }
    return map;
  }, [pages]);

  // Dynamic 1-based sequential scene numbers
  const sceneNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    let count = 1;
    for (const n of document.nodes) {
      if (n.type === 'sceneHeading') {
        map.set(n.id, count++);
      }
    }
    return map;
  }, [document.nodes]);

  // Determine current caret page
  const currentCaretPage = useMemo(() => {
    if (activeNodeIndex < 0) return 1;
    const found = pages.find(
      (p) => activeNodeIndex >= p.startsAtNodeIndex && activeNodeIndex <= p.endsAtNodeIndex
    );
    return found ? found.pageNumber : 1;
  }, [pages, activeNodeIndex]);

  // Caret / DOM focus synchronization
  useEffect(() => {
    if (!caret) return;
    const el = textareaRefs.current.get(caret.nodeId);
    if (el) {
      const targetNode = document.nodes.find((n) => n.id === caret.nodeId);
      const targetVisiblePos = targetNode?.type === 'parenthetical'
        ? toVisiblePos(Math.min(caret.offset, targetNode.text.length))
        : Math.min(caret.offset, el.value.length);
      const safeOffset = Math.max(0, Math.min(targetVisiblePos, el.value.length));

      if (window.document.activeElement === el) {
        if (el.selectionStart === el.selectionEnd && el.selectionStart !== safeOffset) {
          el.setSelectionRange(safeOffset, safeOffset);
        }
      } else {
        isProgrammaticFocusRef.current = true;
        if (!isTypingRef.current) {
          el.focus({ preventScroll: true });
        }
        el.setSelectionRange(safeOffset, safeOffset);
        // Guarantee caret stays at safeOffset after browser default focus event
        requestAnimationFrame(() => {
          if (textareaRefs.current.get(caret.nodeId) === el) {
            el.setSelectionRange(safeOffset, safeOffset);
          }
          isProgrammaticFocusRef.current = false;
        });
      }
    }
    isTypingRef.current = false;
  }, [caret?.nodeId, caret?.offset, document.nodes]);

  // Optimized Ref registration function to prevent layout thrashing
  const registerTextareaRef = useCallback((nodeId: string, el: HTMLTextAreaElement | null) => {
    if (el) {
      const existing = textareaRefs.current.get(nodeId);
      textareaRefs.current.set(nodeId, el);
      if (!existing) {
        adjustHeight(el);
      }
    } else {
      textareaRefs.current.delete(nodeId);
    }
  }, []);

  // Caret selection change callback
  const handleCaretSelect = useCallback((nodeId: string, offset: number) => {
    if (caret?.nodeId === nodeId && caret?.offset === offset) return;
    onCaretChange({ nodeId, offset });
  }, [caret, onCaretChange]);

  // Text change callback
  const handleTextChange = useCallback((
    nodeId: string,
    newText: string,
    cursorOffset: number
  ) => {
    const node = document.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    isTypingRef.current = true;

    let formattedText = newText;
    if (node.type === 'sceneHeading' || node.type === 'character' || node.type === 'transition') {
      formattedText = newText.toUpperCase();
    } else if (node.type === 'action' || node.type === 'dialogue' || node.type === 'textNote') {
      if (newText.length === 1) {
        formattedText = newText.toUpperCase();
      } else {
        formattedText = newText.replace(/([.?!]\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
      }
    }

    onDispatchCommand({
      type: 'updateNodeText',
      nodeId,
      from: 0,
      to: node.text.length,
      text: formattedText,
    });

    onCaretChange({
      nodeId,
      offset: cursorOffset,
    });
  }, [document.nodes, onDispatchCommand, onCaretChange]);

  // Key down handler
  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    node: ScreenplayNode,
    index: number
  ) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd } = textarea;
    const textLength = node.text.length;

    // Shortcuts
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        onRedo();
      } else {
        onUndo();
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const isEmpty = node.text.trim().length === 0;

      if (e.shiftKey) {
        const targetType = getPreviousNodeTypeOnTab(node.type);
        onDispatchCommand({
          type: 'changeElementType',
          nodeId: node.id,
          targetType,
        });
        return;
      }

      let targetType: ScreenplayNodeType | null = null;
      if (node.type === 'sceneHeading') {
        if (isEmpty) {
          targetType = 'action';
        } else {
          targetType = getNextNodeTypeOnTab(node.type);
        }
      } else if (node.type === 'action') {
        if (isEmpty) {
          targetType = 'character';
        } else {
          targetType = getNextNodeTypeOnTab(node.type);
        }
      } else if (node.type === 'character') {
        if (isEmpty) {
          targetType = 'parenthetical';
        } else {
          targetType = getNextNodeTypeOnTab(node.type);
        }
      } else if (node.type === 'parenthetical') {
        if (isEmpty) {
          targetType = 'action';
        } else {
          targetType = getNextNodeTypeOnTab(node.type);
        }
      } else if (node.type === 'dialogue') {
        targetType = 'parenthetical';
      } else {
        targetType = getNextNodeTypeOnTab(node.type);
      }

      if (targetType) {
        onDispatchCommand({
          type: 'changeElementType',
          nodeId: node.id,
          targetType,
        });
      }
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const targetType = ALT_KEY_TYPE_MAP[e.key];
      if (targetType) {
        e.preventDefault();
        onDispatchCommand({
          type: 'changeElementType',
          nodeId: node.id,
          targetType,
        });
        return;
      }
    }

    // Auto-trigger parenthetical when typing '(' in dialogue at beginning or empty node
    if (e.key === '(' && node.type === 'dialogue') {
      if (node.text.trim().length === 0 || selectionStart === 0) {
        e.preventDefault();
        if (node.text.trim().length === 0) {
          onDispatchCommand({
            type: 'changeElementType',
            nodeId: node.id,
            targetType: 'parenthetical',
          });
        } else {
          onDispatchCommand({
            type: 'insertNode',
            targetType: 'parenthetical',
            beforeNodeId: node.id,
            initialText: '',
          });
        }
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const enterOffset = node.type === 'parenthetical' ? toStoredPos(selectionStart, textLength) : selectionStart;
      onDispatchCommand({
        type: 'screenplayEnter',
        nodeId: node.id,
        offset: enterOffset,
        selection:
          selectionStart !== selectionEnd
            ? {
                start: node.type === 'parenthetical' ? toStoredPos(selectionStart, textLength) : selectionStart,
                end: node.type === 'parenthetical' ? toStoredPos(selectionEnd, textLength) : selectionEnd,
              }
            : undefined,
      });
      return;
    }

    if (e.key === 'Backspace') {
      if (node.type === 'parenthetical' && (textLength === 0 || selectionStart <= 1)) {
        e.preventDefault();
        onDispatchCommand({
          type: 'screenplayBackspace',
          nodeId: node.id,
          offset: 0,
        });
        return;
      }
      if (selectionStart !== selectionEnd || selectionStart === 0) {
        e.preventDefault();
        const bsOffset = node.type === 'parenthetical' ? toStoredPos(selectionStart, textLength) : selectionStart;
        onDispatchCommand({
          type: 'screenplayBackspace',
          nodeId: node.id,
          offset: bsOffset,
          selection: selectionStart !== selectionEnd ? {
            start: node.type === 'parenthetical' ? toStoredPos(selectionStart, textLength) : selectionStart,
            end: node.type === 'parenthetical' ? toStoredPos(selectionEnd, textLength) : selectionEnd,
          } : undefined,
        });
        return;
      }
    }

    if (e.key === 'Delete') {
      const delOffset = node.type === 'parenthetical' ? toStoredPos(selectionStart, textLength) : selectionStart;
      const isAtEnd = node.type === 'parenthetical' ? selectionStart >= textLength + 1 : selectionStart === textLength;
      if (selectionStart !== selectionEnd || isAtEnd) {
        e.preventDefault();
        onDispatchCommand({
          type: 'screenplayDelete',
          nodeId: node.id,
          offset: delOffset,
          selection: selectionStart !== selectionEnd ? {
            start: node.type === 'parenthetical' ? toStoredPos(selectionStart, textLength) : selectionStart,
            end: node.type === 'parenthetical' ? toStoredPos(selectionEnd, textLength) : selectionEnd,
          } : undefined,
        });
        return;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      onDispatchCommand({
        type: 'screenplayEscape',
      });
      return;
    }

    if (e.key === 'ArrowUp' && selectionStart === 0 && selectionEnd === 0 && index > 0) {
      e.preventDefault();
      const prevNode = document.nodes[index - 1];
      onCaretChange({
        nodeId: prevNode.id,
        offset: Math.min(selectionStart, prevNode.text.length),
      });
    } else if (e.key === 'ArrowDown' && selectionStart === textLength && selectionEnd === textLength && index < document.nodes.length - 1) {
      e.preventDefault();
      const nextNode = document.nodes[index + 1];
      onCaretChange({
        nodeId: nextNode.id,
        offset: Math.min(selectionStart, nextNode.text.length),
      });
    } else if (e.key === 'ArrowLeft' && selectionStart === 0 && selectionEnd === 0 && index > 0) {
      e.preventDefault();
      const prevNode = document.nodes[index - 1];
      onCaretChange({
        nodeId: prevNode.id,
        offset: prevNode.text.length,
      });
    } else if (e.key === 'ArrowRight' && selectionStart === textLength && selectionEnd === textLength && index < document.nodes.length - 1) {
      e.preventDefault();
      const nextNode = document.nodes[index + 1];
      onCaretChange({
        nodeId: nextNode.id,
        offset: 0,
      });
    }
  }, [document.nodes, onDispatchCommand, onCaretChange, onRedo, onUndo]);

  const handleTypeSelect = (newType: ScreenplayNodeType) => {
    if (!activeNode) return;
    const targetId = activeNode.id;
    onDispatchCommand({
      type: 'changeElementType',
      nodeId: targetId,
      targetType: newType,
    });
    requestAnimationFrame(() => {
      const textarea = textareaRefs.current.get(targetId);
      if (textarea) {
        textarea.focus();
      }
    });
  };

  const showPageNumbers = formattingSettings?.showPageNumbers !== false;
  const showPage1Number =
    showPageNumbers && formattingSettings?.firstPageNumberSuppressed === false;

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-hidden">
      {/* Quiet Screenplay Toolbar */}
      <div className="h-12 bg-panel border-b border-rule px-4 flex items-center justify-between text-xs shrink-0 z-10 select-none">
        <div className="hidden sm:flex items-center gap-2 text-graphite font-medium text-[11px] min-w-[120px]">
          <span className="truncate max-w-[150px] opacity-60">{document.title}</span>
        </div>

        <div className="flex-1 flex justify-center items-center gap-2">
          {caret && (
            <div className="relative" ref={elementMenuRef}>
              <button
                type="button"
                onClick={() => setIsElementMenuOpen(!isElementMenuOpen)}
                className="inline-flex items-center gap-2 px-3 py-1.5 h-8 text-[12px] font-semibold text-ink hover:text-editor-red bg-paper hover:bg-rule/40 rounded-md border border-rule transition-all cursor-pointer shadow-2xs"
                title="Current element type. Click to change (or press Alt+1..8 / Tab)"
              >
                <div className="w-2 h-2 rounded-full bg-editor-red shrink-0" />
                <span className="font-sans font-medium text-[12px] text-ink">{ELEMENT_LABELS[activeNode?.type || 'action']?.label || 'Action'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-graphite/40 transition-transform duration-200 ${
                    isElementMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isElementMenuOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-56 bg-paper rounded-[var(--radius-modal)] shadow-2xl border border-rule py-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-graphite opacity-40">
                    Element Type
                  </div>
                  {SCREENPLAY_NODE_TYPES.map((type) => {
                    const isSelected = activeNode?.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          handleTypeSelect(type);
                          setIsElementMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[13px] flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-neutral-100/50 text-editor-red font-bold'
                            : 'text-ink hover:bg-neutral-100/30'
                        }`}
                      >
                        <span>{ELEMENT_LABELS[type]?.label || type}</span>
                        <span className="text-[10px] text-graphite opacity-40 font-mono font-bold tracking-tighter">
                          {ELEMENT_LABELS[type]?.shortcut}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 text-xs">
          {/* View Mode controls moved to bottom status bar */}
        </div>
      </div>

      {/* Screenplay Writing Canvas with switchable View Modes */}
      {viewMode === 'seamless' ? (
        <div 
          ref={editorContainerRef}
          className="flex-1 overflow-y-auto px-6 py-12 md:px-12 md:py-20 flex flex-col items-center cursor-text bg-paper"
          style={{ backgroundColor: formattingSettings?.colors?.paperColor || 'var(--paper)' }}
          onClick={() => {
            if (document.nodes.length > 0) {
              const lastNode = document.nodes[document.nodes.length - 1];
              onCaretChange({
                nodeId: lastNode.id,
                offset: lastNode.text.length,
              });
            }
          }}
        >
          <div 
            id="page-marker-1"
            className="w-full max-w-[800px] flex flex-col transition-[transform] duration-75 origin-top bg-paper border-0 shadow-none text-ink" 
            style={{
              backgroundColor: formattingSettings?.colors?.paperColor || 'var(--paper)',
              color: formattingSettings?.colors?.textColor || 'var(--ink)',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {document.nodes.map((node, index) => {
              const prevNode = index > 0 ? document.nodes[index - 1] : null;
              const sceneNum = node.type === 'sceneHeading' ? sceneNumberMap.get(node.id) : undefined;
              const isPageBreak = pageBreakMap.has(index);
              const breakPage = pageBreakMap.get(index);
              const prevPage = breakPage ? pages[breakPage.pageNumber - 2] : null;
              const prevMoreLine = prevPage?.lines?.find((l) => l.type === 'more');
              const prevSceneContdBottom = prevPage?.lines?.find((l) => l.type === 'sceneContinuedBottom');
              const thisPageContd = breakPage?.lines?.find((l) => l.type === 'contd');
              const thisPageSceneContdTop = breakPage?.lines?.find((l) => l.type === 'sceneContinuedTop');

              return (
                <React.Fragment key={node.id}>
                  {isPageBreak && breakPage && (
                    <div 
                      id={`page-marker-${breakPage.pageNumber}`}
                      className="w-full my-12 flex flex-col items-center gap-4 select-none pointer-events-none transition-all"
                    >
                      {prevMoreLine && (
                        <div className="w-full flex justify-center py-1">
                          <span
                            className="font-mono text-xs uppercase tracking-widest text-graphite opacity-60 font-bold"
                            style={{
                              marginLeft: `${(ELEMENT_SPECS.dialogue.leftIn - geom.marginLeftIn) * 40}px`,
                            }}
                          >
                            {prevMoreLine.text}
                          </span>
                        </div>
                      )}
                      {prevSceneContdBottom && (
                        <div className="w-full flex justify-end py-1 px-4">
                          <span className="font-mono text-xs uppercase tracking-widest text-graphite opacity-40 font-bold">
                            {prevSceneContdBottom.text}
                          </span>
                        </div>
                      )}
                      <div className="w-full flex items-center gap-6">
                        <div className="h-px flex-1 border-t border-dashed border-rule" />
                        <span className="text-[10px] font-bold text-graphite opacity-40 uppercase tracking-[0.2em] bg-white px-3">
                          PAGE {breakPage.pageNumber}
                        </span>
                        <div className="h-px flex-1 border-t border-dashed border-rule" />
                      </div>
                      {thisPageSceneContdTop && (
                        <div className="w-full flex justify-start py-1">
                          <span
                            className="font-mono text-xs uppercase tracking-widest text-ink font-bold"
                            style={{
                              marginLeft: `${(ELEMENT_SPECS.sceneHeading.leftIn - geom.marginLeftIn) * 40}px`,
                            }}
                          >
                            {thisPageSceneContdTop.text}
                          </span>
                        </div>
                      )}
                      {thisPageContd && (
                        <div className="w-full flex justify-center py-1">
                          <span
                            className="font-mono text-xs uppercase tracking-widest text-ink font-bold"
                            style={{
                              marginLeft: `${(ELEMENT_SPECS.character.leftIn - geom.marginLeftIn) * 40}px`,
                            }}
                          >
                            {thisPageContd.text}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <ScreenplayNodeItem
                    node={node}
                    index={index}
                    prevNodeType={prevNode ? prevNode.type : null}
                    sceneNumber={sceneNum}
                    geom={geom}
                    formattingSettings={formattingSettings}
                    onTextChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    onCaretSelect={handleCaretSelect}
                    registerTextareaRef={registerTextareaRef}
                    characterSuggestions={characterSuggestions}
                    sceneHeadingSuggestions={sceneHeadingSuggestions}
                    isProgrammaticFocusRef={isProgrammaticFocusRef}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : (
        <div 
          ref={editorContainerRef}
          className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center cursor-text bg-canvas"
          style={{ backgroundColor: formattingSettings?.colors?.backgroundColor || 'var(--canvas)' }}
          onClick={() => {
            if (document.nodes.length > 0) {
              const lastNode = document.nodes[document.nodes.length - 1];
              onCaretChange({
                nodeId: lastNode.id,
                offset: lastNode.text.length,
              });
            }
          }}
        >
          <div 
            className="flex flex-col items-center w-full transition-[transform] duration-75 origin-top" 
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {pages.map((page) => {
              const showThisPageNumber = showPageNumbers && 
                (page.pageNumber > 1 || !formattingSettings?.firstPageNumberSuppressed);

              // Running Header
              const headerLeft = formattingSettings?.headerLeft || formattingSettings?.headerText || '';
              const headerRight = formattingSettings?.headerRight || '';
              const showRunningHeader =
                (Boolean(headerLeft) || Boolean(headerRight)) &&
                (page.pageNumber > 1 || formattingSettings?.showHeaderOnFirstPage);

              // Running Footer
              const footerLeft = formattingSettings?.footerLeft || formattingSettings?.footerText || '';
              const footerRight = formattingSettings?.footerRight || '';
              const showRunningFooter =
                (Boolean(footerLeft) || Boolean(footerRight)) &&
                (page.pageNumber > 1 || formattingSettings?.showFooterOnFirstPage);

              // More & Cont'd markers for this page
              const pageContd = page.lines.find((l) => l.type === 'contd');
              const pageSceneContdTop = page.lines.find((l) => l.type === 'sceneContinuedTop');
              const pageMoreLine = page.lines.find((l) => l.type === 'more');
              const pageSceneContdBottom = page.lines.find((l) => l.type === 'sceneContinuedBottom');

              return (
                <div
                  id={`page-marker-${page.pageNumber}`}
                  key={page.pageNumber}
                  className="bg-paper border border-rule relative text-ink transition-all screenplay-paper mb-12 shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                  style={{
                    backgroundColor: formattingSettings?.colors?.paperColor || 'var(--paper)',
                    color: formattingSettings?.colors?.textColor || 'var(--ink)',
                    width: `${geom.widthIn}in`,
                    minHeight: `${geom.heightIn}in`,
                    paddingTop: `${geom.marginTopIn}in`,
                    paddingRight: `${geom.marginRightIn}in`,
                    paddingBottom: `${geom.marginBottomIn}in`,
                    paddingLeft: `${geom.marginLeftIn}in`,
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Dedicated Page Number Header */}
                  {showThisPageNumber && (
                    <div
                      className="absolute select-none pointer-events-none text-neutral-800 font-bold"
                      style={{
                        top: `${geom.pageNumberTopIn}in`,
                        right: `${geom.pageNumberRightIn}in`,
                        fontFamily: 'var(--screenplay-font, "Courier Prime", "Courier New", Courier, monospace)',
                        fontSize: `${FONT_SIZE_PT}pt`,
                        lineHeight: `${LINE_HEIGHT_PT}pt`,
                      }}
                    >
                      {page.pageNumber}.
                    </div>
                  )}

                  {/* Running Header (Page View, muted grey #888) */}
                  {showRunningHeader && (
                    <div
                      className="absolute flex items-center justify-between select-none pointer-events-none text-[#888] font-mono text-[10pt] uppercase tracking-wider overflow-hidden"
                      style={{
                        top: `${geom.pageNumberTopIn}in`,
                        left: `${geom.marginLeftIn}in`,
                        right: `${geom.marginRightIn + (showThisPageNumber ? 0.6 : 0)}in`,
                        height: `${LINE_HEIGHT_PT}pt`,
                      }}
                    >
                      <span className="truncate">{headerLeft}</span>
                      <span className="truncate text-right">{headerRight}</span>
                    </div>
                  )}

                  {/* Running Footer (Page View, muted grey #888) */}
                  {showRunningFooter && (
                    <div
                      className="absolute flex items-center justify-between select-none pointer-events-none text-[#888] font-mono text-[10pt] uppercase tracking-wider overflow-hidden"
                      style={{
                        bottom: `${geom.pageNumberTopIn}in`,
                        left: `${geom.marginLeftIn}in`,
                        right: `${geom.marginRightIn}in`,
                        height: `${LINE_HEIGHT_PT}pt`,
                      }}
                    >
                      <span className="truncate">{footerLeft}</span>
                      <span className="truncate text-right">{footerRight}</span>
                    </div>
                  )}

                  {/* Top of Page Scene Continued Marker */}
                  {pageSceneContdTop && (
                    <div
                      className="select-none pointer-events-none font-bold uppercase"
                      style={{
                        marginLeft: `${ELEMENT_SPECS.sceneHeading.leftIn - geom.marginLeftIn}in`,
                        fontFamily: 'var(--screenplay-font, "Courier Prime", "Courier New", Courier, monospace)',
                        fontSize: `${FONT_SIZE_PT}pt`,
                        lineHeight: `${LINE_HEIGHT_PT}pt`,
                        marginBottom: `${LINE_HEIGHT_PT}pt`,
                        color: '#1f2937',
                      }}
                    >
                      {pageSceneContdTop.text}
                    </div>
                  )}

                  {/* Top of Page (CONT'D) Marker */}
                  {pageContd && (
                    <div
                      className="select-none pointer-events-none font-bold uppercase"
                      style={{
                        marginLeft: `${ELEMENT_SPECS.character.leftIn - geom.marginLeftIn}in`,
                        fontFamily: 'var(--screenplay-font, "Courier Prime", "Courier New", Courier, monospace)',
                        fontSize: `${FONT_SIZE_PT}pt`,
                        lineHeight: `${LINE_HEIGHT_PT}pt`,
                        marginBottom: `${LINE_HEIGHT_PT}pt`,
                        color: '#111827',
                      }}
                    >
                      {pageContd.text}
                    </div>
                  )}

                  {/* Sliced nodes belonging to this page */}
                  <div>
                    {document.nodes
                      .slice(page.startsAtNodeIndex, page.endsAtNodeIndex + 1)
                      .map((node, nodeOffset) => {
                        const absoluteIndex = page.startsAtNodeIndex + nodeOffset;
                        const prevNode = absoluteIndex > 0 ? document.nodes[absoluteIndex - 1] : null;
                        const sceneNum = node.type === 'sceneHeading' ? sceneNumberMap.get(node.id) : undefined;

                        return (
                          <ScreenplayNodeItem
                            key={node.id}
                            node={node}
                            index={absoluteIndex}
                            prevNodeType={prevNode ? prevNode.type : null}
                            sceneNumber={sceneNum}
                            geom={geom}
                            formattingSettings={formattingSettings}
                            onTextChange={handleTextChange}
                            onKeyDown={handleKeyDown}
                            onCaretSelect={handleCaretSelect}
                            registerTextareaRef={registerTextareaRef}
                            characterSuggestions={characterSuggestions}
                            sceneHeadingSuggestions={sceneHeadingSuggestions}
                            isProgrammaticFocusRef={isProgrammaticFocusRef}
                          />
                        );
                      })}
                  </div>

                  {/* Bottom of Page (MORE) Marker */}
                  {pageMoreLine && (
                    <div
                      className="select-none pointer-events-none uppercase font-mono text-center"
                      style={{
                        marginLeft: `${ELEMENT_SPECS.dialogue.leftIn - geom.marginLeftIn}in`,
                        marginRight: `${ELEMENT_SPECS.dialogue.rightIn - geom.marginRightIn}in`,
                        fontFamily: 'var(--screenplay-font, "Courier Prime", "Courier New", Courier, monospace)',
                        fontSize: `${FONT_SIZE_PT}pt`,
                        lineHeight: `${LINE_HEIGHT_PT}pt`,
                        marginTop: `${LINE_HEIGHT_PT}pt`,
                        color: '#374151',
                      }}
                    >
                      {pageMoreLine.text}
                    </div>
                  )}

                  {/* Bottom of Page Scene Continued Marker */}
                  {pageSceneContdBottom && (
                    <div
                      className="select-none pointer-events-none uppercase font-mono text-right"
                      style={{
                        marginRight: `${ELEMENT_SPECS.sceneHeading.rightIn - geom.marginRightIn}in`,
                        fontFamily: 'var(--screenplay-font, "Courier Prime", "Courier New", Courier, monospace)',
                        fontSize: `${FONT_SIZE_PT}pt`,
                        lineHeight: `${LINE_HEIGHT_PT}pt`,
                        marginTop: `${LINE_HEIGHT_PT}pt`,
                        color: '#4b5563',
                      }}
                    >
                      {pageSceneContdBottom.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quiet Script Status Bar */}
      <footer className="h-8 bg-panel border-t border-rule px-4 flex items-center justify-between text-[11px] text-graphite shrink-0 select-none">
        <div className="flex items-center gap-3 text-graphite/60">
          <span>Tab / Enter moves between elements</span>
          <span className="text-graphite/30">•</span>
          <span>Alt+1-8 switches format</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 bg-paper px-2 py-0.5 rounded border border-rule">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              disabled={zoom <= 50}
              className="w-4 h-4 flex items-center justify-center rounded text-ink/80 hover:text-ink hover:bg-rule/50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer"
              title="Zoom Out (Ctrl -)"
            >
              -
            </button>
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-14 h-1 bg-rule rounded-lg appearance-none cursor-pointer accent-editor-red"
              style={{ width: '50px' }}
              title="Canvas Zoom Slider"
            />
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="text-[10px] font-semibold text-ink/80 hover:text-ink px-1 py-0.5 rounded hover:bg-rule/50 transition-colors cursor-pointer min-w-[36px] text-center"
              title="Reset Zoom to 100%"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              disabled={zoom >= 200}
              className="w-4 h-4 flex items-center justify-center rounded text-ink/80 hover:text-ink hover:bg-rule/50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer"
              title="Zoom In (Ctrl +)"
            >
              +
            </button>
          </div>

          <div className="h-3.5 w-px bg-rule" />

          <span>
            {document.nodes
              .map((n) => n.text.trim())
              .filter(Boolean)
              .join(' ')
              .split(/\s+/)
              .filter(Boolean).length}{' '}
            words
          </span>
          <span className="text-graphite/30">•</span>
          <span className="font-medium text-ink">
            Page {currentCaretPage} of {pages.length}
          </span>
        </div>
      </footer>
    </div>
  );
};
