'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Lang = 'cs' | 'en';

const LANG_KEY = 'ta-lang';

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

/**
 * Active language: the manual toggle choice (localStorage) wins, otherwise
 * the browser language. navigator.language is the client-side equivalent of
 * the Accept-Language header, which is not available per-request in a
 * static export.
 */
function getSnapshot(): Lang {
  try {
    const stored = window.localStorage.getItem(LANG_KEY);
    if (stored === 'cs' || stored === 'en') return stored;
  } catch {
    // localStorage can throw in privacy modes; fall through to the browser
    // language.
  }
  return navigator.language.toLowerCase().startsWith('cs') ? 'cs' : 'en';
}

// During SSR (and hydration) the server has no browser context - render
// Czech there; the client snapshot takes over right after hydration.
function getServerSnapshot(): Lang {
  return 'cs';
}

export function setLang(next: Lang) {
  try {
    window.localStorage.setItem(LANG_KEY, next);
  } catch {
    // Ignore persistence failures (privacy modes) - the toggle still works
    // for the current page.
  }
  listeners.forEach(callback => callback());
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Bilingual string picker bound to the active language.
 *
 * Memoized per language: makeT() results are stable references, so `t` can
 * be used in hook dependency arrays without re-triggering effects on every
 * render (an unstable t caused an infinite effect/render loop once - see
 * v1.2.11's CI history).
 */
const tCache = new Map<Lang, (cs: string, en: string) => string>();

export function makeT(lang: Lang) {
  let t = tCache.get(lang);
  if (!t) {
    t = (cs: string, en: string) => (lang === 'cs' ? cs : en);
    tCache.set(lang, t);
  }
  return t;
}

/**
 * Picks one language out of a bilingual SERVER message ("cs text / en text").
 * PHP API errors are bilingual by convention; this renders only the half
 * matching the active language. Messages without the separator pass through.
 */
export function pickBilingual(raw: string, lang: Lang): string {
  const separatorIndex = raw.indexOf(' / ');
  if (separatorIndex === -1) return raw;
  return lang === 'cs'
    ? raw.slice(0, separatorIndex)
    : raw.slice(separatorIndex + 3);
}

export function LanguageToggle() {
  const lang = useLang();
  const switchTo = useCallback(
    (next: Lang) => () => {
      setLang(next);
    },
    []
  );
  return (
    <div className="glass-lang-toggle">
      <button
        type="button"
        onClick={switchTo('cs')}
        aria-label="Čeština"
        aria-pressed={lang === 'cs'}
        title="Čeština"
        className={lang === 'cs' ? 'is-active' : ''}
      >
        🇨🇿
      </button>
      <button
        type="button"
        onClick={switchTo('en')}
        aria-label="English"
        aria-pressed={lang === 'en'}
        title="English"
        className={lang === 'en' ? 'is-active' : ''}
      >
        🇬🇧
      </button>
    </div>
  );
}
