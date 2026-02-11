import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import PWARegistration from '@/components/PWARegistration';
import ClarityTracker from '@/components/Clarity';
import ShakeToShowFooter from '@/components/ShakeToShowFooter';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title:
    'Cukrárna v centru Hradce Králové, Rodinná cukrárna přímo v centru města',
  description:
    'Rádi vás uvidíme v naší komorní kavárničce - čekají zde na vás skvělé domácí koláče, zákusky a výtečné kafe',
  keywords: [
    'cukrárna',
    'dorty',
    'zákusky',
    'dezerty',
    'svatební dorty',
    'zakázka',
  ],
  authors: [{ name: 'RevoFab s.r.o.' }],
  creator: 'RevoFab s.r.o.',
  publisher: 'RevoFab s.r.o.',
  robots: 'index, follow',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.ico' },
      { url: '/img/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/img/favicon.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/icon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ta Cukrárna',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

function getVersion(): string | undefined {
  try {
    const file = path.join(process.cwd(), 'public', 'version.txt');
    if (fs.existsSync(file)) {
      const v = fs.readFileSync(file, 'utf8').trim();
      if (v) return v;
    }
    // Fallback for developer preview: use git short sha when version file is missing
    const sha = execSync('git rev-parse --short HEAD').toString().trim();
    return `Version: ${sha}`;
  } catch {
    return undefined;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const version = getVersion();

  return (
    <html lang="cs">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClarityTracker />
        <PWARegistration />
        {children}
        {version && (
          <div className="version-footer" id="site-version-footer">
            {version}
          </div>
        )}
        <ShakeToShowFooter />
      </body>
    </html>
  );
}
