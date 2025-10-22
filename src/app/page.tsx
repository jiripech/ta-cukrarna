import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header Section with Background Image */}
      <header
        className="relative h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
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
            className="brightness-0 invert"
            style={{ width: 'auto', height: 'auto', maxHeight: '8rem' }}
            priority
          />
        </div>

        {/* Header Content */}
        <div className="relative z-10 text-center text-white px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
            Ta Cukrárna
          </h1>
          <p
            id="header-description"
            className="text-lg md:text-xl mb-8 max-w-2xl mx-auto"
          >
            Zakázková výroba netradičních, tradičních i&nbsp;luxusních
            a&nbsp;elegantních zákusků, dortů, dezertů, sušenek a&nbsp;sladkého
            trvanlivého pečiva.
          </p>
          <div
            id="header-cta"
            className="bg-white/20 backdrop-blur-sm text-white px-8 py-3 rounded-full font-medium border border-white/30"
          >
            Kontaktujte nás pro více informací
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Vítejte v Ta Cukrárna
          </h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Připravujeme pro vás čerstvé dorty, zákusky a sladké pokušení každý
            den. Naše cukrárna kombinuje tradiční recepty s moderním přístupem.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-6">
            <div className="text-4xl mb-4">🍰</div>
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              Čerstvé dorty
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Denně připravujeme dorty z kvalitních surovin
            </p>
          </div>

          <div className="text-center p-6">
            <div className="text-4xl mb-4">☕</div>
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              Káva & Čaj
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Výběrová káva a prémiové čaje k našim dezertům
            </p>
          </div>

          <div className="text-center p-6">
            <div className="text-4xl mb-4">🎂</div>
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              Na zakázku
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Vytvoříme dort přesně podle vašich představ
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-zinc-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 Ta Cukrárna. Všechna práva vyhrazena.</p>
        </div>
      </footer>
    </div>
  );
}
