import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { ThemeMode, getStoredTheme, setStoredTheme, getEffectiveTheme } from '../core/themeManager';

export const ThemeToggle: React.FC = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = getStoredTheme();
    setThemeMode(current);
    setEffectiveTheme(getEffectiveTheme(current));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
    setStoredTheme(mode);
    setEffectiveTheme(getEffectiveTheme(mode));
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded text-graphite hover:text-ink hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        title={`Theme: ${themeMode} (${effectiveTheme})`}
      >
        {effectiveTheme === 'dark' ? (
          <Moon className="w-4 h-4 text-editor-red" />
        ) : (
          <Sun className="w-4 h-4 text-graphite" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-36 bg-panel rounded-lg shadow-xl border border-rule py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 text-ink">
          <div className="px-3 py-1 text-[10px] font-bold text-graphite uppercase tracking-wider">
            Theme Mode
          </div>

          <button
            onClick={() => handleSelect('light')}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${
              themeMode === 'light' ? 'font-bold text-editor-red' : 'text-ink'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </div>
            {themeMode === 'light' && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => handleSelect('dark')}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${
              themeMode === 'dark' ? 'font-bold text-editor-red' : 'text-ink'
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </div>
            {themeMode === 'dark' && <Check className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => handleSelect('system')}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${
              themeMode === 'system' ? 'font-bold text-editor-red' : 'text-ink'
            }`}
          >
            <div className="flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5" />
              <span>System</span>
            </div>
            {themeMode === 'system' && <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
};
