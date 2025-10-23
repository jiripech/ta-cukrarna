export default function ONasSecce() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          👩‍🍳 O nás
        </h3>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
          Poznejte tým, který s láskou připravuje vaše oblíbené sladkosti každý
          den.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-center">
        {/* Příběh */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm">
            <h4 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center">
              <span className="text-2xl mr-3">📖</span>
              Náš příběh
            </h4>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Ta Cukrárna vznikla z lásky k pečení a touhy sdílet radost z
              dobrých sladkostí. Začínali jsme jako malá rodinná dílna v roce
              2019 a postupně se rozrostli v místo, kde se setkávají tradiční
              recepty s moderními trendy.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm">
            <h4 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center">
              <span className="text-2xl mr-3">🎯</span>
              Naše mise
            </h4>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Chceme, aby každý den byl trochu sladší. Věříme v kvalitní
              suroviny, pečlivou přípravu a osobní přístup ke každému
              zákazníkovi. Každý dort, každý zákusek je pro nás malé umělecké
              dílo.
            </p>
          </div>
        </div>

        {/* Tým */}
        <div className="space-y-4">
          <h4 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 text-center mb-6">
            Náš tým
          </h4>

          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-4">
                <div className="text-3xl">👩‍🍳</div>
                <div>
                  <h5 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Jana Nováková
                  </h5>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Hlavní cukrářka & zakladatelka
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    15 let zkušeností, absolventka francouzské patisserie
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-4">
                <div className="text-3xl">🧑‍🍳</div>
                <div>
                  <h5 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Tomáš Svoboda
                  </h5>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Cukrář specializující se na dorty
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    Mistr v zakázkových dortech a čokoládových kreacích
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-4">
                <div className="text-3xl">👩‍💼</div>
                <div>
                  <h5 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Marie Krejčí
                  </h5>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Obsluha & poradkyně
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    Pomůže vám vybrat tu pravou sladkost pro každou příležitost
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hodnoty */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6">
        <h4 className="text-xl font-semibold text-amber-800 dark:text-amber-200 mb-4 text-center">
          🌟 Naše hodnoty
        </h4>
        <div className="grid md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl mb-2">🏆</div>
            <h5 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
              Kvalita
            </h5>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Pouze nejlepší suroviny a ověřené recepty
            </p>
          </div>
          <div>
            <div className="text-2xl mb-2">❤️</div>
            <h5 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
              Láska k řemeslu
            </h5>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Každý výrobek připravujeme s péčí a vášní
            </p>
          </div>
          <div>
            <div className="text-2xl mb-2">🤝</div>
            <h5 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
              Osobní přístup
            </h5>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Každý zákazník je pro nás jedinečný
            </p>
          </div>
        </div>
      </div>

      {/* Ocenění & certifikace */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm text-center">
        <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          🏅 Ocenění & certifikace
        </h4>
        <div className="flex flex-wrap justify-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="bg-zinc-100 dark:bg-zinc-700 px-3 py-1 rounded">
            Certifikace HACCP
          </span>
          <span className="bg-zinc-100 dark:bg-zinc-700 px-3 py-1 rounded">
            Nejlepší cukrárna HK 2023
          </span>
          <span className="bg-zinc-100 dark:bg-zinc-700 px-3 py-1 rounded">
            Bio certifikát
          </span>
          <span className="bg-zinc-100 dark:bg-zinc-700 px-3 py-1 rounded">
            5⭐ hodnocení zákazníků
          </span>
        </div>
      </div>
    </div>
  );
}
