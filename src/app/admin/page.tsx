'use client';

import { useState } from 'react';
import Link from 'next/link';
import OwnerHoursForm from '@/components/OwnerHoursForm';
import { startAuthentication } from '@/lib/webauthn';
import { USE_ADMIN } from '@/lib/featureFlags';

type View =
  | { name: 'login' }
  | { name: 'loading'; message?: string }
  | { name: 'error'; message: string }
  | { name: 'form'; csrfToken?: string };

export default function AdminPage() {
  const [view, setView] = useState<View>({ name: 'login' });

  if (!USE_ADMIN) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Administrace není dostupná
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Správa otevírací doby je momentálně vypnuta. / The admin panel is
            currently disabled.
          </p>
        </div>
      </main>
    );
  }

  const handleSignIn = async () => {
    setView({ name: 'loading', message: 'Připravuji přihlášení…' });
    try {
      const challengeRes = await fetch(
        '/api/webauthn.php?action=challenge_login',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const challengeData = await challengeRes.json().catch(() => null);
      if (!challengeRes.ok || !challengeData || !challengeData.getArgs) {
        throw new Error(
          challengeData?.error ||
            'Nepodařilo se zahájit přihlášení. / Could not start authentication.'
        );
      }

      setView({
        name: 'loading',
        message: 'Čekám na přístupový klíč… / Waiting for your passkey…',
      });
      const assertion = await startAuthentication(challengeData.getArgs);

      const verifyRes = await fetch('/api/webauthn.php?action=verify_login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      const verifyData = await verifyRes.json().catch(() => null);
      if (!verifyRes.ok) {
        throw new Error(
          verifyData?.error || 'Přihlášení se nezdařilo. / Sign in failed.'
        );
      }

      let csrfToken =
        typeof verifyData?.csrfToken === 'string'
          ? verifyData.csrfToken
          : undefined;

      // Fall back to fetching the CSRF token from the session endpoint.
      if (!csrfToken) {
        const csrfRes = await fetch('/api/csrf.php', {
          method: 'GET',
          credentials: 'include',
        });
        const csrfData = await csrfRes.json().catch(() => null);
        csrfToken = csrfData?.csrf_token ?? undefined;
      }

      setView({ name: 'form', csrfToken });
    } catch (e) {
      setView({
        name: 'error',
        message:
          e &&
          typeof e === 'object' &&
          'message' in e &&
          typeof (e as { message: unknown }).message === 'string'
            ? (e as { message: string }).message
            : 'Autentizace selhala. Zkuste to prosím znovu. / Authentication failed. Please try again.',
      });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-4 py-10">
      <div className="w-full max-w-3xl">
        {view.name === 'form' ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 md:p-8">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Správa otevírací doby
                </h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Úprava otevírací doby / Edit opening hours
                </p>
              </div>
              <Link
                href="/"
                className="text-sm text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 transition-colors"
              >
                Odhlásit se / Sign out
              </Link>
            </div>
            <OwnerHoursForm
              csrf={{ csrfToken: view.csrfToken || '', enabled: true }}
            />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm text-center">
            {view.name === 'loading' ? (
              <div>
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-amber-500" />
                <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Přihlašuji…
                </h1>
                {view.message && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {view.message}
                  </p>
                )}
              </div>
            ) : view.name === 'error' ? (
              <div>
                <h1 className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">
                  Přihlášení selhalo
                </h1>
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                  {view.message}
                </p>
                <button
                  type="button"
                  onClick={() => setView({ name: 'login' })}
                  className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
                >
                  Zkusit znovu / Try again
                </button>
              </div>
            ) : (
              <div>
                <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Administrace
                </h1>
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                  Přihlaste se pomocí bezpečnostního klíče. / Sign in with your
                  security key.
                </p>
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="rounded-md bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
                >
                  Přihlásit se / Sign in
                </button>
                <div className="mt-6">
                  <a
                    href="/admin/register/"
                    className="text-sm text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 transition-colors"
                  >
                    Registrovat nové zařízení / Register new device
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
