// NOTE: these flags are read by client ('use client') components, so they MUST
// use the NEXT_PUBLIC_ prefix. Next.js only inlines NEXT_PUBLIC_* env vars into
// client bundles at build time; a bare process.env.X in client code resolves to
// runtime process.env (undefined in the browser), silently disabling the flag.
export const USE_CHATBOT = process.env.NEXT_PUBLIC_USE_CHATBOT === '1';
export const USE_ADMIN = process.env.NEXT_PUBLIC_USE_ADMIN === '1';
