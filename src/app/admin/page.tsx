'use client';

import { useState } from 'react';
import Link from 'next/link';
import OwnerHoursGlassForm from '@/components/OwnerHoursGlassForm';
import PasskeyManager from '@/components/PasskeyManager';
import { startAuthentication } from '@/lib/webauthn';
import { USE_ADMIN } from '@/lib/featureFlags';
import { LanguageToggle, makeT, pickBilingual, useLang } from '@/lib/i18n';

type View =
  | { name: 'login' }
  | { name: 'loading'; message?: string }
  | { name: 'error'; message: string }
  | { name: 'form'; csrfToken?: string };

type Tab = 'hours' | 'passkeys';

export default function AdminPage() {
  const lang = useLang();
  const t = makeT(lang);
  const [view, setView] = useState<View>({ name: 'login' });
  const [activeTab, setActiveTab] = useState<Tab>('hours');

  if (!USE_ADMIN) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {t('Administrace není dostupná', 'Admin panel unavailable')}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t(
              'Správa otevírací doby je momentálně vypnuta.',
              'The admin panel is currently disabled.'
            )}
          </p>
        </div>
      </main>
    );
  }

  const handleSignIn = async () => {
    setView({
      name: 'loading',
      message: t('Připravuji přihlášení…', 'Preparing sign-in…'),
    });
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
          challengeData?.error
            ? pickBilingual(String(challengeData.error), lang)
            : t(
                'Nepodařilo se zahájit přihlášení.',
                'Could not start authentication.'
              )
        );
      }

      setView({
        name: 'loading',
        message: t('Čekám na přístupový klíč…', 'Waiting for your passkey…'),
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
          verifyData?.error
            ? pickBilingual(String(verifyData.error), lang)
            : t('Přihlášení se nezdařilo.', 'Sign in failed.')
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
            : t(
                'Autentizace selhala. Zkuste to prosím znovu.',
                'Authentication failed. Please try again.'
              ),
      });
    }
  };

  const renderAdminContent = () => {
    if (view.name !== 'form' || !view.csrfToken) return null;

    const csrf = { csrfToken: view.csrfToken, enabled: true };

    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        {/* Tab navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('hours')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
              activeTab === 'hours'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            role="tab"
            aria-selected={activeTab === 'hours'}
            aria-controls="hours-panel"
          >
            {t('Otevírací doba', 'Opening hours')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('passkeys')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
              activeTab === 'passkeys'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            role="tab"
            aria-selected={activeTab === 'passkeys'}
            aria-controls="passkeys-panel"
          >
            {t('Správa zařízení', 'Device management')}
          </button>
        </div>

        {/* Tab panels */}
        <div
          className="p-6 md:p-8"
          role="tabpanel"
          id="hours-panel"
          aria-labelledby="hours-tab"
          hidden={activeTab !== 'hours'}
        >
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {t('Správa otevírací doby', 'Opening hours management')}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('Úprava otevírací doby', 'Edit opening hours')}
              </p>
            </div>
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 transition-colors shrink-0"
            >
              {t('Odhlásit se', 'Sign out')}
            </Link>
          </div>
          <OwnerHoursGlassForm csrf={csrf} />
        </div>

        <div
          className="p-6 md:p-8"
          role="tabpanel"
          id="passkeys-panel"
          aria-labelledby="passkeys-tab"
          hidden={activeTab !== 'passkeys'}
        >
          <PasskeyManager csrf={csrf} />
        </div>
      </div>
    );
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-4 py-10">
      <LanguageToggle />
      <div className="w-full max-w-3xl">
        {view.name === 'form' ? (
          renderAdminContent()
        ) : (
          <div className="mx-auto w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm text-center">
            {view.name === 'loading' ? (
              <div>
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-amber-500" />
                <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('Přihlašuji…', 'Signing in…')}
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
                  {t('Přihlášení selhalo', 'Sign in failed')}
                </h1>
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                  {view.message}
                </p>
                <button
                  type="button"
                  onClick={() => setView({ name: 'login' })}
                  className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
                >
                  {t('Zkusit znovu', 'Try again')}
                </button>
              </div>
            ) : (
              <div>
                <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {t('Administrace', 'Administration')}
                </h1>
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                  {t(
                    'Přihlaste se pomocí bezpečnostního klíče.',
                    'Sign in with your security key.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="rounded-md bg-amber-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900 transition-colors"
                >
                  {t('Přihlásit se', 'Sign in')}
                </button>
                <div className="mt-6">
                  <a
                    href="/admin/register/"
                    className="text-sm text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 transition-colors"
                  >
                    {t('Registrovat nové zařízení', 'Register new device')}
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
