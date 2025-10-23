export default function SnidanovaSecce() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          🌅 Snídaňová nabídka
        </h3>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
          Začněte den sladce! Naše snídaňové speciality vám dodají energii na
          celý den.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Croissanty */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🥐</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Čerstvé croissanty
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Máslové, čokoládové nebo mandlové. Pečené každé ráno z
            nejkvalitnějších surovin.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 35 Kč
          </div>
        </div>

        {/* Dánské pečivo */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🧁</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Dánské pečivo
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Tradiční receptura s různými náplněmi - tvaroh, marmeláda, skořice.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 40 Kč
          </div>
        </div>

        {/* Muffiny */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🧁</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Domácí muffiny
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Borůvkové, čokoládové nebo banánové. Ideální k ranní kávě.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 45 Kč
          </div>
        </div>

        {/* Snídaňové dorty */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🍰</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Snídaňové dortíky
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Lehké, ovocné dortíky ideální pro ranní pochutnání s čajem.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 55 Kč
          </div>
        </div>

        {/* Granola */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🥣</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Domácí granola
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            S oříšky, sušeným ovocem a medem. Zdravá volba pro aktivní ráno.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 120 Kč/100g
          </div>
        </div>

        {/* Jogurtové dezerty */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🥛</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Jogurtové dezerty
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            S čerstvým ovocem, granolou a medem. Osvěžující start do dne.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 65 Kč
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6 text-center">
        <h4 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
          ☕ Káva k snídani zdarma!
        </h4>
        <p className="text-amber-700 dark:text-amber-300 text-sm">
          Ke každé snídaňové objednávce nad 100 Kč dostanete kávu nebo čaj
          zdarma.
        </p>
      </div>
    </div>
  );
}
