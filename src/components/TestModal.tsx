/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { runAllTests, TestResult } from '../core/tests';
import { CheckCircle2, XCircle, Play, Loader2, X } from 'lucide-react';

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestModal: React.FC<TestModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<{
    allPassed: boolean;
    results: TestResult[];
  } | null>(null);

  const executeTests = async () => {
    setIsRunning(true);
    try {
      const res = await runAllTests();
      setTestResults(res);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen && !testResults) {
      executeTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              Screenplay Verification & Physical Format Test Suite
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Automated verification of keyboard state machine (Enter, Tab, Shift+Tab, Backspace, Delete, Alt+1..8) and physical Final Draft metrics (10 CPI, line capacity, margin collapsing).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {isRunning ? (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-800" />
              <p className="text-sm font-medium">Executing semantic invariant tests...</p>
            </div>
          ) : testResults ? (
            <>
              <div
                className={`p-3.5 rounded-lg border flex items-center justify-between text-sm ${
                  testResults.allPassed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {testResults.allPassed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span>
                    {testResults.allPassed
                      ? 'All Phase 1 Verification Tests Passed'
                      : 'Some Tests Failed'}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 font-mono font-bold">
                  {testResults.results.filter((r) => r.passed).length} /{' '}
                  {testResults.results.length} Passed
                </span>
              </div>

              <div className="space-y-2 pt-2">
                {testResults.results.map((r, i) => (
                  <div
                    key={i}
                    className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 flex items-start gap-3 text-xs"
                  >
                    {r.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-neutral-900">{r.name}</div>
                      <div className="text-neutral-600 mt-0.5 leading-relaxed">
                        {r.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs">
          <span className="text-neutral-500">
            Covers: AST integrity, Undo/Redo, Escape Invariance, Persistence.
          </span>
          <button
            disabled={isRunning}
            onClick={executeTests}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Re-run Suite</span>
          </button>
        </div>
      </div>
    </div>
  );
};
