import { test, expect } from '@playwright/test';
import { bufferToBase64Url, base64UrlToArrayBuffer } from '@/lib/webauthn';

/**
 * Unit tests for the pure WebAuthn binary-encoding helpers
 * (src/lib/webauthn.ts).
 *
 * These verify the base64url <-> ArrayBuffer round-trip used to map the PHP
 * backend's base64url-encoded binary fields onto the native WebAuthn options.
 * They run in the Node test worker (no browser / authenticator needed).
 */

function toBytes(s: string): Uint8Array {
  return new Uint8Array([...s].map(c => c.charCodeAt(0)));
}

function bytesOf(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

test('bufferToBase64Url encodes arbitrary bytes as unpadded base64url', () => {
  // 'abc' -> base64 'YWJj' -> base64url 'YWJj' (no '+'/'-' null bytes needed here)
  expect(bufferToBase64Url(toBytes('abc').buffer)).toBe('YWJj');

  // Empty input.
  expect(bufferToBase64Url(new ArrayBuffer(0))).toBe('');

  // 0xff 0xfe -> base64 '/v4=' -> base64url '_v4'.
  expect(bufferToBase64Url(Uint8Array.from([0xff, 0xfe]).buffer)).toBe('_v4');
});

test('Round-trips base64url to bytes and back', () => {
  const sample = toBytes('abcdef');
  const encoded = bufferToBase64Url(sample.buffer);
  expect(encoded).toBe('YWJjZGVm');

  // Decode back to the exact original bytes.
  const decoded = bytesOf(base64UrlToArrayBuffer(encoded));
  expect(decoded).toEqual(sample);
});

test('decodes base64url strings that use the - and _ alphabet', () => {
  // base64url with '-' and '_' (0xfb -> '4', 0xff -> 'w' in the alphabet).
  const bytes = bytesOf(base64UrlToArrayBuffer('-_8'));
  expect(bytes).toEqual(Uint8Array.from([0xfb, 0xff]));
});

test('rejects input with characters outside the base64url alphabet', () => {
  // '@' is invalid in both base64 and base64url; atob throws.
  expect(() => base64UrlToArrayBuffer('a@b')).toThrow();
});
