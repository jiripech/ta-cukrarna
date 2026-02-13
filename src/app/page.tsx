'use client';

import Image from 'next/image';
import PhotoSlideshow from '@/components/PhotoSlideshow';
export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header Section with Background Image */}
      <header
        className="relative h-[50vh] flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/img/header_bg.png')",
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>

        {/* Logo - Top Left */}
        <div className="absolute top-6 left-6 z-20">
          <Image
            src="/img/logo.svg"
            alt="Ta Cukrárna Logo"
            width={240}
            height={120}
            style={{ width: 'auto', height: 'auto' }}
            className="brightness-0 invert max-h-32"
            priority
          />
        </div>

        {/* Header Content */}
        <div className="relative z-10 text-center text-white px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
            Cukrárna v centru Hradce Králové
          </h1>
          <h2
            id="header-description"
            className="text-lg md:text-xl mb-8 max-w-2xl mx-auto"
          >
            Rodinná cukrárna přímo v&nbsp;centru města
          </h2>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Rádi vás uvidíme v naší komorní kavárničce - čekají zde na vás
            skvělé domácí koláče, zákusky a&nbsp;výtečné kafe
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="main-content"
        className="container mx-auto px-4 py-12 space-y-16"
      >
        {/* Block Type A: Image + Text - Sweet Custom Dreams */}
        <div className="flex flex-col lg:flex-row items-center gap-2">
          <div id="leftCol" className="lg:w-1/2">
            <PhotoSlideshow className="h-[300px]" />
          </div>
          <div id="rightCol" className="lg:w-1/2 space-y-4">
            <h2 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-wide">
              Splníme všechna vaše sladká přání
            </h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mb-8 text-left">
              Standardně bez zbytečných umělých přísad, a&nbsp;když si budete
              přát - i&nbsp;s&nbsp;minimálním množstvím cukru, nebo speciálně
              uzpůsobené pro jiná vaše dietní omezení…
            </p>
          </div>
        </div>
      </main>

      {/* Dynamic Content Sections */}
      <section className="bg-white dark:bg-zinc-900 py-12 border-t border-zinc-200 dark:border-zinc-800">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Připravujeme pro vás více obsahu
            </h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Sledujte naše{' '}
              <a
                className="hover:text-amber-400 transition-colors"
                href="https://www.facebook.com/people/Ta-Cukr%C3%A1rna/61558181128294/"
              >
                facebookové stránky
              </a>{' '}
              a{' '}
              <a
                className="hover:text-amber-400 transition-colors"
                href="https://instagram.com/tacukrarna"
              >
                instagram
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-900 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-amber-400">
                Ta Cukrárna
              </h3>
              <div className="space-y-2 text-zinc-300">
                <div className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    <a
                      className="hover:text-amber-400 transition-colors"
                      href="https://maps.app.goo.gl/e29gMHyM2tUf8a1u8"
                      title="Mapy Google"
                    >
                      Opletalova 328/3, 500 03 Hradec Králové
                    </a>
                  </span>
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  <a
                    href="tel:+420725528580"
                    className="hover:text-amber-400 transition-colors"
                  >
                    +420&nbsp;725&nbsp;528&nbsp;580
                  </a>
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <a
                    href="mailto:info@tacukrarna.cz"
                    className="hover:text-amber-400 transition-colors"
                  >
                    info@tacukrarna.cz
                  </a>
                </div>
              </div>
            </div>

            {/* Opening Hours */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-amber-400">
                Otevírací doba
              </h3>
              <div className="space-y-2 text-zinc-300">
                <div className="flex justify-between">
                  <span>Pondělí</span>
                  <span className="font-medium">12:00 - 17:45</span>
                </div>
                <div className="flex justify-between">
                  <span>Úterý</span>
                  <span className="font-medium">8:00 - 19:00</span>
                </div>
                <div className="flex justify-between">
                  <span>Středa</span>
                  <span className="font-medium">8:00 - 17:45</span>
                </div>
                <div className="flex justify-between">
                  <span>Čtvrtek</span>
                  <span className="font-medium">8:00 - 19:00</span>
                </div>
                <div className="flex justify-between">
                  <span>Pátek</span>
                  <span className="font-medium">8:00 - 19:00</span>
                </div>
                <div className="flex justify-between">
                  <span>Sobota - Neděle, svátky</span>
                  <span className="font-medium text-red-400">Zavřeno</span>
                </div>
              </div>

              {/* Social Links */}
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2 text-amber-400">
                  Sledujte nás
                </h4>
                <div className="flex space-x-3">
                  <a
                    href="https://instagram.com/tacukrarna"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-pink-400 transition-colors"
                    title="Instagram"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.621 5.367 11.988 11.988 11.988s11.987-5.367 11.987-11.988C24.004 5.367 18.637.001 12.017.001zM8.232 16.987h-2.95V8.832h2.95v8.155zM6.757 7.535a1.71 1.71 0 01-1.708-1.708c0-.943.765-1.708 1.708-1.708.943 0 1.708.765 1.708 1.708 0 .943-.765 1.708-1.708 1.708zM18.124 16.987h-2.95v-3.96c0-1.1-.02-2.515-1.533-2.515-1.533 0-1.769 1.199-1.769 2.437v4.038h-2.95V8.832h2.832v1.112h.04c.394-.747 1.356-1.533 2.792-1.533 2.987 0 3.538 1.966 3.538 4.52v4.056z" />
                    </svg>
                  </a>
                  <a
                    href="https://wa.me/420720744786"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-green-400 transition-colors"
                    title="WhatsApp"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.106" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-zinc-800 pt-4 text-center text-zinc-400">
            <p>&copy; 2025 RevoFab s.r.o. Všechna práva vyhrazena.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
