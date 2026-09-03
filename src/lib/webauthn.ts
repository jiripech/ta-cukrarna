/**
 * WebAuthn browser ceremony helpers for the Ta Cukrárna admin panel.
 *
 * Uses the native `navigator.credentials` API. The PHP backend generates
 * `createArgs` / `getArgs` objects (with base64url-encoded binary fields)
 * that are handed back here to be mapped onto the native WebAuthn options.
 */

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  return bufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Converts an ArrayBuffer to a base64url string (no padding).
 * Exported for unit testing.
 */
export { bufferToBase64Url };

/**
 * Converts a base64url string to an ArrayBuffer.
 * Exported for unit testing.
 */
export function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Starts a WebAuthn registration ceremony.
 *
 * @param createArgs - the `{ publicKey }` object returned by the PHP backend.
 */
export async function startRegistration(
  createArgs: Record<string, unknown>
): Promise<{ clientDataJSON: string; attestationObject: string }> {
  const publicKey = createArgs.publicKey as Record<string, unknown> & {
    challenge: string;
    user: { id: string; name?: string; displayName?: string };
    excludeCredentials?: Array<{ id: string; type?: string }>;
  };

  const options: PublicKeyCredentialCreationOptions = {
    ...publicKey,
    challenge: base64UrlToArrayBuffer(publicKey.challenge),
    user: {
      id: base64UrlToArrayBuffer(publicKey.user.id),
      name: publicKey.user.name || '',
      displayName: publicKey.user.displayName || '',
    },
    excludeCredentials: (publicKey.excludeCredentials || []).map(({ id }) => ({
      id: base64UrlToArrayBuffer(id),
    })),
  } as PublicKeyCredentialCreationOptions;

  const credential = (await navigator.credentials.create({
    publicKey: options,
  })) as PublicKeyCredential;

  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    clientDataJSON: bufferToBase64(response.clientDataJSON),
    attestationObject: bufferToBase64(response.attestationObject),
  };
}

/**
 * Starts a WebAuthn authentication (login) ceremony.
 *
 * @param getArgs - the `{ publicKey }` object returned by the PHP backend.
 */
export async function startAuthentication(
  getArgs: Record<string, unknown>
): Promise<{
  id: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
}> {
  const publicKey = getArgs.publicKey as Record<string, unknown> & {
    challenge: string;
    allowCredentials?: Array<{ id: string; type?: string }>;
  };

  const options: PublicKeyCredentialRequestOptions = {
    ...publicKey,
    challenge: base64UrlToArrayBuffer(publicKey.challenge),
    allowCredentials: (publicKey.allowCredentials || []).map(({ id }) => ({
      id: base64UrlToArrayBuffer(id),
    })),
  } as PublicKeyCredentialRequestOptions;

  const credential = (await navigator.credentials.get({
    publicKey: options,
  })) as PublicKeyCredential;

  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    id: bufferToBase64Url(credential.rawId),
    clientDataJSON: bufferToBase64(response.clientDataJSON),
    authenticatorData: bufferToBase64(response.authenticatorData),
    signature: bufferToBase64(response.signature),
  };
}
