import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import PWARegistration from '@/components/PWARegistration';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Ta Cukrárna - Luxusní dorty a zákusky na zakázku',
  description:
    'Zakázková výroba netradičních, tradičních i luxusních a elegantních zákusků, dortů, dezertů, sušenek a sladkého trvanlivého pečiva.',
  keywords: [
    'cukrárna',
    'dorty',
    'zákusky',
    'dezerty',
    'svatební dorty',
    'zakázka',
  ],
  authors: [{ name: 'Ta Cukrárna' }],
  creator: 'Ta Cukrárna',
  publisher: 'Ta Cukrárna',
  robots: 'index, follow',
  manifest: '/manifest.json',
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
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ta Cukrárna" />
        <link rel="manifest" href="/manifest.json" />
        {/* Favicon odkazy */}
        <link rel="icon" type="image/x-icon" href="/icon.ico" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/img/favicon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/img/favicon.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link rel="shortcut icon" href="/icon.ico" />
        <link
          rel="preload"
          href="/img/logo.svg"
          as="image"
          type="image/svg+xml"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PWARegistration />
        {children}
      </body>
    </html>
  );
}
