import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';

/**
 * Software WebAuthn authenticator for the Docker PHP test container.
 *
 * A real WebAuthn ceremony cannot run on a localhost origin when the server
 * demands the production RP ID tacukrarna.cz (browsers reject an RP ID that
 * is not a registrable suffix of the origin; documented in AGENTS.md). This
 * helper stubs ONLY `navigator.credentials` — everything else stays real:
 *
 *   - challenge/verify endpoints hit the real PHP API,
 *   - challenges and the RP ID come from the server's getArgs/createArgs,
 *   - ES256 signatures are computed with real key material: the seeded
 *     private key (docker/seed-passkeys.php -> public/api/DB/
 *     test-credentials.json) for logins, and a freshly generated keypair for
 *     registrations performed through this stub,
 *   - the server verifies signatures, stores passkeys, updates counters and
 *     opens sessions.
 *
 * clientDataJSON origin rules (mirrors lbuchs/WebAuthn _checkOrigin): when
 * the server's RP ID equals the page hostname (e.g. WEBAUTHN_RP_ID=localhost
 * in the container .env), the real page origin is used - that combination is
 * what makes REAL browser ceremonies work too. Otherwise the https form of
 * the production RP ID is claimed.
 */

export const RP_ID = 'tacukrarna.cz';
export const RP_ORIGIN = `https://${RP_ID}`;

export interface TestCredentials {
  credentialId: string; // base64url of the seeded passkey
  jwk: JsonWebKey; // P-256 private JWK for crypto.subtle.importKey('jwk')
  username: string;
  registerToken?: string; // pre-inserted registration token (seeder)
  registerUrl?: string; // convenience: full registration URL
}

export function loadTestCredentials(): TestCredentials {
  return JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        '..',
        '..',
        'public',
        'api',
        'DB',
        'test-credentials.json'
      ),
      'utf8'
    )
  );
}

/**
 * The RP ID the SERVER should be using, parsed from the container .env
 * (defaults to the production RP ID when unset). The software authenticator
 * adapts to whatever RP ID the server sends - which also means it cannot
 * detect a server misconfiguration; the specs use this value to assert the
 * server-sent rp.id/getArgs.rpId (regression guard for the loadEnv() trap).
 */
export function expectedRpId(): string {
  try {
    const env = readFileSync(
      resolve(__dirname, '..', '..', '.env.docker'),
      'utf8'
    );
    const match = env.match(/^WEBAUTHN_RP_ID\s*=\s*(.+)$/m);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // no .env.docker - fall through to the default
  }
  return RP_ID;
}

/**
 * Resets ALL seeded/test passkey signature counters to 0 (host-side, through
 * the api/DB bind mount) so the software authenticator can always assert
 * with counter 1. The server rejects logins whose counter is not strictly
 * greater than the stored one. Requires the `sqlite3` CLI on the host (only
 * used in DOCKER_E2E mode, which never runs on CI).
 */
export function resetPasskeyCounter(): void {
  const dbPath = resolve(
    __dirname,
    '..',
    '..',
    'public',
    'api',
    'DB',
    'passkeys.sqlite'
  );
  execFileSync('sqlite3', [dbPath, 'UPDATE passkeys SET counter = 0']);
}

