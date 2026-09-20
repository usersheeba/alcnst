/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  DocumentFormattingSettings,
  DEFAULT_FORMATTING_SETTINGS,
  DEFAULT_ELEMENT_STYLES,
  DEFAULT_COLOR_SETTINGS,
  ElementStylesSettings,
  ElementStyleConfig,
  FontFamilyOption,
  ScreenplayElementType,
} from '../types';
import {
  Settings,
  Type,
  Heading,
  Layout,
  Sliders,
  Check,
  X,
  RotateCcw,
  Sparkles,
  FileText,
  Palette,
} from 'lucide-react';

interface DocumentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  settings?: DocumentFormattingSettings;
  onSaveSettings: (updated: DocumentFormattingSettings) => void;
  onOpenHub?: () => void;
  initialTab?: 'elements' | 'colors' | 'typography' | 'titlePage' | 'geometry' | 'production' | 'project';
}

const ELEMENT_LABELS: Record<ScreenplayElementType, { label: string; description: string }> = {
  sceneHeading: { label: 'Scene Heading', description: 'e.g. INT. COFFEE SHOP - DAY' },
  action: { label: 'Action Description', description: 'Narrative scene description text' },
  character: { label: 'Character Name', description: 'e.g. JOHN or SARAH' },
  parenthetical: { label: 'Parenthetical', description: 'e.g. (whispering quietly)' },
  dialogue: { label: 'Dialogue Block', description: 'Spoken speech content' },
  transition: { label: 'Transition', description: 'e.g. CUT TO: or FADE IN:' },
  shot: { label: 'Shot / Angle', description: 'e.g. ANGLE ON DOOR' },
  textNote: { label: 'Text Note', description: 'Private author note or annotation' },
  newAct: { label: 'New Act', description: 'e.g. ACT ONE or ACT I' },
  endOfAct: { label: 'End of Act', description: 'e.g. END OF ACT ONE' },
  outline: { label: 'Outline', description: 'Section summary or scene outline heading' },
};

