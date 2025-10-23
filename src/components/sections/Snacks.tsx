export default function SvacinkySecce() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          🍪 Svačinky
        </h3>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
          Ideální doplněk k odpolední kávě nebo čaji. Malé radosti pro každý
          den.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mini dortíky */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🧁</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Mini dortíky
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Různé příchutě v malém balení. Ideální pro krátkou přestávku.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 25 Kč/kus
          </div>
        </div>

        {/* Sušenky */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🍪</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Domácí sušenky
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Ovsené, čokoládové, kokosové. Křupavé a plné chuti.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 15 Kč/kus
          </div>
        </div>

        {/* Brownies */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🍫</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Brownies
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Sytě čokoládové, s oříšky nebo bez. Pro milovníky intenzivní chuti.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 35 Kč/kus
          </div>
        </div>

        {/* Macarons */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🌈</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Francouzské macarons
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Jemné mandlové pusinky s různými náplněmi. Elegantní pochutnání.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 40 Kč/kus
          </div>
        </div>

        {/* Profiteroles */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">⭕</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Profiteroles
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            Křehké věnečky plněné šlehačkou nebo krémem. Klasika francouzské
            patisserie.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 30 Kč/kus
          </div>
        </div>

        {/* Tartaletky */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-3xl mb-4">🥧</div>
          <h4 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Ovocné tartaletky
          </h4>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3">
            S čerstvým ovocem a vanilkovým krémem. Osvěžující a lehké.
          </p>
          <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Od 45 Kč/kus
          </div>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 text-center">
        <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
          📦 Balíčky pro firmy
        </h4>
        <p className="text-blue-700 dark:text-blue-300 text-sm">
          Připravujeme svačinkové balíčky pro firemní meetingy a akce. Zeptejte
          se na naše nabídky!
        </p>
      </div>
    </div>
  );
}