export async function stubSoftWebauthn(
  page: Page,
  creds: TestCredentials
): Promise<void> {
  await page.addInitScript(
    ({ seededCreds }) => {
      function b64UrlToBytes(b64url: string): Uint8Array {
        const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
      }

      function bytesToB64Url(bytes: Uint8Array): string {
        let binary = '';
        for (const b of bytes) binary += String.fromCharCode(b);
        return btoa(binary)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      }

      async function sha256(data: Uint8Array): Promise<Uint8Array> {
        const digest = await crypto.subtle.digest(
          'SHA-256',
          data as BufferSource
        );
        return new Uint8Array(digest);
      }

      function concat(...parts: Uint8Array[]): Uint8Array {
        const total = parts.reduce((n, p) => n + p.length, 0);
        const out = new Uint8Array(total);
        let offset = 0;
        for (const p of parts) {
          out.set(p, offset);
          offset += p.length;
        }
        return out;
      }

      // ---- minimal CBOR (enough for COSE keys + 'none' attestation) ----

      function cborBytes(bytes: Uint8Array): Uint8Array {
        if (bytes.length <= 23) {
          return concat(new Uint8Array([0x40 | bytes.length]), bytes);
        }
        return concat(new Uint8Array([0x58, bytes.length]), bytes);
      }

      function cborText(text: string): Uint8Array {
        const raw = new TextEncoder().encode(text);
        if (raw.length <= 23) {
          return concat(new Uint8Array([0x60 | raw.length]), raw);
        }
        return concat(new Uint8Array([0x78, raw.length]), raw);
      }

      // Signed fields (integers) used below: 1 -> 0x01, 3 -> 0x03,
      // -1 -> 0x20, -2 -> 0x21, -3 -> 0x22, -7 -> 0x26.

      // COSE_Key for ES256/P-256: {1:2 (EC2), 3:-7 (ES256), -1:1 (P-256),
      // -2: x, -3: y}
      function coseKeyP256(x: Uint8Array, y: Uint8Array): Uint8Array {
        return concat(
          new Uint8Array([0xa5]),
          new Uint8Array([0x01, 0x02]),
          new Uint8Array([0x03, 0x26]),
          new Uint8Array([0x20, 0x01]),
          new Uint8Array([0x21]),
          cborBytes(x),
          new Uint8Array([0x22]),
          cborBytes(y)
        );
      }

      // attestationObject for fmt 'none': {'fmt': 'none', 'attStmt': {},
      // 'authData': <bytes>}
      function attestationObjectNone(authData: Uint8Array): Uint8Array {
        return concat(
          new Uint8Array([0xa3]),
          cborText('fmt'),
          cborText('none'),
          cborText('attStmt'),
          new Uint8Array([0xa0]),
          cborText('authData'),
          cborBytes(authData)
        );
      }

      // ---- stub state ----

      const seededIdBytes = b64UrlToBytes(seededCreds.credentialId);
      // Passkey created through this stub's create(): preferred for logins so
      // a register -> sign-in round trip exercises the NEW passkey.
      let registered: {
        credentialIdBytes: Uint8Array;
        privateKey: CryptoKey;
      } | null = null;

      function clientOrigin(rpId: string): string {
        return rpId === window.location.hostname
          ? window.location.origin
          : `https://${rpId}`;
      }

      Object.defineProperty(window.navigator, 'credentials', {
        configurable: true,
        get: () => ({
          create: async (opts: CredentialCreationOptions) => {
            const pk = opts.publicKey!;
            const rpId = pk.rp?.id ?? window.location.hostname;
            const challenge = new Uint8Array(pk.challenge as ArrayBuffer);

            const clientDataJSON = new TextEncoder().encode(
              JSON.stringify({
                type: 'webauthn.create',
                challenge: bytesToB64Url(challenge),
                origin: clientOrigin(rpId),
                crossOrigin: false,
              })
            );

            // Fresh keypair for the new credential
            const keyPair = await crypto.subtle.generateKey(
              { name: 'ECDSA', namedCurve: 'P-256' },
              true,
              ['sign', 'verify']
            );
            const privateKey = keyPair.privateKey;
            const jwkPub = await crypto.subtle.exportKey(
              'jwk',
              keyPair.publicKey
            );

            const credentialIdBytes = crypto.getRandomValues(
              new Uint8Array(32)
            );

            // authData: rpIdHash || flags (UP|UV|AT) || counter || AAGUID ||
            // credIdLen || credId || COSE key
            const rpIdHash = await sha256(new TextEncoder().encode(rpId));
            const aaguid = new Uint8Array(16);
            const credIdLen = new Uint8Array(2);
            new DataView(credIdLen.buffer).setUint16(
              0,
              credentialIdBytes.length
            );
            const cose = coseKeyP256(
              b64UrlToBytes(jwkPub.x!),
              b64UrlToBytes(jwkPub.y!)
            );
            const authData = concat(
              rpIdHash,
              new Uint8Array([0x45]), // user present + user verified + attested
              new Uint8Array([0, 0, 0, 0]), // counter 0 at registration
              aaguid,
              credIdLen,
              credentialIdBytes,
              cose
            );

            registered = { credentialIdBytes, privateKey };

            return {
              rawId: credentialIdBytes.buffer,
              response: {
                clientDataJSON: clientDataJSON.buffer,
                attestationObject: attestationObjectNone(authData).buffer,
              },
            } as unknown as PublicKeyCredential;
          },

          get: async (opts: CredentialRequestOptions) => {
            const pk = opts.publicKey!;
            const rpId = pk.rpId ?? window.location.hostname;
            const challenge = new Uint8Array(pk.challenge as ArrayBuffer);

            const clientDataJSON = new TextEncoder().encode(
              JSON.stringify({
                type: 'webauthn.get',
                challenge: bytesToB64Url(challenge),
                origin: clientOrigin(rpId),
                crossOrigin: false,
              })
            );

            // authenticatorData: rpIdHash || flags (UP|UV) || signature
            // counter (1; tests reset the stored counter beforehand - see
            // resetPasskeyCounter())
            const rpIdHash = await sha256(new TextEncoder().encode(rpId));
            const flags = new Uint8Array([0x05]); // user present + user verified
            const counterBytes = new Uint8Array([0, 0, 0, 1]);

            const idBytes = registered
              ? registered.credentialIdBytes
              : seededIdBytes;
            const signKey = registered
              ? registered.privateKey
              : await crypto.subtle.importKey(
                  'jwk',
                  seededCreds.jwk,
                  { name: 'ECDSA', namedCurve: 'P-256' },
                  false,
                  ['sign']
                );

            const authData = concat(rpIdHash, flags, counterBytes);

            // ES256 signature over authData || SHA256(clientDataJSON)
            const clientDataHash = await sha256(clientDataJSON);
            const signature = await crypto.subtle.sign(
              { name: 'ECDSA', hash: 'SHA-256' },
              signKey,
              concat(authData, clientDataHash) as BufferSource
            );

            return {
              rawId: idBytes.buffer,
              response: {
                clientDataJSON: clientDataJSON.buffer,
                authenticatorData: authData.buffer,
                signature,
              },
            } as unknown as PublicKeyCredential;
          },
        }),
      });
    },
    { seededCreds: creds }
  );
}

/**
 * Signs in through the real admin UI using the software authenticator.
 * Opens a real PHP admin session on success.
 */
export async function signInViaUi(page: Page): Promise<void> {
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(
    page.getByRole('heading', { name: 'Správa otevírací doby' })
  ).toBeVisible();
}
