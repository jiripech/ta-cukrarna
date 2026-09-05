'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { startRegistration } from '@/lib/webauthn';
import { USE_ADMIN } from '@/lib/featureFlags';
import { LanguageToggle, makeT, pickBilingual, useLang } from '@/lib/i18n';

type View =
  | { name: 'request' }
  | { name: 'sent' }
  | { name: 'validating' }
  | { name: 'invalid'; message: string }
  | { name: 'password' }
  | { name: 'registering' }
  | { name: 'error'; message: string }
  | { name: 'success' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const lang = useLang();
  const t = makeT(lang);
  const [view, setView] = useState<View>({ name: 'request' });
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const emailValid = EMAIL_RE.test(email.trim());

  useEffect(() => {
    if (!USE_ADMIN) return;
    emailRef.current?.focus();
  }, [view.name]);

  useEffect(() => {
    if (!USE_ADMIN) return;
    const token = new URLSearchParams(window.location.search).get('token');

    // Without a token, we show the bare request-links screen (no clues).
    if (!token) {
      setView({ name: 'request' });
      return;
    }

    let cancelled = false;
    setView({ name: 'validating' });

    const validate = async () => {
      try {
        const res = await fetch(
          `/api/register.php?action=validate-token&token=${encodeURIComponent(
            token
          )}`,
          { credentials: 'include' }
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.valid) {
          setView({
            name: 'invalid',
            message: data?.error
              ? pickBilingual(String(data.error), lang)
              : t(
                  'Registrační odkaz je neplatný nebo vypršel.',
                  'The registration link is invalid or has expired.'
                ),
          });
          return;
        }
        setView({ name: 'password' });
      } catch {
        if (cancelled) return;
        setView({
          name: 'error',
          message: t(
            'Nepodařilo se ověřit registrační odkaz.',
            'Could not verify the registration link.'
          ),
        });
      }
    };

    validate();
    return () => {
      cancelled = true;
    };
    // The effect intentionally re-runs on a language switch (harmless: token
    // validation is a read-only request).
  }, [t, lang]);

  if (!USE_ADMIN) return null;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) return;
    setSending(true);
    try {
      const res = await fetch('/api/register.php?action=request-token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim() }),
      });
      // 429 and 5xx are unconditional responses - showing them leaks nothing
      // about whether the account exists (that stays behind the neutral 200).
      if (res.status === 429) {
        const data = await res.json().catch(() => null);
        setView({
          name: 'error',
          message: data?.error
            ? pickBilingual(String(data.error), lang)
            : t(
                'Příliš mnoho požadavků. Zkuste to prosím později.',
                'Too many requests. Please try again later.'
              ),
        });
        return;
      }
      if (!res.ok) {
        setView({
          name: 'error',
          message: t(
            'Odeslání se nezdařilo. Zkuste to prosím později.',
            'Sending failed. Please try again later.'
          ),
        });
        return;
      }
      setView({ name: 'sent' });
    } catch {
      setView({
        name: 'error',
        message: t(
          'Odeslání se nezdařilo. Zkuste to prosím později.',
          'Sending failed. Please try again later.'
        ),
      });
    } finally {
      setSending(false);
    }
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!password) {
      setPasswordError(t('Zadejte prosím heslo.', 'Please enter a password.'));
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
          data?.error
            ? pickBilingual(String(data.error), lang)
            : t('Ověření hesla se nezdařilo.', 'Password verification failed.')
        );
        return;
      }
      await registerDevice();
    } catch {
      setPasswordError(
        t('Nepodařilo se ověřit heslo.', 'Could not verify the password.')
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
          challengeData?.error
            ? pickBilingual(String(challengeData.error), lang)
            : t(
                'Nepodařilo se zahájit registraci.',
                'Could not start registration.'
              )
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
          verifyData?.error
            ? pickBilingual(String(verifyData.error), lang)
            : t('Registrace se nezdařila.', 'Registration failed.')
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
            : t(
                'Registrace se nezdařila. Zkuste to prosím znovu.',
                'Registration failed. Please try again.'
              ),
      });
    }
  };

  const handleEmailChange = (v: string) => {
    setEmail(v);
    setSending(false);
  };

  return (
    <main className="glass-page min-h-screen flex items-center justify-center px-4">
      <LanguageToggle />
      {/* Request-links screen: bare input, no clues */}
      {view.name === 'request' && (
        <form
          onSubmit={handleRequest}
          className="glass-field w-full max-w-sm"
          aria-label="registration"
        >
          <input
            ref={emailRef}
            type="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={e => handleEmailChange(e.target.value)}
            className="glass-input"
            aria-label="email"
          />
          {emailValid && (
            <button
              type="submit"
              className="glass-submit"
              disabled={sending}
              aria-label={t('Odeslat', 'Send')}
            >
              →
            </button>
          )}
        </form>
      )}

      {/* Neutral sent confirmation — no clue about whether the account exists */}
      {view.name === 'sent' && (
        <div className="glass-card w-full max-w-sm text-center">
          <p className="glass-text">
            {t(
              'Pokud účet existuje, e-mail s odkazem byl odeslán.',
              'If the account exists, the link was sent by email.'
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              setEmail('');
              setSending(false);
              setView({ name: 'request' });
              emailRef.current?.focus();
            }}
            className="glass-ghost"
          >
            {t('Zpět', 'Back')}
          </button>
        </div>
      )}

      {view.name === 'validating' && (
        <div className="glass-card w-full max-w-sm text-center">
          <p className="glass-text">…</p>
        </div>
      )}

      {view.name === 'registering' && (
        <div className="glass-card w-full max-w-sm text-center">
          <p className="glass-text">
            {t(
              'Postupujte podle pokynů v prohlížeči.',
              'Follow the prompts in your browser.'
            )}
          </p>
        </div>
      )}

      {view.name === 'password' && (
        <form
          onSubmit={handleVerifyPassword}
          className="glass-card w-full max-w-sm"
        >
          <label className="glass-label">
            {t('Heslo', 'Password')}
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="glass-input"
            />
          </label>
          {passwordError && <p className="glass-error">{passwordError}</p>}
          <button type="submit" className="glass-submit-full">
            {t('Pokračovat', 'Continue')}
          </button>
        </form>
      )}

      {(view.name === 'invalid' || view.name === 'error') && (
        <div className="glass-card w-full max-w-sm text-center">
          <p className="glass-text">
            {view.name === 'invalid'
              ? view.message
              : view.message || t('Došlo k chybě.', 'Something went wrong.')}
          </p>
          <Link href="/" className="glass-ghost">
            {t('Zpět na web', 'Back to site')}
          </Link>
        </div>
      )}

      {view.name === 'success' && (
        <div className="glass-card w-full max-w-sm text-center">
          <p className="glass-text">
            {t('Vaše zařízení je připraveno.', 'Your device is ready.')}
          </p>
          <a href="/admin/" className="glass-submit-full">
            {t('Přejít do administrace', 'Go to admin')}
          </a>
        </div>
      )}
    </main>
  );
}
