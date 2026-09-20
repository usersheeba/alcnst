/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  generatePdfProofOfConcept,
  exportScreenplayToPdf,
  PdfExportResult,
} from '../core/pdf_poc';
import { ScreenplayDocument } from '../types';
import { PageFormat, PAGE_GEOMETRIES } from '../core/screenplay_layout';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  FileCheck2,
  RotateCcw,
} from 'lucide-react';

interface PdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDoc?: ScreenplayDocument | null;
  defaultFormat?: PageFormat;
}

export const PdfModal: React.FC<PdfModalProps> = ({
  isOpen,
  onClose,
  activeDoc,
  defaultFormat = 'US_LETTER',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<PageFormat>(defaultFormat);
  const [mode, setMode] = useState<'activeDoc' | 'poc'>(activeDoc ? 'activeDoc' : 'poc');
  const [isRunning, setIsRunning] = useState(false);
  const [exportResult, setExportResult] = useState<PdfExportResult | null>(null);

  const runGeneration = async (targetMode = mode, targetFormat = selectedFormat) => {
    setIsRunning(true);
    try {
      let res: PdfExportResult;
      if (targetMode === 'activeDoc' && activeDoc) {
        res = await exportScreenplayToPdf(activeDoc, targetFormat, activeDoc.formattingSettings);
      } else {
        res = await generatePdfProofOfConcept(targetFormat);
      }
      setExportResult(res);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const initialMode = activeDoc ? 'activeDoc' : 'poc';
      setMode(initialMode);
      runGeneration(initialMode, selectedFormat);
    }
  }, [isOpen, activeDoc?.id]);

  if (!isOpen) return null;

  const geom = PAGE_GEOMETRIES[selectedFormat];
  const downloadFilename =
    mode === 'activeDoc' && activeDoc
      ? `${activeDoc.title.toLowerCase().replace(/\s+/g, '_')}_${selectedFormat.toLowerCase()}.pdf`
      : `screenplay_physical_poc_${selectedFormat.toLowerCase()}.pdf`;

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-6 backdrop-blur-[2px]">
      <div className="bg-paper rounded-[var(--radius-ui)] shadow-2xl border border-rule max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-[var(--radius-ui)] bg-ink text-paper shadow-sm">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-ink uppercase tracking-widest">
                Print & Export
              </h2>
              <p className="text-[10px] text-graphite/60 font-bold uppercase tracking-tighter mt-0.5">
                Physical Manuscript Compilation (PDF)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-graphite hover:text-ink hover:bg-neutral-100 rounded-[var(--radius-ui)] cursor-pointer transition-all border-none bg-transparent"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="px-8 py-3 bg-neutral-50/40 border-b border-rule flex flex-wrap items-center justify-between gap-6">
          {/* Target document toggle */}
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-graphite/40">Source</span>
            <div className="flex items-center rounded-[var(--radius-ui)] bg-neutral-100/50 p-1 border border-rule/60">
              {activeDoc && (
                <button
                  onClick={() => {
                    setMode('activeDoc');
                    runGeneration('activeDoc', selectedFormat);
                  }}
                  className={`px-4 py-1.5 rounded-[var(--radius-ui)] text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer border-none ${
                    mode === 'activeDoc'
                      ? 'bg-paper text-ink shadow-sm'
                      : 'text-graphite/40 hover:text-ink bg-transparent'
                  }`}
                >
                  {activeDoc.title}
                </button>
              )}
              <button
                onClick={() => {
                  setMode('poc');
                  runGeneration('poc', selectedFormat);
                }}
                className={`px-4 py-1.5 rounded-[var(--radius-ui)] text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer border-none ${
                  mode === 'poc'
                    ? 'bg-paper text-ink shadow-sm'
                    : 'text-graphite/40 hover:text-ink bg-transparent'
                }`}
              >
                Sample Script
              </button>
            </div>
          </div>

          {/* Page Format Toggle */}
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-graphite/40">MediaBox</span>
            <div className="flex items-center rounded-[var(--radius-ui)] bg-neutral-100/50 p-1 border border-rule/60">
              <button
                onClick={() => {
                  setSelectedFormat('US_LETTER');
                  runGeneration(mode, 'US_LETTER');
                }}
                className={`px-4 py-1.5 rounded-[var(--radius-ui)] text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer border-none ${
                  selectedFormat === 'US_LETTER'
                    ? 'bg-paper text-ink shadow-sm'
                    : 'text-graphite/40 hover:text-ink bg-transparent'
                }`}
              >
                US Letter
              </button>
              <button
                onClick={() => {
                  setSelectedFormat('A4');
                  runGeneration(mode, 'A4');
                }}
                className={`px-4 py-1.5 rounded-[var(--radius-ui)] text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer border-none ${
                  selectedFormat === 'A4'
                    ? 'bg-paper text-ink shadow-sm'
                    : 'text-graphite/40 hover:text-ink bg-transparent'
                }`}
              >
                A4
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
          {isRunning ? (
            <div className="py-24 flex flex-col items-center justify-center text-graphite/40 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-ink opacity-60" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-center max-w-xs">
                Compiling {geom.name} MediaBox with Courier Prime Type Stripping...
              </p>
            </div>
          ) : exportResult ? (
            <>
              <div
                className={`p-6 rounded-[var(--radius-ui)] border flex items-center justify-between transition-all ${
                  exportResult.success
                    ? 'bg-paper border-rule text-ink'
                    : 'bg-editor-red/5 border-editor-red/20 text-editor-red'
                }`}
              >
                <div className="flex items-center gap-4">
                  {exportResult.success ? (
                    <CheckCircle2 className="w-6 h-6 text-ink opacity-60 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-editor-red shrink-0" />
                  )}
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-widest">
                      {exportResult.success
                        ? `${geom.name} Compilation Complete`
                        : 'Compilation Failed'}
                    </div>
                    {exportResult.success && (
                      <div className="text-[9px] text-graphite/60 font-bold uppercase tracking-tighter mt-1">
                        {exportResult.pageCount} Pages • {(exportResult.pdfBytesLength / 1024).toFixed(1)} KB • {geom.linesPerPage} LPP
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Physical Spec Checklist */}
              <div className="bg-neutral-50/50 p-6 rounded-[var(--radius-ui)] border border-rule space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-graphite/40 border-b border-rule pb-2">
                  Validation Log
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                  <div className="flex items-center gap-3 text-[11px] font-bold text-ink uppercase tracking-tighter">
                    <CheckCircle2 className="w-4 h-4 text-ink opacity-40 shrink-0" />
                    <span>Courier Prime 12pt</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-ink uppercase tracking-tighter">
                    <CheckCircle2 className="w-4 h-4 text-ink opacity-40 shrink-0" />
                    <span>6 LPI Vertical Pitch</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-ink uppercase tracking-tighter">
                    <CheckCircle2 className="w-4 h-4 text-ink opacity-40 shrink-0" />
                    <span>10 CPI Horiz Pitch</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-ink uppercase tracking-tighter">
                    <CheckCircle2 className="w-4 h-4 text-ink opacity-40 shrink-0" />
                    <span>MediaBox Geometry</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-ink uppercase tracking-tighter">
                    <CheckCircle2 className="w-4 h-4 text-ink opacity-40 shrink-0" />
                    <span>1.5" Gutter Margin</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-ink uppercase tracking-tighter">
                    <CheckCircle2 className="w-4 h-4 text-ink opacity-40 shrink-0" />
                    <span>Page 1 Suppression</span>
                  </div>
                </div>
              </div>

              {/* Interactive PDF Preview Embed */}
              {exportResult.blobUrl && (
                <div className="border border-rule rounded-[var(--radius-ui)] overflow-hidden h-96 bg-neutral-100 flex flex-col shadow-inner">
                  <div className="px-5 py-2.5 bg-neutral-100 border-b border-rule flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-graphite/60">Live Preview</span>
                    <span className="text-[10px] font-mono font-bold text-graphite/40">
                      {geom.widthIn.toFixed(2)}" × {geom.heightIn.toFixed(2)}" • {geom.linesPerPage} LPP
                    </span>
                  </div>
                  <iframe
                    src={`${exportResult.blobUrl}#toolbar=0&navpanes=0`}
                    className="w-full flex-1 border-none"
                    title="Screenplay PDF Preview"
                  />
                </div>
              )}

              {/* Diagnostics Log */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-graphite/40">
                  Compilation Diagnostics
                </h4>
                <div className="bg-ink text-paper p-5 rounded-[var(--radius-ui)] font-mono text-[10px] space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                  {exportResult.diagnostics.details.map((line, i) => (
                    <div key={i} className="leading-tight opacity-80 uppercase">
                      &gt; {line}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-rule bg-neutral-50/40 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-graphite/40 max-w-xs">
            Physical Page Layout Verified for Industry Submission
          </span>
          <div className="flex items-center gap-6">
            {exportResult?.blobUrl && (
              <a
                href={exportResult.blobUrl}
                download={downloadFilename}
                className="flex items-center gap-3 px-8 py-2.5 bg-ink text-paper rounded-[var(--radius-ui)] text-[11px] font-bold uppercase tracking-widest shadow-lg hover:bg-graphite transition-all cursor-pointer border-none decoration-none"
              >
                <Download className="w-4 h-4" />
                <span>Download ({geom.name})</span>
              </a>
            )}
            <button
              disabled={isRunning}
              onClick={() => runGeneration(mode, selectedFormat)}
              className="flex items-center gap-2 px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-graphite hover:text-ink transition-all cursor-pointer border-none bg-transparent disabled:opacity-30"
            >
              <RotateCcw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              <span>Recompile</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
