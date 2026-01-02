'use client';
// src/components/Clarity.tsx

import React, { useEffect } from 'react';

/**
 * Here we define the type for the Clarity function we are creating on window.
 * In Clarity, the default function is "clarity(...args: any[])",
 * which also has an optional queue 'q' for commands.
 */
interface ClarityFunction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]): void;
  q?: IArguments[];
}

// Extend the Window interface so that TypeScript knows about 'clarity'
declare global {
  interface Window {
    clarity?: ClarityFunction;
  }
}

// Get your ID from settings or .env
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? '';

const ClarityTracker: React.FC = () => {
  useEffect(() => {
    // Checks if the code is not already running (important for SSR or hot-reloading)
    if (window.clarity) {
      return;
    }

    // Original code translated into TypeScript and inserted into useEffect
    (function (c: Window, l: Document, a: 'clarity', r: 'script', i: string) {
      // 1. Create a placeholder on window.clarity
      c[a] =
        c[a] ||
        (function () {
          // Check for existence of queue
          const clarityFunc = c[a] as ClarityFunction;
          clarityFunc.q = clarityFunc.q || [];
          // eslint-disable-next-line prefer-rest-params
          clarityFunc.q.push(arguments as IArguments);
        } as ClarityFunction);

      // 2. Create and insert the script
      const t = l.createElement(r);
      t.async = true;
      t.src = 'https://www.clarity.ms/tag/' + i;

      const y = l.getElementsByTagName(r)[0];
      // Check if y exists, otherwise put in the header
      if (y && y.parentNode) {
        y.parentNode.insertBefore(t, y);
      } else {
        l.head.appendChild(t); // Fallback
      }
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }, []); // An empty dependency field will ensure that it will only run on mount

  return null; // The component doesn't render anything, it just triggers the effect
};

export default ClarityTracker;
