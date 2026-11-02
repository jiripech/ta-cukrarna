'use client';

import { useEffect, useState } from 'react';
import { makeT, pickBilingual, useLang } from '@/lib/i18n';

interface Credential {
  id: number;
  credential_id: string;
  counter: number;
  created_at: string;
  last_used_at: string | null;
  user_agent: string | null;
  device_info: {
    transports?: string[];
    platform?: string;
  } | null;
}

interface CsrfOptions {
  csrfToken: string;
  enabled: boolean;
}

export default function PasskeyManager({ csrf }: { csrf?: CsrfOptions }) {
  const lang = useLang();
  const t = makeT(lang);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);
  const csrfToken = csrf?.enabled ? csrf.csrfToken : undefined;

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return t('Nikdy', 'Never');
    try {
      const date = new Date(dateStr + 'Z');
      return date.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getDeviceName = (cred: Credential): string => {
    if (cred.device_info?.platform) {
      const platformNames: Record<string, string> = {
        windows: t('Windows', 'Windows'),
        mac: t('macOS', 'macOS'),
        ios: t('iOS', 'iOS'),
        android: t('Android', 'Android'),
        linux: t('Linux', 'Linux'),
      };
      return (
        platformNames[cred.device_info.platform.toLowerCase()] ||
        cred.device_info.platform
      );
    }
    if (cred.user_agent) {
      const ua = cred.user_agent.toLowerCase();
      if (ua.includes('iphone') || ua.includes('ipad')) return t('iOS', 'iOS');
      if (ua.includes('android')) return t('Android', 'Android');
      if (ua.includes('mac os')) return t('macOS', 'macOS');
      if (ua.includes('windows')) return t('Windows', 'Windows');
      if (ua.includes('linux')) return t('Linux', 'Linux');
    }
    return t('Neznámé zařízení', 'Unknown device');
  };

  // Load credentials on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const headers: { 'Content-Type': string; 'X-CSRF-Token'?: string } = {
          'Content-Type': 'application/json',
        };
        if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
        const res = await fetch('/api/webauthn.php?action=list_credentials', {
          method: 'POST',
          credentials: 'include',
          headers,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(
            pickBilingual(String(d?.error || ''), lang) ||
              t(
                'Nepodařilo se načíst přístupové klíče.',
                'Could not load passkeys.'
              )
          );
        }
        const data = await res.json();
        if (!cancelled) {
          setCredentials(data.credentials || []);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '';
          setError(
            msg ||
              t(
                'Nepodařilo se načíst přístupové klíče.',
                'Could not load passkeys.'
              )
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [csrfToken, lang, t]);

  const handleRevoke = async (credentialId: number) => {
    setConfirmRevokeId(null);
    setRevoking(credentialId);
    setError(null);
    setSuccess(null);
    try {
      const headers: { 'Content-Type': string; 'X-CSRF-Token'?: string } = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
      const res = await fetch('/api/webauthn.php?action=revoke_credential', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          credential_id: credentials.find(c => c.id === credentialId)
            ?.credential_id,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(
          pickBilingual(String(d?.error || ''), lang) ||
            t('Odvolání selhalo.', 'Revocation failed.')
        );
      }
      setSuccess(t('Přístupový klíč byl odvolán.', 'Passkey revoked.'));
      // Reload credentials after successful revocation
      (async () => {
        try {
          const headers: { 'Content-Type': string; 'X-CSRF-Token'?: string } = {
            'Content-Type': 'application/json',
          };
          if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
          const res = await fetch('/api/webauthn.php?action=list_credentials', {
            method: 'POST',
            credentials: 'include',
            headers,
          });
          if (res.ok) {
            const data = await res.json();
            setCredentials(data.credentials || []);
          }
        } catch {
          // Ignore reload errors
        }
      })();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg || t('Odvolání selhalo.', 'Revocation failed.'));
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="glass-card text-center" role="status" aria-live="polite">
        <p className="glass-text">{t('Načítám…', 'Loading…')}</p>
      </div>
    );
  }

  return (
    <div className="glass-page min-h-[70vh] p-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-white font-semibold text-lg mb-6">
          {t('Správa zařízení', 'Device management')}
        </h2>

        {credentials.length === 0 ? (
          <div className="glass-card text-center py-12">
            <p className="glass-text mb-6">
              {t(
                'Zatím nejsou registrována žádná zařízení.',
                'No devices registered yet.'
              )}
            </p>
            <a
              href="/admin/register/"
              className="glass-submit-full inline-block"
            >
              {t('Registrovat první zařízení', 'Register first device')}
            </a>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full" role="table">
                <thead>
                  <tr className="border-b border-white/10">
                    <th
                      className="text-left py-3 px-4 text-xs uppercase tracking-wide text-zinc-400"
                      scope="col"
                    >
                      {t('Registrováno', 'Registered')}
                    </th>
                    <th
                      className="text-left py-3 px-4 text-xs uppercase tracking-wide text-zinc-400"
                      scope="col"
                    >
                      {t('Naposledy použito', 'Last used')}
                    </th>
                    <th
                      className="text-left py-3 px-4 text-xs uppercase tracking-wide text-zinc-400"
                      scope="col"
                    >
                      {t('Počet podpisů', 'Sign count')}
                    </th>
                    <th
                      className="text-left py-3 px-4 text-xs uppercase tracking-wide text-zinc-400"
                      scope="col"
                    >
                      {t('Zařízení', 'Device')}
                    </th>
                    <th
                      className="text-right py-3 px-4 text-xs uppercase tracking-wide text-zinc-400"
                      scope="col"
                    >
                      {t('Akce', 'Action')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map(cred => (
                    <tr
                      key={cred.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm">
                        {formatDate(cred.created_at)}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {formatDate(cred.last_used_at)}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono">
                        {cred.counter}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="font-medium">{getDeviceName(cred)}</div>
                        {cred.device_info?.transports &&
                          cred.device_info.transports.length > 0 && (
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {cred.device_info.transports.join(', ')}
                            </div>
                          )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {confirmRevokeId === cred.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleRevoke(cred.id)}
                              disabled={revoking === cred.id}
                              className="glass-submit-full text-xs px-3 py-1.5"
                              aria-busy={revoking === cred.id}
                            >
                              {revoking === cred.id
                                ? t('Odvolávám…', 'Revoking…')
                                : t('Potvrdit', 'Confirm')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRevokeId(null)}
                              className="glass-ghost text-xs"
                              disabled={revoking === cred.id}
                            >
                              {t('Zrušit', 'Cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRevokeId(cred.id)}
                            className="glass-ghost text-xs text-red-400 hover:text-red-300"
                            aria-label={t(
                              'Odvolat přístupový klíč',
                              'Revoke passkey'
                            )}
                          >
                            {t('Odvolat', 'Revoke')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="glass-text text-xs mt-6 text-center">
              {t(
                'Odvolání přístupového klíče je nevratné. Zařízení bude muset být znovu zaregistrováno přes registrační odkaz.',
                'Revoking a passkey is irreversible. The device will need to be re-registered via the registration link.'
              )}
            </p>
          </>
        )}

        {error && (
          <p className="glass-error mt-4 text-center" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p
            className="glass-text mt-4 text-center text-green-400"
            role="status"
          >
            {success}
          </p>
        )}
      </div>
    </div>
  );
}
