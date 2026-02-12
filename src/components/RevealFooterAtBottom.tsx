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

    function showFooter() {
      if (!footer) return;
      footer.classList.add('visible');
      if (showTimeout) window.clearTimeout(showTimeout);
      showTimeout = window.setTimeout(() => {
        if (footer) footer.classList.remove('visible');
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
