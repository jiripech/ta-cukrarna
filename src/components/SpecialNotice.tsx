'use client';

import { useState, useEffect } from 'react';

interface SpecialNoticeProps {
  onNoticeChange?: (hasNotice: boolean, message: string) => void;
}

export default function SpecialNotice({ onNoticeChange }: SpecialNoticeProps) {
  const [isTestMode, setIsTestMode] = useState(false);
  const [noticeText, setNoticeText] = useState('');
  const [showTestPanel, setShowTestPanel] = useState(false);

  const defaultNotices = [
    'Dnes (23.10.) máme zavřeno z důvodu nemoci.',
    'Pozor! Zítra (24.10.) zavíráme už v 15:00.',
    'V úterý 29.10. máme zkrácenou otevírací dobu 10:00-14:00.',
    'Během vánočních svátků máme změněnou otevírací dobu - sledujte naše sociální sítě.',
  ];

  useEffect(() => {
    onNoticeChange?.(isTestMode, noticeText);
  }, [isTestMode, noticeText, onNoticeChange]);

  const handleTestNotice = (message: string) => {
    setNoticeText(message);
    setIsTestMode(true);
  };

  const clearNotice = () => {
    setIsTestMode(false);
    setNoticeText('');
  };

  // Keyboard shortcut for test panel (Ctrl/Cmd + Shift + T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setShowTestPanel(!showTestPanel);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTestPanel]);

  if (!showTestPanel) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setShowTestPanel(true)}
          className="bg-zinc-800 text-white p-2 rounded-full shadow-lg hover:bg-zinc-700 transition-colors"
          title="Test notifikací (Cmd+Shift+T)"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-5 5-5-5h5v-12h5v12z"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-4 w-80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Test notifikací
        </h3>
        <button
          onClick={() => setShowTestPanel(false)}
          className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
          Klikněte na ukázku nebo napište vlastní zprávu:
        </div>

        {/* Predefined notices */}
        <div className="space-y-2">
          {defaultNotices.map((notice, index) => (
            <button
              key={index}
              onClick={() => handleTestNotice(notice)}
              className="w-full text-left p-2 text-sm bg-zinc-50 dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600 rounded border text-zinc-800 dark:text-zinc-200 transition-colors"
            >
              {notice}
            </button>
          ))}
        </div>

        {/* Custom notice */}
        <div className="border-t border-zinc-200 dark:border-zinc-600 pt-3">
          <textarea
            value={noticeText}
            onChange={e => setNoticeText(e.target.value)}
            placeholder="Vlastní zpráva..."
            className="w-full p-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 resize-none"
            rows={2}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setIsTestMode(true)}
              disabled={!noticeText.trim()}
              className="flex-1 bg-amber-500 text-white px-3 py-1 text-sm rounded hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Zobrazit
            </button>
            <button
              onClick={clearNotice}
              className="flex-1 bg-zinc-500 text-white px-3 py-1 text-sm rounded hover:bg-zinc-600 transition-colors"
            >
              Vymazat
            </button>
          </div>
        </div>

        {isTestMode && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2 mt-3">
            <div className="text-xs text-amber-700 dark:text-amber-300 mb-1">
              ✅ Aktivní notifikace:
            </div>
            <div className="text-sm text-amber-800 dark:text-amber-200">
              {noticeText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
