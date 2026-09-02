'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { startRegistration } from '@/lib/webauthn';
import { USE_ADMIN } from '@/lib/featureFlags';

type View =
  | { name: 'validating' }
  | { name: 'invalid'; message: string }
  | { name: 'password' }
  | { name: 'registering' }
  | { name: 'error'; message: string }
  | { name: 'success' };

const inputClasses =
  'w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

export default function RegisterPage() {
  const [view, setView] = useState<View>({ name: 'validating' });
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!USE_ADMIN) return;
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
      setView({
        name: 'invalid',
        message:
          'Chybí registrační odkaz. / Missing registration link. Zkontrolujte e-mail, který vám přišel. / Check the email you received.',
      });
      return;
    }

    let cancelled = false;

    const validate = async () => {
      try {
        const res = await fetch(
          `/api/register.php?action=validate-token&token=${encodeURIComponent(
            token
          )}`,
          {
            credentials: 'include',
          }
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.valid) {
          setView({
            name: 'invalid',
            message:
              data?.error ||
              'Registrační odkaz je neplatný nebo vypršel. / The registration link is invalid or has expired.',
          });
          return;
        }
        setView({ name: 'password' });
      } catch {
        if (cancelled) return;
        setView({
          name: 'error',
          message:
            'Nepodařilo se ověřit registrační odkaz. / Could not verify the registration link.',
        });
      }
    };

    validate();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!USE_ADMIN) return null;

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!password) {
      setPasswordError('Zadejte prosím heslo. / Please enter a password.');
      return;
    }
    try {
      const res = await fetch('/api/register.php?action=verify-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPasswordError(
          data?.error ||
            'Ověření hesla se nezdařilo. / Password verification failed.'
        );
        return;
      }
      await registerDevice();
    } catch {
      setPasswordError(
        'Nepodařilo se ověřit heslo. / Could not verify the password.'
      );
    }
  };

  const registerDevice = async () => {
    setView({ name: 'registering' });
    try {
      const challengeRes = await fetch(
        '/api/webauthn.php?action=challenge_register',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const challengeData = await challengeRes.json().catch(() => null);
      if (!challengeRes.ok || !challengeData?.createArgs) {
        throw new Error(
          challengeData?.error ||
            'Nepodařilo se zahájit registraci. / Could not start registration.'
        );
      }

      const attestation = await startRegistration(challengeData.createArgs);

      const verifyRes = await fetch(
        '/api/webauthn.php?action=verify_register',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attestation),
        }
      );
      const verifyData = await verifyRes.json().catch(() => null);
      if (!verifyRes.ok) {
        throw new Error(
          verifyData?.error || 'Registrace se nezdařila. / Registration failed.'
        );
      }

      setView({ name: 'success' });
    } catch (e) {
      setView({
        name: 'error',
        message:
          e &&
          typeof e === 'object' &&
          'message' in e &&
          typeof (e as { message: unknown }).message === 'string'
            ? (e as { message: string }).message
            : 'Registrace se nezdařila. Zkuste to prosím znovu. / Registration failed. Please try again.',
      });
    }
  };

  const errorMessage =
    view.name === 'invalid'
      ? view.message
      : view.name === 'error'
        ? view.message
        : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="mx-auto w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm text-center">
        {view.name === 'validating' && (
          <div>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-amber-500" />
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Ověřuji registrační odkaz… / Verifying registration link…
            </h1>
          </div>
        )}

        {view.name === 'registering' && (
          <div>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-amber-500" />
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Registruji zařízení… / Registering device…
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Postupujte podle pokynů v prohlížeči. / Follow the prompts in your
              browser.
            </p>
          </div>
        )}

        {view.name === 'password' && (
          <form onSubmit={handleVerifyPassword} className="text-left">
            <h1 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Registrace nového zařízení
            </h1>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Pro pokračování zadejte heslo vaší e-mailové schránky. / Enter
              your mailbox password to continue.
            </p>
            {passwordError && (
              <div className="mb-4 rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-200">
                {passwordError}
              </div>
            )}
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Heslo / Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className={inputClasses}
            />
            <button
              type="submit"
              className="mt-4 w-full rounded-md bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              Pokračovat / Continue
            </button>
          </form>
        )}

        {errorMessage && (
          <div>
            <h1 className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">
              {view.name === 'invalid'
                ? 'Registraci nelze dokončit'
                : 'Došlo k chybě'}
            </h1>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              {errorMessage}
            </p>
            <Link
              href="/"
              className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              Zpět na web / Back to site
            </Link>
          </div>
        )}

        {view.name === 'success' && (
          <div>
            <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Zařízení úspěšně zaregistrováno
            </h1>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Vaše zařízení je připraveno. Nyní se můžete přihlásit do
              administrace. / Your device is ready. You can now sign in to the
              admin panel.
            </p>
            <a
              href="/admin/"
              className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              Přejít do administrace / Go to admin
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
