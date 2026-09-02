'use client';

import { useEffect, useState } from 'react';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Determines the meteorological season for a given date.
 * Month is 0-indexed in JS Date: 0 = January, 11 = December.
 * spring = March-May (2-4), summer = June-August (5-7),
 * autumn = September-November (8-10), winter = December-February (else).
 */
export function getSeason(date: Date = new Date()): Season {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/**
 * Returns true if the date falls within the extended summer period
 * (June 1st – October 14th inclusive).
 * Month is 0-indexed: 5 = June, 6 = July, 7 = August, 8 = September, 9 = October.
 */
export function isExtendedSummer(date: Date = new Date()): boolean {
  const month = date.getMonth();
  return (month >= 5 && month <= 8) || (month === 9 && date.getDate() <= 14);
}

/**
 * Backward-compatible export indicating the summer season (June-August).
 * Month is 0-indexed: 5 = June, 6 = July, 7 = August.
 */
export function isSummerSeason(date: Date = new Date()): boolean {
  return getSeason(date) === 'summer';
}

const headingBySeason: Record<Season, string> = {
  spring: 'Jarní otevírací doba',
  summer: 'Letní otevírací doba',
  autumn: 'Podzimní otevírací doba',
  winter: 'Zimní otevírací doba',
};

export default function OpeningHours() {
  const season = getSeason();
  const extendedSummer = isExtendedSummer();
  const notClosedText = 'Výdej objednávek, dle aktuální potřeby';

  const nonSummerSchedule = {
    pondeli: '9:00 - 17:00',
    utery: '9:00 - 16:00',
    streda: '9:00 - 16:00',
    ctvrtek: '9:00 - 19:00',
    patek: '9:00 - 17:00',
  };

  const summerSchedule = {
    pondeli: notClosedText,
    utery: '9:00 - 16:00',
    streda: '9:00 - 16:00',
    ctvrtek: '9:00 - 19:00',
    patek: notClosedText,
  };

  const [customDays, setCustomDays] = useState<Record<string, string> | null>(
    null
  );

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/opening-hours.json?v=${Date.now()}`)
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then(data => {
        if (
          !data ||
          !Array.isArray(data.schedule) ||
          data.schedule.length === 0
        ) {
          return;
        }

        const entry = data.schedule.find(
          (s: {
            startDate: string;
            endDate: string;
            days: Record<string, string>;
          }) =>
            s.startDate <= today &&
            s.endDate >= today &&
            s.days &&
            typeof s.days === 'object'
        );

        if (entry) {
          const d = entry.days;
          setCustomDays({
            pondeli: d.mon,
            utery: d.tue,
            streda: d.wed,
            ctvrtek: d.thu,
            patek: d.fri,
          });
        }
      })
      .catch(() => {
        // Silently fall back to hardcoded schedule
      });
  }, []);

  const useSummer = extendedSummer || season === 'summer';
  const baseSchedule = useSummer ? summerSchedule : nonSummerSchedule;
  const schedule = customDays ?? baseSchedule;
  const isCustomSchedule = customDays !== null;

  const heading = isCustomSchedule ? 'Otevírací doba' : headingBySeason[season];

  const redClosedClasses =
    'font-medium text-red-600 dark:text-red-400 md:text-red-400!';

  const hasNotClosedText = (text: string) =>
    text === notClosedText || text.includes('Výdej');

  return (
    <div id="openinghours">
      <div id="opening-hours">
        <h3 className="text-lg font-semibold mb-3 text-amber-600 dark:text-amber-400 md:text-amber-400!">
          {heading}
        </h3>
        <div className="space-y-2 text-zinc-600 dark:text-zinc-300 md:text-zinc-300!">
          <div className="flex justify-between">
            <span>Pondělí</span>
            <span
              className={
                hasNotClosedText(schedule.pondeli)
                  ? redClosedClasses
                  : 'font-medium'
              }
            >
              {schedule.pondeli}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Úterý</span>
            <span className="font-medium">{schedule.utery}</span>
          </div>
          <div className="flex justify-between">
            <span>Středa</span>
            <span className="font-medium">{schedule.streda}</span>
          </div>
          <div className="flex justify-between">
            <span>Čtvrtek</span>
            <span className="font-medium">{schedule.ctvrtek}</span>
          </div>
          <div className="flex justify-between">
            <span>Pátek</span>
            <span
              className={
                hasNotClosedText(schedule.patek)
                  ? redClosedClasses
                  : 'font-medium'
              }
            >
              {schedule.patek}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Sobota - Neděle, svátky</span>
            <span className={redClosedClasses}>{notClosedText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