export const DocumentSettingsModal: React.FC<DocumentSettingsModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  settings,
  onSaveSettings,
  onOpenHub,
  initialTab = 'elements',
}) => {
  const [activeTab, setActiveTab] = useState<'elements' | 'colors' | 'typography' | 'titlePage' | 'geometry' | 'production' | 'project'>(initialTab);
  const [localSettings, setLocalSettings] = useState<DocumentFormattingSettings>(() => {
    const base = settings ? { ...DEFAULT_FORMATTING_SETTINGS, ...settings } : DEFAULT_FORMATTING_SETTINGS;
    return {
      ...base,
      elementStyles: {
        ...DEFAULT_ELEMENT_STYLES,
        ...(settings?.elementStyles || {}),
      },
      colors: {
        ...DEFAULT_COLOR_SETTINGS,
        ...(settings?.colors || {}),
      },
      titlePage: {
        ...DEFAULT_FORMATTING_SETTINGS.titlePage,
        ...(settings?.titlePage || {}),
      },
    };
  });

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      const merged: DocumentFormattingSettings = settings
        ? {
            ...DEFAULT_FORMATTING_SETTINGS,
            ...settings,
            elementStyles: {
              ...DEFAULT_ELEMENT_STYLES,
              ...(settings.elementStyles || {}),
            },
            titlePage: {
              ...DEFAULT_FORMATTING_SETTINGS.titlePage,
              ...(settings.titlePage || {}),
              title: settings.titlePage?.title || documentTitle || '',
            },
          }
        : {
            ...DEFAULT_FORMATTING_SETTINGS,
            titlePage: {
              ...DEFAULT_FORMATTING_SETTINGS.titlePage,
              title: documentTitle || '',
            },
          };
      setLocalSettings(merged);
    }
  }, [isOpen, settings, documentTitle]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  const handleResetDefaults = () => {
    setLocalSettings({
      ...DEFAULT_FORMATTING_SETTINGS,
      elementStyles: DEFAULT_ELEMENT_STYLES,
      titlePage: {
        ...DEFAULT_FORMATTING_SETTINGS.titlePage,
        title: documentTitle || '',
      },
    });
  };

  const updateField = <K extends keyof DocumentFormattingSettings>(
    field: K,
    val: DocumentFormattingSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [field]: val }));
  };

  const updateElementStyle = (
    elemType: ScreenplayElementType,
    key: keyof ElementStyleConfig,
    val: any
  ) => {
    setLocalSettings((prev) => {
      const currentElemStyles = prev.elementStyles || DEFAULT_ELEMENT_STYLES;
      const currentConfig = currentElemStyles[elemType] || DEFAULT_ELEMENT_STYLES[elemType];
      return {
        ...prev,
        elementStyles: {
          ...currentElemStyles,
          [elemType]: {
            ...currentConfig,
            [key]: val,
          },
        },
      };
    });
  };

  const updateTitlePage = (field: string, val: any) => {
    setLocalSettings((prev) => ({
      ...prev,
      titlePage: {
        ...prev.titlePage,
        [field]: val,
      },
    }));
  };

  const getPreviewFontFamily = (family: FontFamilyOption) => {
    switch (family) {
      case 'courier_prime':
        return '"Courier Prime", "Courier New", Courier, monospace';
      case 'courier_new':
        return '"Courier New", Courier, monospace';
      case 'pt_mono':
        return '"PT Mono", monospace';
      case 'times':
        return '"Times New Roman", Times, serif';
      case 'georgia':
        return 'Georgia, serif';
      default:
        return '"Courier Prime", monospace';
    }
  };

  const currentElementStyles = localSettings.elementStyles || DEFAULT_ELEMENT_STYLES;

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-6 backdrop-blur-[2px]">
      <div className="bg-paper rounded-[var(--radius-ui)] shadow-2xl border border-rule max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-[var(--radius-ui)] bg-ink text-paper shadow-sm">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-ink uppercase tracking-widest">
                Script Configuration
              </h2>
              <p className="text-[10px] text-graphite/60 font-bold uppercase tracking-tighter mt-0.5">
                Formatting, Typography & Production Tokens
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-[var(--radius-ui)] text-graphite hover:text-ink hover:bg-neutral-100 transition-all cursor-pointer border-none bg-transparent"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Content with Sidebar Categories */}
        <div className="flex flex-1 overflow-hidden min-h-[480px]">
          {/* Category Tabs Sidebar */}
          <div className="w-64 border-r border-rule bg-panel/60 p-4 space-y-1.5 flex-shrink-0">
            <div className="px-3 pb-2 text-[10px] font-bold text-graphite opacity-50 uppercase tracking-widest">Layout</div>
            <button
              onClick={() => setActiveTab('elements')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-ui)] text-[12px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                activeTab === 'elements'
                  ? 'bg-paper text-editor-red shadow-xs border-rule border-l-2 border-l-editor-red'
                  : 'text-graphite hover:text-ink hover:bg-panel/40 border-transparent'
              }`}
            >
              <Sliders className="w-4 h-4 opacity-80" />
              <span>Element Styles</span>
            </button>

            <button
              onClick={() => setActiveTab('colors')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-ui)] text-[12px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                activeTab === 'colors'
                  ? 'bg-paper text-editor-red shadow-xs border-rule border-l-2 border-l-editor-red'
                  : 'text-graphite hover:text-ink hover:bg-panel/40 border-transparent'
              }`}
            >
              <Palette className="w-4 h-4 opacity-80" />
              <span>Colors</span>
            </button>

            <button
              onClick={() => setActiveTab('typography')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-ui)] text-[12px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                activeTab === 'typography'
                  ? 'bg-paper text-editor-red shadow-xs border-rule border-l-2 border-l-editor-red'
                  : 'text-graphite hover:text-ink hover:bg-panel/40 border-transparent'
              }`}
            >
              <Type className="w-4 h-4 opacity-80" />
              <span>Typography</span>
            </button>

            <button
              onClick={() => setActiveTab('geometry')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-ui)] text-[12px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                activeTab === 'geometry'
                  ? 'bg-paper text-editor-red shadow-xs border-rule border-l-2 border-l-editor-red'
                  : 'text-graphite hover:text-ink hover:bg-panel/40 border-transparent'
              }`}
            >
              <Layout className="w-4 h-4 opacity-60" />
              <span>Geometry</span>
            </button>

            <div className="px-3 pt-4 pb-2 text-[10px] font-bold text-graphite opacity-50 uppercase tracking-widest">Metadata</div>
            <button
              onClick={() => setActiveTab('titlePage')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-ui)] text-[12px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                activeTab === 'titlePage'
                  ? 'bg-paper text-editor-red shadow-xs border-rule border-l-2 border-l-editor-red'
                  : 'text-graphite hover:text-ink hover:bg-panel/40 border-transparent'
              }`}
            >
              <Heading className="w-4 h-4 opacity-80" />
              <span>Title Page</span>
            </button>

            <button
              onClick={() => setActiveTab('production')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-ui)] text-[12px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                activeTab === 'production'
                  ? 'bg-paper text-editor-red shadow-xs border-rule border-l-2 border-l-editor-red'
                  : 'text-graphite hover:text-ink hover:bg-panel/40 border-transparent'
              }`}
            >
              <FileText className="w-4 h-4 opacity-80" />
              <span>Production</span>
            </button>

            <div className="px-3 pt-4 pb-2 text-[10px] font-bold text-graphite opacity-50 uppercase tracking-widest">System</div>
            <button
              onClick={() => setActiveTab('project')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-ui)] text-[12px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                activeTab === 'project'
                  ? 'bg-paper text-editor-red shadow-xs border-rule border-l-2 border-l-editor-red'
                  : 'text-graphite hover:text-ink hover:bg-panel/40 border-transparent'
              }`}
            >
              <Sparkles className="w-4 h-4 opacity-60" />
              <span>Studio Hub</span>
            </button>
          </div>

          {/* Active Category Panel Body */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Category 1: Element Customizations */}
            {activeTab === 'elements' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-neutral-700" />
                    Element Formatting Options
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Customize alignment, margins, line spacing, font styles, and Enter key navigation per element type.
                  </p>
                </div>

                <div className="space-y-4">
                  {(Object.keys(ELEMENT_LABELS) as ScreenplayElementType[]).map((elemKey) => {
                    const info = ELEMENT_LABELS[elemKey];
                    const cfg = currentElementStyles[elemKey] || DEFAULT_ELEMENT_STYLES[elemKey];

                    return (
                      <div
                        key={elemKey}
                        className="p-4 border border-neutral-200 rounded-lg bg-neutral-50/50 hover:bg-white hover:border-neutral-300 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-neutral-900">{info.label}</span>
                            <span className="text-[11px] text-neutral-400 block">{info.description}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Font Weight */}
                            <button
                              onClick={() =>
                                updateElementStyle(
                                  elemKey,
                                  'fontWeight',
                                  cfg.fontWeight === 'bold' ? 'normal' : 'bold'
                                )
                              }
                              className={`px-2 py-1 text-xs rounded border cursor-pointer font-bold transition-all ${
                                cfg.fontWeight === 'bold'
                                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                              }`}
                              title="Bold"
                            >
                              B
                            </button>

                            {/* Italics */}
                            <button
                              onClick={() =>
                                updateElementStyle(
                                  elemKey,
                                  'fontStyle',
                                  cfg.fontStyle === 'italic' ? 'normal' : 'italic'
                                )
                              }
                              className={`px-2 py-1 text-xs rounded border cursor-pointer italic transition-all ${
                                cfg.fontStyle === 'italic'
                                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                              }`}
                              title="Italics"
                            >
                              I
                            </button>

                            {/* Underline */}
                            <button
                              onClick={() =>
                                updateElementStyle(
                                  elemKey,
                                  'textDecoration',
                                  cfg.textDecoration === 'underline' ? 'none' : 'underline'
                                )
                              }
                              className={`px-2 py-1 text-xs rounded border cursor-pointer underline transition-all ${
                                cfg.textDecoration === 'underline'
                                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                              }`}
                              title="Underline"
                            >
                              U
                            </button>

                            {/* Uppercase Toggle */}
                            <button
                              onClick={() =>
                                updateElementStyle(elemKey, 'uppercase', !cfg.uppercase)
                              }
                              className={`px-2.5 py-1 text-[11px] rounded border cursor-pointer font-mono font-semibold transition-all ${
                                cfg.uppercase
                                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                              }`}
                              title="Toggle Uppercase"
                            >
                              AA
                            </button>
                          </div>
                        </div>

                        {/* Extended Controls Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-neutral-200/60 text-xs">
                          {/* Alignment */}
                          <div>
                            <span className="text-[10px] font-semibold text-neutral-500 block mb-1">Alignment</span>
                            <select
                              value={cfg.align || 'left'}
                              onChange={(e) => updateElementStyle(elemKey, 'align', e.target.value)}
                              className="w-full px-2 py-1 border border-neutral-300 rounded text-xs bg-white focus:outline-none"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>

                          {/* Line Spacing */}
                          <div>
                            <span className="text-[10px] font-semibold text-neutral-500 block mb-1">Line Spacing</span>
                            <select
                              value={cfg.lineSpacing ?? 1}
                              onChange={(e) => updateElementStyle(elemKey, 'lineSpacing', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 border border-neutral-300 rounded text-xs bg-white focus:outline-none"
                            >
                              <option value={1}>Single (1.0)</option>
                              <option value={1.5}>1.5 Lines</option>
                              <option value={2}>Double (2.0)</option>
                            </select>
                          </div>

                          {/* Space Before */}
                          <div>
                            <span className="text-[10px] font-semibold text-neutral-500 block mb-1">Space Before</span>
                            <select
                              value={cfg.spaceBefore ?? 0}
                              onChange={(e) => updateElementStyle(elemKey, 'spaceBefore', parseInt(e.target.value, 10))}
                              className="w-full px-2 py-1 border border-neutral-300 rounded text-xs bg-white focus:outline-none"
                            >
                              <option value={0}>0 Blank Lines</option>
                              <option value={1}>1 Blank Line</option>
                              <option value={2}>2 Blank Lines</option>
                            </select>
                          </div>

                          {/* Next Element On Enter */}
                          <div>
                            <span className="text-[10px] font-semibold text-neutral-500 block mb-1">Next Element (Enter)</span>
                            <select
                              value={cfg.nextElementType || 'action'}
                              onChange={(e) => updateElementStyle(elemKey, 'nextElementType', e.target.value)}
                              className="w-full px-2 py-1 border border-neutral-300 rounded text-xs bg-white focus:outline-none"
                            >
                              {(Object.keys(ELEMENT_LABELS) as ScreenplayElementType[]).map((type) => (
                                <option key={type} value={type}>
                                  {ELEMENT_LABELS[type].label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Left Margin / Indent */}
                          <div>
                            <span className="text-[10px] font-semibold text-neutral-500 block mb-1">Left Margin (Inches)</span>
                            <input
                              type="number"
                              step="0.1"
                              value={cfg.leftMarginIn ?? 1.5}
                              onChange={(e) => updateElementStyle(elemKey, 'leftMarginIn', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 border border-neutral-300 rounded text-xs bg-white focus:outline-none"
                            />
                          </div>

                          {/* Right Margin / Indent */}
                          <div>
                            <span className="text-[10px] font-semibold text-neutral-500 block mb-1">Right Margin (Inches)</span>
                            <input
                              type="number"
                              step="0.1"
                              value={cfg.rightMarginIn ?? 1.0}
                              onChange={(e) => updateElementStyle(elemKey, 'rightMarginIn', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 border border-neutral-300 rounded text-xs bg-white focus:outline-none"
                            />
                          </div>

                          {/* Font Family (Optional) */}
                          <div>
                            <span className="text-[10px] font-semibold text-neutral-500 block mb-1">Font Family</span>
                            <input
                              type="text"
                              placeholder="Default Monospace"
                              value={cfg.fontFamily || ''}
                              onChange={(e) => updateElementStyle(elemKey, 'fontFamily', e.target.value)}
                              className="w-full px-2 py-1 border border-neutral-300 rounded text-xs bg-white focus:outline-none font-mono"
                            />
                          </div>

                          {/* Text Color (Optional) */}
                          <div>
                            <span className="text-[10px] font-semibold text-neutral-500 block mb-1">Element Color</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={cfg.color || '#2b2a28'}
                                onChange={(e) => updateElementStyle(elemKey, 'color', e.target.value)}
                                className="w-6 h-6 rounded border border-neutral-300 cursor-pointer p-0"
                              />
                              <input
                                type="text"
                                value={cfg.color || ''}
                                placeholder="Default"
                                onChange={(e) => updateElementStyle(elemKey, 'color', e.target.value)}
                                className="w-full px-1.5 py-1 border border-neutral-300 rounded text-xs bg-white font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Element Preview Card */}
                <div className="p-4 border border-neutral-200 rounded-lg bg-white shadow-2xs space-y-2">
                  <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                    Live Element Preview
                  </div>
                  <div
                    className="space-y-1 text-xs leading-relaxed text-neutral-900"
                    style={{ fontFamily: getPreviewFontFamily(localSettings.fontFamily) }}
                  >
                    {/* Scene Heading */}
                    <div
                      style={{
                        fontWeight: currentElementStyles.sceneHeading.fontWeight,
                        fontStyle: currentElementStyles.sceneHeading.fontStyle,
                        textDecoration: currentElementStyles.sceneHeading.textDecoration,
                        textTransform: currentElementStyles.sceneHeading.uppercase ? 'uppercase' : 'none',
                      }}
                    >
                      INT. COFFEE SHOP - DAY
                    </div>

                    {/* Action */}
                    <div
                      style={{
                        fontWeight: currentElementStyles.action.fontWeight,
                        fontStyle: currentElementStyles.action.fontStyle,
                        textDecoration: currentElementStyles.action.textDecoration,
                        textTransform: currentElementStyles.action.uppercase ? 'uppercase' : 'none',
                      }}
                    >
                      Morning light pours through the floor-to-ceiling windows.
                    </div>

                    {/* Character */}
                    <div
                      className="text-center"
                      style={{
                        fontWeight: currentElementStyles.character.fontWeight,
                        fontStyle: currentElementStyles.character.fontStyle,
                        textDecoration: currentElementStyles.character.textDecoration,
                        textTransform: currentElementStyles.character.uppercase ? 'uppercase' : 'none',
                      }}
                    >
                      MARCUS
                    </div>

                    {/* Parenthetical */}
                    <div
                      className="text-center"
                      style={{
                        fontWeight: currentElementStyles.parenthetical.fontWeight,
                        fontStyle: currentElementStyles.parenthetical.fontStyle,
                        textDecoration: currentElementStyles.parenthetical.textDecoration,
                        textTransform: currentElementStyles.parenthetical.uppercase ? 'uppercase' : 'none',
                      }}
                    >
                      (grinning warmly)
                    </div>

                    {/* Dialogue */}
                    <div
                      className="max-w-xs mx-auto text-center"
                      style={{
                        fontWeight: currentElementStyles.dialogue.fontWeight,
                        fontStyle: currentElementStyles.dialogue.fontStyle,
                        textDecoration: currentElementStyles.dialogue.textDecoration,
                        textTransform: currentElementStyles.dialogue.uppercase ? 'uppercase' : 'none',
                      }}
                    >
                      We made it right on time.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category: Custom Page & UI Colors */}
            {activeTab === 'colors' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-neutral-700" />
                    Page Layout & Custom Colors
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Configure display colors for canvas background, virtual script pages, body text, and non-printing invisibles.
                  </p>
                </div>

                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer pb-2 border-b border-neutral-200">
                    <input
                      type="checkbox"
                      checked={Boolean(localSettings.colors?.useSystemColors)}
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          colors: {
                            ...(prev.colors || DEFAULT_COLOR_SETTINGS),
                            useSystemColors: e.target.checked,
                          },
                        }))
                      }
                      className="rounded text-neutral-900 focus:ring-neutral-900 w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">Use System Colors</span>
                      <span className="text-[11px] text-neutral-500 block">
                        Fallback to system and high-contrast defaults.
                      </span>
                    </div>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Background Color */}
                    <div className="bg-white p-3 rounded border border-neutral-200 space-y-1.5">
                      <span className="text-xs font-bold text-neutral-800 block">Canvas Background Color</span>
                      <span className="text-[10px] text-neutral-500 block mb-2">Outer container in Page View mode.</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={localSettings.colors?.backgroundColor || '#f3f4f6'}
                          onChange={(e) =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              colors: {
                                ...(prev.colors || DEFAULT_COLOR_SETTINGS),
                                backgroundColor: e.target.value,
                              },
                            }))
                          }
                          disabled={Boolean(localSettings.colors?.useSystemColors)}
                          className="w-8 h-8 rounded border border-neutral-300 cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={localSettings.colors?.backgroundColor || '#f3f4f6'}
                          onChange={(e) =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              colors: {
                                ...(prev.colors || DEFAULT_COLOR_SETTINGS),
                                backgroundColor: e.target.value,
                              },
                            }))
                          }
                          disabled={Boolean(localSettings.colors?.useSystemColors)}
                          className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs font-mono bg-white"
                        />
                      </div>
                    </div>

                    {/* Paper/Page Color */}
                    <div className="bg-white p-3 rounded border border-neutral-200 space-y-1.5">
                      <span className="text-xs font-bold text-neutral-800 block">Paper / Page Color</span>
                      <span className="text-[10px] text-neutral-500 block mb-2">Background color of screenplay pages.</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={localSettings.colors?.paperColor || '#ffffff'}
                          onChange={(e) =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              colors: {
                                ...(prev.colors || DEFAULT_COLOR_SETTINGS),
                                paperColor: e.target.value,
                              },
                            }))
                          }
                          disabled={Boolean(localSettings.colors?.useSystemColors)}
                          className="w-8 h-8 rounded border border-neutral-300 cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={localSettings.colors?.paperColor || '#ffffff'}
                          onChange={(e) =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              colors: {
                                ...(prev.colors || DEFAULT_COLOR_SETTINGS),
                                paperColor: e.target.value,
                              },
                            }))
                          }
                          disabled={Boolean(localSettings.colors?.useSystemColors)}
                          className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs font-mono bg-white"
                        />
                      </div>
                    </div>

                    {/* Text Color */}
                    <div className="bg-white p-3 rounded border border-neutral-200 space-y-1.5">
                      <span className="text-xs font-bold text-neutral-800 block">Default Text Color</span>
                      <span className="text-[10px] text-neutral-500 block mb-2">Primary screenplay body font color.</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={localSettings.colors?.textColor || '#2b2a28'}
                          onChange={(e) =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              colors: {
                                ...(prev.colors || DEFAULT_COLOR_SETTINGS),
                                textColor: e.target.value,
                              },
                            }))
                          }
                          disabled={Boolean(localSettings.colors?.useSystemColors)}
                          className="w-8 h-8 rounded border border-neutral-300 cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={localSettings.colors?.textColor || '#2b2a28'}
                          onChange={(e) =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              colors: {
                                ...(prev.colors || DEFAULT_COLOR_SETTINGS),
                                textColor: e.target.value,
                              },
                            }))
                          }
                          disabled={Boolean(localSettings.colors?.useSystemColors)}
                          className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs font-mono bg-white"
                        />
                      </div>
                    </div>

                    {/* Invisibles Color */}
                    <div className="bg-white p-3 rounded border border-neutral-200 space-y-1.5">
                      <span className="text-xs font-bold text-neutral-800 block">Invisibles Color</span>
                      <span className="text-[10px] text-neutral-500 block mb-2">Color for non-printing markers and guides.</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={localSettings.colors?.invisiblesColor || '#94918c'}
                          onChange={(e) =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              colors: {
                                ...(prev.colors || DEFAULT_COLOR_SETTINGS),
                                invisiblesColor: e.target.value,
                              },
                            }))
                          }
                          disabled={Boolean(localSettings.colors?.useSystemColors)}
                          className="w-8 h-8 rounded border border-neutral-300 cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={localSettings.colors?.invisiblesColor || '#94918c'}
                          onChange={(e) =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              colors: {
                                ...(prev.colors || DEFAULT_COLOR_SETTINGS),
                                invisiblesColor: e.target.value,
                              },
                            }))
                          }
                          disabled={Boolean(localSettings.colors?.useSystemColors)}
                          className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs font-mono bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category 2: Typography & Paper */}
            {activeTab === 'typography' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-neutral-700" />
                    Typography & Document Paper
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Select the font family and standard paper format for editor display and PDF exports.
                  </p>
                </div>

                {/* Font Family Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-700 block">Font Family</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { id: 'courier_prime', name: 'Courier Prime', note: '10 CPI Industry Standard' },
                      { id: 'courier_new', name: 'Courier New', note: 'Classic Monospace' },
                      { id: 'pt_mono', name: 'PT Mono', note: 'Extended Cyrillic Support' },
                      { id: 'times', name: 'Times New Roman', note: 'Serif Classic' },
                      { id: 'georgia', name: 'Georgia', note: 'Elegantly Spaced Serif' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => updateField('fontFamily', f.id as FontFamilyOption)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-start justify-between ${
                          localSettings.fontFamily === f.id
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                            : 'bg-white text-neutral-800 border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div>
                          <span
                            className="text-sm font-medium block"
                            style={{ fontFamily: getPreviewFontFamily(f.id as FontFamilyOption) }}
                          >
                            {f.name}
                          </span>
                          <span
                            className={`text-[11px] block mt-0.5 ${
                              localSettings.fontFamily === f.id ? 'text-neutral-300' : 'text-neutral-400'
                            }`}
                          >
                            {f.note}
                          </span>
                        </div>
                        {localSettings.fontFamily === f.id && <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paper Format */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-700 block">Paper Page Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateField('paperFormat', 'US_LETTER')}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                        localSettings.paperFormat === 'US_LETTER'
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                          : 'bg-white text-neutral-800 border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold block">US Letter</span>
                        <span className={`text-[11px] block ${localSettings.paperFormat === 'US_LETTER' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                          8.5 × 11 inches (Hollywood standard)
                        </span>
                      </div>
                      {localSettings.paperFormat === 'US_LETTER' && <Check className="w-4 h-4 text-white" />}
                    </button>

                    <button
                      onClick={() => updateField('paperFormat', 'A4')}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                        localSettings.paperFormat === 'A4'
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                          : 'bg-white text-neutral-800 border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold block">A4</span>
                        <span className={`text-[11px] block ${localSettings.paperFormat === 'A4' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                          210 × 297 mm (International)
                        </span>
                      </div>
                      {localSettings.paperFormat === 'A4' && <Check className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Category 3: Title Cover Page */}
            {activeTab === 'titlePage' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                      <Heading className="w-4 h-4 text-neutral-700" />
                      Title Cover Page Information
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Configure cover details to be automatically formatted and included in PDF exports.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.titlePage?.showTitlePage ?? true}
                      onChange={(e) => updateTitlePage('showTitlePage', e.target.checked)}
                      className="rounded text-neutral-900 focus:ring-neutral-900 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-neutral-800">Include Title Page</span>
                  </label>
                </div>

                {localSettings.titlePage?.showTitlePage && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 p-4 border border-neutral-200 rounded-lg">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">
                        Screenplay Title
                      </label>
                      <input
                        type="text"
                        value={localSettings.titlePage?.title || ''}
                        onChange={(e) => updateTitlePage('title', e.target.value)}
                        placeholder="e.g. THE GREAT ESCAPE"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">
                        Subtitle
                      </label>
                      <input
                        type="text"
                        value={localSettings.titlePage?.subtitle || ''}
                        onChange={(e) => updateTitlePage('subtitle', e.target.value)}
                        placeholder="e.g. An Original Screenplay"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">
                        Written By
                      </label>
                      <input
                        type="text"
                        value={localSettings.titlePage?.writtenBy || ''}
                        onChange={(e) => updateTitlePage('writtenBy', e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">
                        Based On (Optional)
                      </label>
                      <input
                        type="text"
                        value={localSettings.titlePage?.basedOn || ''}
                        onChange={(e) => updateTitlePage('basedOn', e.target.value)}
                        placeholder="e.g. Based on the novel by..."
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">
                        Draft Date / Revision
                      </label>
                      <input
                        type="text"
                        value={localSettings.titlePage?.draftDate || ''}
                        onChange={(e) => updateTitlePage('draftDate', e.target.value)}
                        placeholder="e.g. September 2026 / First Draft"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">
                        Contact / Representation Details
                      </label>
                      <textarea
                        rows={2}
                        value={localSettings.titlePage?.contactInfo || ''}
                        onChange={(e) => updateTitlePage('contactInfo', e.target.value)}
                        placeholder="e.g. Agency Name / Phone / Email"
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Category 4: Geometry & Margins */}
            {activeTab === 'geometry' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                    <Layout className="w-4 h-4 text-neutral-700" />
                    Page Numbers & Margins
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Configure page numbers and standard inch margin dimensions.
                  </p>
                </div>

                <div className="space-y-3 bg-neutral-50 p-4 border border-neutral-200 rounded-lg">
                  <h4 className="text-xs font-bold text-neutral-900 border-b border-neutral-200 pb-1.5 mb-2">
                    Page Numbers
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.showPageNumbers}
                      onChange={(e) => updateField('showPageNumbers', e.target.checked)}
                      className="rounded text-neutral-900 focus:ring-neutral-900 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-neutral-800">Show Page Numbers</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.firstPageNumberSuppressed}
                      onChange={(e) => updateField('firstPageNumberSuppressed', e.target.checked)}
                      className="rounded text-neutral-900 focus:ring-neutral-900 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-neutral-800">
                      Suppress Page Number on Page 1 (Standard Industry Rule)
                    </span>
                  </label>
                </div>

                <div className="space-y-3 bg-neutral-50 p-4 border border-neutral-200 rounded-lg">
                  <h4 className="text-xs font-bold text-neutral-900 border-b border-neutral-200 pb-1.5 mb-2">
                    Scene Numbers
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.showSceneNumbers ?? true}
                      onChange={(e) => updateField('showSceneNumbers', e.target.checked)}
                      className="rounded text-neutral-900 focus:ring-neutral-900 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-neutral-800">Display Scene Numbers</span>
                  </label>

                  {localSettings.showSceneNumbers !== false && (
                    <div className="pt-2">
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">
                        Scene Number Placement
                      </label>
                      <select
                        value={localSettings.sceneNumberPosition || 'both'}
                        onChange={(e) => updateField('sceneNumberPosition', e.target.value as any)}
                        className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                      >
                        <option value="both">Both Left & Right Margins (Industry Standard)</option>
                        <option value="left">Left Margin Only</option>
                        <option value="right">Right Margin Only</option>
                        <option value="none">Hidden</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-neutral-700 block">
                    Page Margins (Inches)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[11px] text-neutral-500 block mb-1">Left Margin</span>
                      <input
                        type="number"
                        step="0.1"
                        value={localSettings.leftMarginIn}
                        onChange={(e) => updateField('leftMarginIn', parseFloat(e.target.value) || 1.5)}
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] text-neutral-500 block mb-1">Right Margin</span>
                      <input
                        type="number"
                        step="0.1"
                        value={localSettings.rightMarginIn}
                        onChange={(e) => updateField('rightMarginIn', parseFloat(e.target.value) || 1.0)}
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] text-neutral-500 block mb-1">Top Margin</span>
                      <input
                        type="number"
                        step="0.1"
                        value={localSettings.topMarginIn}
                        onChange={(e) => updateField('topMarginIn', parseFloat(e.target.value) || 1.0)}
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] text-neutral-500 block mb-1">Bottom Margin</span>
                      <input
                        type="number"
                        step="0.1"
                        value={localSettings.bottomMarginIn}
                        onChange={(e) => updateField('bottomMarginIn', parseFloat(e.target.value) || 1.0)}
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category 5: Production, More & Continueds, Headers & Footers */}
            {activeTab === 'production' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-neutral-700" />
                    Production Settings & Headers
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Configure page-break continuation markers and running headers/footers for Page View.
                  </p>
                </div>

                {/* More & Continueds */}
                <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60">
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">
                        Mores & Continueds Configuration
                      </span>
                      <span className="text-[11px] text-neutral-500 block mt-0.5">
                        Industry standard dialogue split tags, character continueds, and scene boundary markers.
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-neutral-700 font-medium cursor-pointer">
                      <span>Enable System</span>
                      <input
                        type="checkbox"
                        checked={localSettings.showMoreAndContd !== false}
                        onChange={(e) => updateField('showMoreAndContd', e.target.checked)}
                        className="rounded text-neutral-900 focus:ring-neutral-900 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Dialogue Page Break Settings */}
                  <div className="space-y-3 pt-1">
                    <span className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider block">
                      Dialogue Splits Across Page Breaks
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white p-2.5 rounded border border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-neutral-800">Bottom of Page (MORE)</span>
                          <input
                            type="checkbox"
                            checked={localSettings.dialogueMoreBottomEnabled !== false}
                            onChange={(e) => updateField('dialogueMoreBottomEnabled', e.target.checked)}
                            className="rounded text-neutral-900 focus:ring-neutral-900 w-3.5 h-3.5 cursor-pointer"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 block mb-1">Marker Text</span>
                          <input
                            type="text"
                            value={localSettings.dialogueMoreText ?? '(MORE)'}
                            onChange={(e) => updateField('dialogueMoreText', e.target.value)}
                            disabled={localSettings.dialogueMoreBottomEnabled === false}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded font-mono uppercase bg-white disabled:bg-neutral-100 disabled:text-neutral-400"
                          />
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded border border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-neutral-800">Top of Page (CONT'D)</span>
                          <input
                            type="checkbox"
                            checked={localSettings.dialogueContdTopEnabled !== false}
                            onChange={(e) => updateField('dialogueContdTopEnabled', e.target.checked)}
                            className="rounded text-neutral-900 focus:ring-neutral-900 w-3.5 h-3.5 cursor-pointer"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 block mb-1">Marker Text</span>
                          <input
                            type="text"
                            value={localSettings.dialogueContdText ?? "(CONT'D)"}
                            onChange={(e) => updateField('dialogueContdText', e.target.value)}
                            disabled={localSettings.dialogueContdTopEnabled === false}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded font-mono uppercase bg-white disabled:bg-neutral-100 disabled:text-neutral-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Character Continueds */}
                  <div className="pt-2 border-t border-neutral-200/60">
                    <label className="flex items-start justify-between gap-2 cursor-pointer">
                      <div>
                        <span className="text-xs font-semibold text-neutral-800 block">Automatic Character Continueds</span>
                        <span className="text-[11px] text-neutral-500 block mt-0.5">
                          Automatically appends (CONT'D) when the same character speaks consecutively across intervening action or parentheticals.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={localSettings.automaticCharacterContinueds !== false}
                        onChange={(e) => updateField('automaticCharacterContinueds', e.target.checked)}
                        className="rounded text-neutral-900 focus:ring-neutral-900 w-4 h-4 cursor-pointer mt-0.5 shrink-0"
                      />
                    </label>
                  </div>

                  {/* Scene Break Continueds */}
                  <div className="space-y-3 pt-2 border-t border-neutral-200/60">
                    <span className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider block">
                      Scene Breaks Across Pages
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white p-2.5 rounded border border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-neutral-800">Scene Break (Bottom)</span>
                          <input
                            type="checkbox"
                            checked={Boolean(localSettings.sceneContinuedBottomEnabled)}
                            onChange={(e) => updateField('sceneContinuedBottomEnabled', e.target.checked)}
                            className="rounded text-neutral-900 focus:ring-neutral-900 w-3.5 h-3.5 cursor-pointer"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 block mb-1">Bottom Marker</span>
                          <input
                            type="text"
                            value={localSettings.sceneContinuedBottomText ?? '(CONTINUED)'}
                            onChange={(e) => updateField('sceneContinuedBottomText', e.target.value)}
                            disabled={!localSettings.sceneContinuedBottomEnabled}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded font-mono uppercase bg-white disabled:bg-neutral-100 disabled:text-neutral-400"
                          />
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded border border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-neutral-800">Scene Continued (Top)</span>
                          <input
                            type="checkbox"
                            checked={Boolean(localSettings.sceneContinuedTopEnabled)}
                            onChange={(e) => updateField('sceneContinuedTopEnabled', e.target.checked)}
                            className="rounded text-neutral-900 focus:ring-neutral-900 w-3.5 h-3.5 cursor-pointer"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 block mb-1">Top Marker</span>
                          <input
                            type="text"
                            value={localSettings.sceneContinuedTopText ?? 'CONTINUED:'}
                            onChange={(e) => updateField('sceneContinuedTopText', e.target.value)}
                            disabled={!localSettings.sceneContinuedTopEnabled}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded font-mono uppercase bg-white disabled:bg-neutral-100 disabled:text-neutral-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CONTINUED (#) checkbox */}
                    <div className="pt-2 border-t border-neutral-200/60">
                      <label className="flex items-center justify-between gap-2 cursor-pointer">
                        <div>
                          <span className="text-xs font-semibold text-neutral-800 block">CONTINUED (#) - Append Scene Number</span>
                          <span className="text-[11px] text-neutral-500 block mt-0.5">
                            Appends the active scene number to continuation markers (e.g. CONTINUED: (2) or (CONTINUED) (2)).
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={localSettings.sceneContinuedNumberEnabled !== false}
                          onChange={(e) => updateField('sceneContinuedNumberEnabled', e.target.checked)}
                          className="rounded text-neutral-900 focus:ring-neutral-900 w-4 h-4 cursor-pointer mt-0.5 shrink-0"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Header Controls */}
                <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                  <div>
                    <span className="text-xs font-bold text-neutral-900 block">
                      Running Header (Page View)
                    </span>
                    <span className="text-[11px] text-neutral-500 block mt-0.5">
                      Styled with a subtle muted grey font (#888) in Page View mode.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] text-neutral-600 block mb-1 font-medium">Header Left</span>
                      <input
                        type="text"
                        placeholder="e.g. TITLE / EPISODE"
                        value={localSettings.headerLeft || ''}
                        onChange={(e) => updateField('headerLeft', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-neutral-600 block mb-1 font-medium">Header Right</span>
                      <input
                        type="text"
                        placeholder="e.g. DRAFT DATE or WRITER"
                        value={localSettings.headerRight || ''}
                        onChange={(e) => updateField('headerRight', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={!localSettings.showHeaderOnFirstPage}
                      onChange={(e) => updateField('showHeaderOnFirstPage', !e.target.checked)}
                      className="rounded text-neutral-900 focus:ring-neutral-900 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-xs text-neutral-700 font-medium">
                      Suppress header on first page
                    </span>
                  </label>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
                  <div>
                    <span className="text-xs font-bold text-neutral-900 block">
                      Running Footer (Page View)
                    </span>
                    <span className="text-[11px] text-neutral-500 block mt-0.5">
                      Styled with a subtle muted grey font (#888) at the bottom of each page.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] text-neutral-600 block mb-1 font-medium">Footer Left</span>
                      <input
                        type="text"
                        placeholder="e.g. CONFIDENTIAL"
                        value={localSettings.footerLeft || ''}
                        onChange={(e) => updateField('footerLeft', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-neutral-600 block mb-1 font-medium">Footer Right</span>
                      <input
                        type="text"
                        placeholder="e.g. STUDIO CONTACT"
                        value={localSettings.footerRight || ''}
                        onChange={(e) => updateField('footerRight', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 font-mono"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={!localSettings.showFooterOnFirstPage}
                      onChange={(e) => updateField('showFooterOnFirstPage', !e.target.checked)}
                      className="rounded text-neutral-900 focus:ring-neutral-900 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-xs text-neutral-700 font-medium">
                      Suppress footer on first page
                    </span>
                  </label>
                </div>
              </div>
            )}
            {activeTab === 'project' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-neutral-700" />
                    Project Management
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Switch between projects or return to the Studio Hub for templates and quick starters.
                  </p>
                </div>

                <div className="p-4 border border-blue-100 rounded-xl bg-blue-50/30 flex flex-col items-center text-center gap-4">
                  <div className="p-3 rounded-full bg-white shadow-sm border border-blue-50">
                    <Sparkles className="w-8 h-8 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900">Studio Hub</h4>
                    <p className="text-xs text-neutral-500 mt-1 max-w-[280px]">
                      Access your project dashboard, sample scripts, and quick start templates.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onOpenHub?.();
                      onClose();
                    }}
                    className="px-6 py-2 bg-neutral-900 text-white rounded-lg text-xs font-bold shadow-md hover:bg-neutral-800 transition-all cursor-pointer"
                  >
                    Open Studio Hub
                  </button>
                </div>

                <div className="pt-4 border-t border-neutral-100">
                  <p className="text-[10px] text-neutral-400 text-center uppercase tracking-widest font-bold">
                    Clean Studio V1.0
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-5 border-t border-rule bg-neutral-50/40 flex items-center justify-between">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-graphite hover:text-editor-red transition-all cursor-pointer border-none bg-transparent"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-graphite hover:text-ink transition-all cursor-pointer border-none bg-transparent"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-8 py-2.5 bg-editor-red hover:bg-[#822F2A] text-white rounded-[var(--radius-ui)] text-[11px] font-bold uppercase tracking-widest shadow-md transition-all cursor-pointer border-none"
            >
              <Check className="w-4 h-4" />
              <span>Apply Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
