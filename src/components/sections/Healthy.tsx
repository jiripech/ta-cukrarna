export default function ZdraveMlsaniSecce() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          🥗 Zdravé mlsání
        </h3>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
          Sladkosti, které nemusíte litovat! Připraveno s důrazem na kvalitní
          ingredience a vyváženou výživu.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Raw koule */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🌰</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Raw energy koule
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Z datliů, oříšků a superfoods. Bez cukru, bez mouky, plné energie.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 20 Kč/kus
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ Vegan ✓ Bez lepku ✓ Raw
          </div>
        </div>

        {/* Proteinové tyčinky */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">💪</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Proteinové tyčinky
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Domácí výroba s kvalitním proteinem. Ideální po sportu nebo jako
            zdravá svačina.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 55 Kč/kus
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ Vysoký obsah bílkovin ✓ Bez rafinovaného cukru
          </div>
        </div>

        {/* Chia pudinky */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🍮</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Chia pudinky
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            S mandlovým mlékem, čerstvým ovocem a přírodním sladidlem.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 65 Kč/porce
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ Vegan ✓ Omega-3 ✓ Bez lepku
          </div>
        </div>

        {/* Ovesné sušenky */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🌾</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Zdravé ovesné sušenky
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            S banánem, oříšky a rozinkami. Slazené pouze přírodně.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 18 Kč/kus
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ Bez rafinovaného cukru ✓ Vláknina
          </div>
        </div>

        {/* Smoothie bowls */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🍓</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Smoothie bowls
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Hustá smoothie s toppingy - granola, ovoce, semínka, coconut flakes.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 85 Kč/bowl
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ Antioxidanty ✓ Vitaminy ✓ Raw
          </div>
        </div>

        {/* Fit dorty */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🎂</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Fitness dorty na zakázku
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Celozrnné mouky, přírodní sladidla, proteinový krém. Chuť bez
            kompromisů.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 450 Kč/kg
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            ✓ Na zakázku ✓ Bez rafinovaného cukru
          </div>
        </div>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
        <div className="flex items-start space-x-4">
          <div className="text-2xl">🌱</div>
          <div>
            <h4 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
              Naše zdravé filosofie
            </h4>
            <p className="text-green-700 dark:text-green-300 text-sm mb-3">
              Věříme, že sladkosti mohou být i zdravé. Používáme kvalitní
              suroviny, minimálně zpracované ingredience a přírodní sladidla.
              Každý výrobek je připraven s láskou a péčí o vaše zdraví.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                Bio suroviny
              </span>
              <span className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                Bez konzervantů
              </span>
              <span className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                Lokální dodavatelé
              </span>
              <span className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                Čerstvá výroba
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
