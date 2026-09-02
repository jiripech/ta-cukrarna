'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { startRegistration } from '@/lib/webauthn';
import { USE_ADMIN } from '@/lib/featureFlags';

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
  const [view, setView] = useState<View>({ name: 'request' });
  const [email, setEmail] = useState('');
  const [sentReady, setSentReady] = useState(false);
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

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) return;
    setView({ name: 'sent' });
    try {
      await fetch('/api/register.php?action=request-token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim() }),
      });
    } catch {
      // Swallow the error to avoid revealing anything.
    }
  };

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

  const handleEmailChange = (v: string) => {
    setEmail(v);
    setSentReady(false);
  };

  return (
    <main className="glass-page min-h-screen flex items-center justify-center px-4">
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
          {emailValid && !sentReady && (
            <button
              type="submit"
              className="glass-submit"
              onClick={() => setSentReady(true)}
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
            Pokud účet existuje, e-mail s odkazem byl odeslán. / If the account
            exists, the link was sent by email.
          </p>
          <button
            type="button"
            onClick={() => {
              setEmail('');
              setSentReady(false);
              setView({ name: 'request' });
              emailRef.current?.focus();
            }}
            className="glass-ghost"
          >
            Zpět / Back
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
            Postupujte podle pokynů v prohlížeči. / Follow the prompts in your
            browser.
          </p>
        </div>
      )}

      {view.name === 'password' && (
        <form
          onSubmit={handleVerifyPassword}
          className="glass-card w-full max-w-sm"
        >
          <label className="glass-label">
            Heslo / Password
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
            Pokračovat / Continue
          </button>
        </form>
      )}

      {(view.name === 'invalid' || view.name === 'error') && (
        <div className="glass-card w-full max-w-sm text-center">
          <p className="glass-text">
            {view.name === 'invalid'
              ? view.message
              : view.message || 'Došlo k chybě. / Something went wrong.'}
          </p>
          <Link href="/" className="glass-ghost">
            Zpět na web / Back to site
          </Link>
        </div>
      )}

      {view.name === 'success' && (
        <div className="glass-card w-full max-w-sm text-center">
          <p className="glass-text">
            Vaše zařízení je připraveno. / Your device is ready.
          </p>
          <a href="/admin/" className="glass-submit-full">
            Přejít do administrace / Go to admin
          </a>
        </div>
      )}
    </main>
  );
}
