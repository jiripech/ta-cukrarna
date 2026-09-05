'use client';

import { useEffect } from 'react';
import { makeT, useLang } from '@/lib/i18n';

/**
 * Root error boundary. Replaces Next's generic "Application error" page with
 * the actual error message, so a failed render is diagnosable without
 * opening browser developer tools.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lang = useLang();
  const t = makeT(lang);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-sm">
        <h1 className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">
          {t('Něco se pokazilo.', 'Something went wrong.')}
        </h1>
        <p className="mb-2 break-words text-sm text-zinc-600 dark:text-zinc-400">
          {error.message || t('Neznámá chyba.', 'Unknown error.')}
        </p>
        {error.digest && (
          <p className="mb-4 text-xs text-zinc-400 dark:text-zinc-500">
            {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
        >
          {t('Zkusit znovu', 'Try again')}
        </button>
      </div>
    </main>
  );
}
