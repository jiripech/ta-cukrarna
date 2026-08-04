'use client';

/**
 * Determines whether a given date falls within the summer season (July 1st – August 31st).
 * Month is 0-indexed in JS Date: 6 = July, 7 = August.
 */
export function isSummerSeason(date: Date = new Date()): boolean {
  const month = date.getMonth();
  return month === 6 || month === 7;
}

export default function OpeningHours() {
  const isSummer = isSummerSeason();

  const notClosedText = 'Výdej objednávek, dle aktuální potřeby';

  return (
    <div id="openinghours">
      <div id="opening-hours">
        <h3 className="text-lg font-semibold mb-3 text-amber-600 dark:text-amber-400 md:text-amber-400!">
          {isSummer ? 'Letní otevírací doba' : 'Otevírací doba'}
        </h3>
        <div className="space-y-2 text-zinc-600 dark:text-zinc-300 md:text-zinc-300!">
          <div className="flex justify-between">
            <span>Pondělí</span>
            <span
              className={
                isSummer
                  ? 'font-medium text-red-600 dark:text-red-400 md:text-red-400!'
                  : 'font-medium'
              }
            >
              {isSummer ? notClosedText : '12:00 - 17:45'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Úterý</span>
            <span className="font-medium">
              {isSummer ? '9:00 - 15:00' : '8:00 - 19:00'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Středa</span>
            <span className="font-medium">
              {isSummer ? '9:00 - 15:00' : '8:00 - 17:45'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Čtvrtek</span>
            <span className="font-medium">
              {isSummer ? '9:00 - 15:00' : '8:00 - 19:00'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Pátek</span>
            <span
              className={
                isSummer
                  ? 'font-medium text-red-600 dark:text-red-400 md:text-red-400!'
                  : 'font-medium'
              }
            >
              {isSummer ? notClosedText : '8:00 - 19:00'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Sobota - Neděle, svátky</span>
            <span className="font-medium text-red-600 dark:text-red-400 md:text-red-400!">
              {notClosedText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
