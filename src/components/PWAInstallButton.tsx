import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Laptop, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Hide if already running in standalone PWA mode
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-editor-red bg-editor-red/10 hover:bg-editor-red/20 rounded transition-all cursor-pointer border border-editor-red/20"
        title="Install Web Screenplay Editor as Standalone App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-graphite hover:text-ink bg-neutral-100 dark:bg-neutral-800 rounded transition-all cursor-pointer border border-rule"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-[var(--radius-modal)] bg-panel p-6 shadow-2xl border border-rule relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-3 right-3 p-1 text-graphite hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-editor-red/10 text-editor-red">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-ink">Install on iPhone / iPad</h3>
              </div>

              <p className="text-xs text-graphite leading-relaxed mb-4">
                To install this Screenplay Editor on your home screen:
              </p>

              <ol className="text-xs text-ink space-y-2.5 pl-2 mb-6">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-editor-red">1.</span>
                  <span>Tap the <strong>Share</strong> icon in the Safari navigation bar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-editor-red">2.</span>
                  <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-editor-red">3.</span>
                  <span>Tap <strong>Add</strong> in the top right corner.</span>
                </li>
              </ol>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-editor-red hover:bg-editor-red-hover text-white rounded-[var(--radius-ui)] text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
