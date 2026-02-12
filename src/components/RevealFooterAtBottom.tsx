'use client';

import { useEffect } from 'react';

export default function RevealFooterAtBottom(): null {
  useEffect(() => {
    const footer = document.querySelector(
      '.version-footer'
    ) as HTMLElement | null;
    if (!footer) return;

    let showTimeout: number | null = null;
    const SHOW_DURATION = 7000; // ms to keep the footer visible
    const BOTTOM_TOLERANCE = 2; // px tolerance for "at bottom" check

    const originalText = footer.textContent || '';

    function showFooter() {
      if (!footer) return;

      // show immediately
      footer.classList.add('visible');

      // fetch /version.txt each time and prefer its content when available
      fetch('/version.txt', { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error('no version file');
          return res.text();
        })
        .then(txt => {
          const v = (txt || '').trim();
          if (v) footer.textContent = v;
          else footer.textContent = originalText;
        })
        .catch(() => {
          // leave server-rendered content (originalText) if fetch fails
          footer.textContent = originalText;
        });

      if (showTimeout) window.clearTimeout(showTimeout);
      showTimeout = window.setTimeout(() => {
        if (footer) {
          footer.classList.remove('visible');
          footer.textContent = originalText; // restore original text after hide
        }
      }, SHOW_DURATION);
    }

    function isAtAbsoluteBottom(): boolean {
      const doc = document.documentElement;
      const atBottom =
        Math.abs(window.scrollY + window.innerHeight - doc.scrollHeight) <=
        BOTTOM_TOLERANCE;
      return atBottom;
    }

    // Throttle scroll handler using requestAnimationFrame
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        if (isAtAbsoluteBottom()) {
          showFooter();
        }
        ticking = false;
      });
    }

    // If content fits the viewport (no scrollbar), show once on mount
    const doc = document.documentElement;
    if (doc.scrollHeight <= window.innerHeight) {
      showFooter();
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (showTimeout) window.clearTimeout(showTimeout);
    };
  }, []);

  return null;
}
