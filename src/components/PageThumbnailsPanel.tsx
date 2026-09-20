/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ScreenplayDocument,
  SceneMetadata,
  DocumentFormattingSettings,
  DEFAULT_FORMATTING_SETTINGS,
} from '../types';
import {
  paginateScreenplayDocument,
  PageFormat,
  PAGE_GEOMETRIES,
} from '../core/screenplay_layout';
import {
  FileText,
  Clapperboard,
  Layers,
  ChevronRight,
  Sparkles,
  MapPin,
  Clock,
  Users,
  CheckCircle2,
  Plus,
  Trash2,
  Hash,
} from 'lucide-react';

interface PageThumbnailsPanelProps {
  document: ScreenplayDocument;
  activeScene: SceneMetadata | null;
  formattingSettings?: DocumentFormattingSettings;
  pageFormat?: PageFormat;
  onUpdateScene: (updated: SceneMetadata) => void;
  onJumpToPage: (pageNumber: number) => void;
  onJumpToNode?: (nodeId: string) => void;
  onUpdateFormattingSettings?: (settings: Partial<DocumentFormattingSettings>) => void;
}

export const PageThumbnailsPanel: React.FC<PageThumbnailsPanelProps> = ({
  document: screenplayDoc,
  activeScene,
  formattingSettings,
  pageFormat = 'US_LETTER',
  onUpdateScene,
  onJumpToPage,
  onJumpToNode,
  onUpdateFormattingSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'pages' | 'production'>('pages');
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [isSmartTypeOpen, setIsSmartTypeOpen] = useState(false);
  const [newCharInput, setNewCharInput] = useState('');
  const [newSceneInput, setNewSceneInput] = useState('');

  // Combined character list (dynamic + custom)
  const allCharacters = useMemo(() => {
    const set = new Set<string>();
    if (formattingSettings?.customCharacters) {
      formattingSettings.customCharacters.forEach(c => set.add(c.trim().toUpperCase()));
    }
    screenplayDoc.nodes.forEach(n => {
      if (n.type === 'character' && n.text.trim()) {
        set.add(n.text.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [screenplayDoc.nodes, formattingSettings?.customCharacters]);

  // Combined scene heading list (dynamic + custom)
  const allSceneHeadings = useMemo(() => {
    const set = new Set<string>();
    if (formattingSettings?.customSceneHeadings) {
      formattingSettings.customSceneHeadings.forEach(s => set.add(s.trim().toUpperCase()));
    }
    screenplayDoc.nodes.forEach(n => {
      if (n.type === 'sceneHeading' && n.text.trim()) {
        set.add(n.text.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [screenplayDoc.nodes, formattingSettings?.customSceneHeadings]);

  const handleAddCharacter = () => {
    const val = newCharInput.trim().toUpperCase();
    if (!val) return;
    const current = formattingSettings?.customCharacters || [];
    if (!current.includes(val)) {
      onUpdateFormattingSettings?.({
        customCharacters: [...current, val],
      });
    }
    setNewCharInput('');
  };

  const handleRemoveCharacter = (char: string) => {
    const current = formattingSettings?.customCharacters || [];
    onUpdateFormattingSettings?.({
      customCharacters: current.filter(c => c !== char),
    });
  };

  const handleAddSceneHeading = () => {
    const val = newSceneInput.trim().toUpperCase();
    if (!val) return;
    const current = formattingSettings?.customSceneHeadings || [];
    if (!current.includes(val)) {
      onUpdateFormattingSettings?.({
        customSceneHeadings: [...current, val],
      });
    }
    setNewSceneInput('');
  };

  const handleRemoveSceneHeading = (heading: string) => {
    const current = formattingSettings?.customSceneHeadings || [];
    onUpdateFormattingSettings?.({
      customSceneHeadings: current.filter(s => s !== heading),
    });
  };

  // Calculate pages deterministically
  const pages = paginateScreenplayDocument(screenplayDoc.nodes, pageFormat, formattingSettings);
  const geom = PAGE_GEOMETRIES[pageFormat];

  // Compute dynamic 1-based sequential scene numbers
  const sceneNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    let count = 1;
    for (const n of screenplayDoc.nodes) {
      if (n.type === 'sceneHeading') {
        map.set(n.id, count++);
      }
    }
    return map;
  }, [screenplayDoc.nodes]);

  const handlePageClick = (pageNumber: number) => {
    setSelectedPageNum(pageNumber);
    onJumpToPage(pageNumber);
  };

  const handleFieldChange = (field: keyof SceneMetadata, value: any) => {
    if (!activeScene) return;
    onUpdateScene({
      ...activeScene,
      [field]: value,
      updatedAt: Date.now(),
    });
  };

  const handleAddNote = () => {
    if (!activeScene) return;
    onUpdateScene({
      ...activeScene,
      notes: [...activeScene.notes, ''],
      updatedAt: Date.now(),
    });
  };

  const handleUpdateNote = (index: number, val: string) => {
    if (!activeScene) return;
    const updatedNotes = [...activeScene.notes];
    updatedNotes[index] = val;
    onUpdateScene({
      ...activeScene,
      notes: updatedNotes,
      updatedAt: Date.now(),
    });
  };

  const handleDeleteNote = (index: number) => {
    if (!activeScene) return;
    const updatedNotes = [...activeScene.notes];
    updatedNotes.splice(index, 1);
    onUpdateScene({
      ...activeScene,
      notes: updatedNotes,
      updatedAt: Date.now(),
    });
  };

  return (
    <aside className="w-80 border-l border-rule bg-white flex flex-col h-full overflow-hidden text-xs select-none shrink-0">
      {/* Sidebar Top Header & Mode Selector */}
      <div className="p-4 border-b border-rule bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[var(--radius-ui)] bg-neutral-100/50 border border-rule">
              <Layers className="w-4 h-4 text-ink" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-[11px] uppercase tracking-widest">
                {activeTab === 'pages' ? 'Page Previews' : 'Production'}
              </h3>
              <span className="text-[10px] text-graphite opacity-40 font-bold uppercase tracking-tighter">
                {pages.length} {pages.length === 1 ? 'Page' : 'Pages'} • {geom.name}
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs: Page Thumbnails vs Production */}
        <div className="grid grid-cols-2 p-0.5 bg-white rounded-[var(--radius-ui)] border border-rule text-[10px] font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('pages')}
            className={`py-2 rounded-[var(--radius-ui)] transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none ${
              activeTab === 'pages'
                ? 'bg-paper text-ink shadow-sm'
                : 'text-graphite hover:text-ink'
            }`}
            style={{ 
              paddingTop: '8px',
              width: '140.347px',
              height: '29.9653px',
              marginLeft: '1px',
              marginBottom: '2px',
              marginRight: '4px',
              marginTop: '2px',
              borderWidth: '1px',
              borderStyle: 'groove',
              borderRadius: '6px',
              backgroundColor: '#ffffff'
            }}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Pages</span>
          </button>

          <button
            onClick={() => setActiveTab('production')}
            className={`py-2 rounded-[var(--radius-ui)] transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none ${
              activeTab === 'production'
                ? 'bg-paper text-ink shadow-sm'
                : 'text-graphite hover:text-ink'
            }`}
            style={{
              height: '29.9653px',
              width: '140.33px',
              marginLeft: '1px',
              marginRight: '4px',
              marginTop: '2px',
              marginBottom: '2px',
              borderWidth: '1px',
              borderStyle: 'groove'
            }}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Production</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
        {activeTab === 'pages' ? (
          <div className="space-y-4">
            {/* Page Thumbnails List */}
            <div className="space-y-4">
              {pages.map((p) => {
                const isSelected = selectedPageNum === p.pageNumber;
                // Find main scene heading on this page if any
                const sceneHeadingLine = p.lines.find((l) => l.type === 'sceneHeading');

                return (
                  <div
                    key={p.pageNumber}
                    onClick={() => handlePageClick(p.pageNumber)}
                    className={`group cursor-pointer flex gap-4 p-2 rounded-[var(--radius-ui)] transition-all ${
                      isSelected
                        ? 'bg-neutral-100/50 ring-1 ring-rule'
                        : 'hover:bg-neutral-50'
                    }`}
                    title={sceneHeadingLine?.text ? `Page ${p.pageNumber}: ${sceneHeadingLine.text}` : `Page ${p.pageNumber}`}
                  >
                    {/* Compact Page Number */}
                    <div className="w-6 flex flex-col items-center pt-2">
                       <span className={`text-[11px] font-bold font-mono ${isSelected ? 'text-editor-red' : 'text-graphite opacity-30'}`}>
                          {p.pageNumber}
                        </span>
                    </div>

                    {/* Thumbnail Card */}
                    <div className="flex-1">
                      <div className={`relative w-full aspect-[8.5/11] bg-white border rounded-[var(--radius-ui)] shadow-sm overflow-hidden flex flex-col select-none transition-all ${
                        isSelected ? 'border-editor-red shadow-md' : 'border-rule group-hover:border-graphite/20'
                      }`}>
                        {/* Scaled Text Representation */}
                        <div 
                          className="flex-1 overflow-hidden p-[8%] space-y-[0.5%] origin-top"
                          style={{ 
                            fontSize: '3px', 
                            lineHeight: '4.5px', 
                            fontFamily: '"Courier Prime", Courier, monospace',
                          }}
                        >
                          {p.lines.map((line, lIdx) => {
                            if (!line.text || line.text.trim().length === 0) {
                              return <div key={lIdx} className="h-[2px]" />;
                            }

                            // Calculate indents for the thumbnail based on element types
                            let marginLeft = '0%';
                            let width = '100%';
                            let textAlign: 'left' | 'center' | 'right' = 'left';

                            if (line.type === 'sceneHeading') {
                              textAlign = 'left';
                              width = '100%';
                            } else if (line.type === 'character') {
                              marginLeft = '35%';
                              width = '65%';
                            } else if (line.type === 'parenthetical') {
                              marginLeft = '25%';
                              width = '50%';
                            } else if (line.type === 'dialogue') {
                              marginLeft = '15%';
                              width = '70%';
                            } else if (line.type === 'transition') {
                              textAlign = 'right';
                            }

                            return (
                              <div
                                key={lIdx}
                                className="whitespace-nowrap overflow-hidden text-ink"
                                style={{
                                  marginLeft,
                                  width,
                                  textAlign,
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit',
                                  textTransform: (line.type === 'character' || line.type === 'sceneHeading' || line.type === 'transition') ? 'uppercase' : 'none',
                                  fontWeight: (line.type === 'sceneHeading' || line.type === 'character') ? '700' : '400',
                                  opacity: 0.9
                                }}
                              >
                                {line.text}
                              </div>
                            );
                          })}
                        </div>

                        {/* No gradient for full page visibility */}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Production Mode: Incorporated Scene Breakdown & Notes */
          <div className="space-y-6">
            {/* Document & Production Numbering Controls */}
            <div className="bg-paper p-4 rounded-[var(--radius-ui)] border border-rule shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-rule pb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-ink text-[11px] uppercase tracking-widest">
                  <Hash className="w-3.5 h-3.5 opacity-60" />
                  <span>Numbering</span>
                </div>
              </div>

              <div className="space-y-3 text-[11px] font-bold uppercase tracking-wider">
                {/* Page Numbers Toggle */}
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-graphite group-hover:text-ink transition-colors">Page Numbers</span>
                    <input
                      type="checkbox"
                      checked={formattingSettings?.showPageNumbers !== false}
                      onChange={(e) => onUpdateFormattingSettings?.({ showPageNumbers: e.target.checked })}
                      className="rounded text-ink focus:ring-ink w-4 h-4 cursor-pointer"
                    />
                  </label>

                  {formattingSettings?.showPageNumbers !== false && (
                    <label className="flex items-center justify-between cursor-pointer pl-4 py-1 border-l-2 border-rule group">
                      <span className="text-[10px] text-graphite/60 group-hover:text-ink transition-colors">Suppress Page 1</span>
                      <input
                        type="checkbox"
                        checked={formattingSettings?.firstPageNumberSuppressed !== false}
                        onChange={(e) => onUpdateFormattingSettings?.({ firstPageNumberSuppressed: e.target.checked })}
                        className="rounded text-ink focus:ring-ink w-3.5 h-3.5 cursor-pointer"
                      />
                    </label>
                  )}
                </div>

                {/* Scene Numbers Toggle */}
                <div className="pt-3 border-t border-rule space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-graphite group-hover:text-ink transition-colors">Scene Numbers</span>
                    <input
                      type="checkbox"
                      checked={formattingSettings?.showSceneNumbers !== false}
                      onChange={(e) => onUpdateFormattingSettings?.({ showSceneNumbers: e.target.checked })}
                      className="rounded text-ink focus:ring-ink w-4 h-4 cursor-pointer"
                    />
                  </label>

                  {formattingSettings?.showSceneNumbers !== false && (
                    <div className="pl-4 py-2 space-y-2 border-l-2 border-rule">
                      <span className="text-[10px] text-graphite/60 block">Placement</span>
                      <select
                        value={formattingSettings?.sceneNumberPosition || 'both'}
                        onChange={(e) => onUpdateFormattingSettings?.({ sceneNumberPosition: e.target.value as any })}
                        className="w-full bg-paper border border-rule rounded-[var(--radius-ui)] px-2.5 py-1.5 text-ink text-[11px] font-bold outline-none cursor-pointer uppercase tracking-wider"
                      >
                        <option value="both">Both Margins</option>
                        <option value="left">Left Only</option>
                        <option value="right">Right Only</option>
                        <option value="none">Hidden</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SmartType Auto-Complete Card */}
            <div className="bg-paper p-4 rounded-[var(--radius-ui)] border border-rule shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-rule pb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-ink text-[11px] uppercase tracking-widest">
                  <Sparkles className="w-3.5 h-3.5 opacity-60" />
                  <span>SmartType</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSmartTypeOpen(true)}
                className="w-full py-2.5 px-4 bg-paper hover:bg-neutral-100/50 text-ink border border-rule rounded-[var(--radius-ui)] text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Layers className="w-3.5 h-3.5 opacity-60" />
                <span>Index Manager</span>
              </button>
            </div>

            {/* More & Continueds Card */}
            <div className="bg-paper p-4 rounded-[var(--radius-ui)] border border-rule shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-rule pb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-ink text-[11px] uppercase tracking-widest">
                  <FileText className="w-3.5 h-3.5 opacity-60" />
                  <span>Page Breaks</span>
                </div>
              </div>

              <div className="space-y-3 text-[11px] font-bold uppercase tracking-wider">
                <label className="flex items-start justify-between gap-3 cursor-pointer group">
                  <div className="flex-1">
                    <span className="text-graphite group-hover:text-ink transition-colors block leading-snug">Show (MORE) / (CONT'D)</span>
                    <p className="text-[10px] text-graphite/40 normal-case font-medium leading-relaxed mt-1">
                      Splits bottom-of-page dialogue with (MORE) and resumes next page with (CONT'D).
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formattingSettings?.showMoreAndContd !== false}
                    onChange={(e) => onUpdateFormattingSettings?.({ showMoreAndContd: e.target.checked })}
                    className="rounded text-ink focus:ring-ink w-4 h-4 cursor-pointer mt-0.5 shrink-0"
                  />
                </label>
              </div>
            </div>

            {/* Running Header & Footer Controls Card */}
            <div className="bg-paper p-4 rounded-[var(--radius-ui)] border border-rule shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-rule pb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-ink text-[11px] uppercase tracking-widest">
                  <FileText className="w-3.5 h-3.5 opacity-60" />
                  <span>Header & Footer</span>
                </div>
              </div>

              <div className="space-y-3.5 text-[11px] font-bold uppercase tracking-widest">
                <div className="space-y-1.5">
                  <span className="text-graphite/60 block text-[10px]">Header Left</span>
                  <input
                    type="text"
                    placeholder="TITLE / EPISODE"
                    value={formattingSettings?.headerLeft || ''}
                    onChange={(e) => onUpdateFormattingSettings?.({ headerLeft: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] text-[11px] text-ink focus:bg-paper focus:outline-none focus:ring-1 focus:ring-ink font-mono uppercase transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-graphite/60 block text-[10px]">Header Right</span>
                  <input
                    type="text"
                    placeholder="DRAFT DATE"
                    value={formattingSettings?.headerRight || ''}
                    onChange={(e) => onUpdateFormattingSettings?.({ headerRight: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] text-[11px] text-ink focus:bg-paper focus:outline-none focus:ring-1 focus:ring-ink font-mono uppercase transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-graphite/60 block text-[10px]">Footer Left</span>
                  <input
                    type="text"
                    placeholder="CONFIDENTIAL"
                    value={formattingSettings?.footerLeft || ''}
                    onChange={(e) => onUpdateFormattingSettings?.({ footerLeft: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] text-[11px] text-ink focus:bg-paper focus:outline-none focus:ring-1 focus:ring-ink font-mono uppercase transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-graphite/60 block text-[10px]">Footer Right</span>
                  <input
                    type="text"
                    placeholder="STUDIO / CONTACT"
                    value={formattingSettings?.footerRight || ''}
                    onChange={(e) => onUpdateFormattingSettings?.({ footerRight: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] text-[11px] text-ink focus:bg-paper focus:outline-none focus:ring-1 focus:ring-ink font-mono uppercase transition-all"
                  />
                </div>

                <div className="pt-3 border-t border-rule space-y-2.5">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-[10px] text-graphite group-hover:text-ink transition-colors">Suppress Header P1</span>
                    <input
                      type="checkbox"
                      checked={!formattingSettings?.showHeaderOnFirstPage}
                      onChange={(e) => onUpdateFormattingSettings?.({ showHeaderOnFirstPage: !e.target.checked })}
                      className="rounded text-ink focus:ring-ink w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-[10px] text-graphite group-hover:text-ink transition-colors">Suppress Footer P1</span>
                    <input
                      type="checkbox"
                      checked={!formattingSettings?.showFooterOnFirstPage}
                      onChange={(e) => onUpdateFormattingSettings?.({ showFooterOnFirstPage: !e.target.checked })}
                      className="rounded text-ink focus:ring-ink w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            {activeScene ? (
              <div className="space-y-4">
                {/* Scene Header Info */}
                <div className="bg-paper p-4 rounded-[var(--radius-ui)] border border-rule shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-rule pb-2.5">
                    <span className="font-bold text-ink text-[11px] uppercase tracking-widest">
                      Scene {activeScene.sceneNumber || '1'}
                    </span>
                    <select
                      value={activeScene.status}
                      onChange={(e) => handleFieldChange('status', e.target.value)}
                      className="bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] px-2.5 py-1 text-ink text-[10px] font-bold outline-none cursor-pointer uppercase tracking-wider"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Revised">Revised</option>
                      <option value="Locked">Locked</option>
                      <option value="Review">Review</option>
                    </select>
                  </div>

                  <div className="space-y-2.5 text-[11px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2.5 text-ink">
                      <MapPin className="w-3.5 h-3.5 opacity-40 shrink-0" />
                      <span className="truncate">{activeScene.location || 'LOCATION NOT SET'}</span>
                    </div>

                    <div className="flex items-center gap-2.5 text-ink">
                      <Clock className="w-3.5 h-3.5 opacity-40 shrink-0" />
                      <span>{activeScene.timeOfDay || 'DAY'}</span>
                    </div>
                  </div>
                </div>

                {/* Synopsis */}
                <div className="bg-paper p-4 rounded-[var(--radius-ui)] border border-rule shadow-sm space-y-2.5">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-graphite/60">
                    Scene Synopsis
                  </label>
                  <textarea
                    rows={3}
                    value={activeScene.synopsis || ''}
                    onChange={(e) => handleFieldChange('synopsis', e.target.value)}
                    placeholder="Brief scene overview..."
                    className="w-full bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] p-2.5 text-ink text-[12px] font-medium leading-relaxed outline-none focus:bg-paper focus:ring-1 focus:ring-ink transition-all placeholder:italic placeholder:font-normal"
                  />
                </div>

                {/* Cast / Characters */}
                <div className="bg-paper p-4 rounded-[var(--radius-ui)] border border-rule shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-rule pb-2.5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-graphite/60">
                      Cast ({activeScene.characters.length})
                    </label>
                    <Users className="w-3.5 h-3.5 opacity-40" />
                  </div>

                  {activeScene.characters.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeScene.characters.map((char, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 rounded-[var(--radius-ui)] bg-neutral-100/50 border border-rule text-ink text-[10px] font-bold font-mono tracking-tighter"
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-graphite/40 italic font-medium">No speaking characters detected.</p>
                  )}
                </div>

                {/* Production Notes */}
                <div className="bg-paper p-4 rounded-[var(--radius-ui)] border border-rule shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-rule pb-2.5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-graphite/60">
                      Editor's Notes
                    </label>
                    <button
                      onClick={handleAddNote}
                      className="p-1 rounded-[var(--radius-ui)] bg-neutral-100/50 hover:bg-ink hover:text-paper text-ink transition-colors cursor-pointer border-none"
                      title="Add Note"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {activeScene.notes.length > 0 ? (
                    <div className="space-y-3">
                      {activeScene.notes.map((note, nIdx) => (
                        <div key={nIdx} className="flex items-start gap-2 group">
                          <textarea
                            rows={2}
                            value={note}
                            onChange={(e) => handleUpdateNote(nIdx, e.target.value)}
                            placeholder="Type note..."
                            className="flex-1 bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] p-2.5 text-ink text-[12px] font-medium outline-none focus:bg-paper focus:ring-1 focus:ring-ink transition-all"
                          />
                          <button
                            onClick={() => handleDeleteNote(nIdx)}
                            className="p-1 text-graphite opacity-0 group-hover:opacity-100 hover:text-editor-red rounded transition-all cursor-pointer border-none bg-transparent mt-1.5"
                            title="Delete Note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-graphite/40 italic font-medium">No notes added yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 px-6 text-graphite/40 space-y-3">
                <Clapperboard className="w-10 h-10 opacity-10 mx-auto" />
                <p className="text-[11px] font-medium leading-relaxed uppercase tracking-widest">Select a scene to inspect production data.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SmartType Index Manager Modal */}
      {isSmartTypeOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-6">
          <div className="bg-paper rounded-[var(--radius-ui)] shadow-2xl border border-rule w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-rule">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-ink opacity-60" />
                <div>
                  <h3 className="font-bold text-ink text-[12px] uppercase tracking-widest">SmartType Index</h3>
                  <p className="text-[10px] text-graphite/60 font-bold uppercase tracking-tighter mt-0.5">Manage Auto-Complete Repositories</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSmartTypeOpen(false)}
                className="text-graphite hover:text-ink p-2 rounded-[var(--radius-ui)] hover:bg-neutral-100 transition-all cursor-pointer border-none bg-transparent"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 min-h-0 custom-scrollbar">
              {/* Characters Section */}
              <div className="flex flex-col h-full min-h-0 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-graphite/40">
                    Characters ({allCharacters.length})
                  </span>
                </div>

                {/* Add Character Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCharInput}
                    onChange={(e) => setNewCharInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCharacter();
                      }
                    }}
                    placeholder="NAME..."
                    className="flex-1 bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] px-3 py-2 text-[11px] text-ink font-mono uppercase focus:bg-paper focus:ring-1 focus:ring-ink transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCharacter}
                    className="bg-ink hover:bg-graphite text-paper rounded-[var(--radius-ui)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border-none shadow-sm"
                  >
                    Add
                  </button>
                </div>

                {/* Characters List */}
                <div className="flex-1 border border-rule rounded-[var(--radius-ui)] bg-neutral-50/50 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                  {allCharacters.length > 0 ? (
                    allCharacters.map((char) => {
                      const isCustom = formattingSettings?.customCharacters?.includes(char);
                      return (
                        <div
                          key={char}
                          className="flex items-center justify-between bg-paper border border-rule/60 rounded-[var(--radius-ui)] px-3 py-2 text-[11px] font-mono group transition-all hover:shadow-xs"
                        >
                          <span className="font-bold text-ink">{char}</span>
                          <div className="flex items-center gap-2">
                            {isCustom ? (
                              <span className="text-[8px] bg-editor-red/5 text-editor-red px-1.5 py-0.5 rounded-[2px] font-sans uppercase font-bold tracking-tighter">
                                Custom
                              </span>
                            ) : (
                              <span className="text-[8px] bg-graphite/5 text-graphite/60 px-1.5 py-0.5 rounded-[2px] font-sans uppercase font-bold tracking-tighter">
                                Auto
                              </span>
                            )}
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCharacter(char)}
                                className="text-graphite/40 hover:text-editor-red p-1 rounded transition-colors cursor-pointer border-none bg-transparent"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-graphite/20 text-[10px] font-bold uppercase tracking-widest italic">
                      Empty Index
                    </div>
                  )}
                </div>
              </div>

              {/* Scene Headings Section */}
              <div className="flex flex-col h-full min-h-0 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-graphite/40">
                    Locations ({allSceneHeadings.length})
                  </span>
                </div>

                {/* Add Scene Heading Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSceneInput}
                    onChange={(e) => setNewSceneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSceneHeading();
                      }
                    }}
                    placeholder="LOCATION..."
                    className="flex-1 bg-neutral-100/50 border border-rule rounded-[var(--radius-ui)] px-3 py-2 text-[11px] text-ink font-mono uppercase focus:bg-paper focus:ring-1 focus:ring-ink transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSceneHeading}
                    className="bg-ink hover:bg-graphite text-paper rounded-[var(--radius-ui)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border-none shadow-sm"
                  >
                    Add
                  </button>
                </div>

                {/* Scene Headings List */}
                <div className="flex-1 border border-rule rounded-[var(--radius-ui)] bg-neutral-50/50 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                  {allSceneHeadings.length > 0 ? (
                    allSceneHeadings.map((heading) => {
                      const isCustom = formattingSettings?.customSceneHeadings?.includes(heading);
                      return (
                        <div
                          key={heading}
                          className="flex items-center justify-between bg-paper border border-rule/60 rounded-[var(--radius-ui)] px-3 py-2 text-[11px] font-mono group transition-all hover:shadow-xs"
                        >
                          <span className="font-bold text-ink truncate max-w-[120px]">{heading}</span>
                          <div className="flex items-center gap-2">
                            {isCustom ? (
                              <span className="text-[8px] bg-editor-red/5 text-editor-red px-1.5 py-0.5 rounded-[2px] font-sans uppercase font-bold tracking-tighter">
                                Custom
                              </span>
                            ) : (
                              <span className="text-[8px] bg-graphite/5 text-graphite/60 px-1.5 py-0.5 rounded-[2px] font-sans uppercase font-bold tracking-tighter">
                                Auto
                              </span>
                            )}
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSceneHeading(heading)}
                                className="text-graphite/40 hover:text-editor-red p-1 rounded transition-colors cursor-pointer border-none bg-transparent"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-graphite/20 text-[10px] font-bold uppercase tracking-widest italic">
                      Empty Index
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-neutral-100/50 rounded-b-[var(--radius-ui)] border-t border-rule flex items-center justify-between text-graphite/60 text-[10px] font-bold uppercase tracking-wider">
              <span>SmartType items appear in the editor auto-complete.</span>
              <button
                type="button"
                onClick={() => setIsSmartTypeOpen(false)}
                className="px-6 py-2 bg-ink hover:bg-graphite text-paper rounded-[var(--radius-ui)] font-bold uppercase tracking-widest transition-all cursor-pointer border-none"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
