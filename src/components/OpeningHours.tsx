'use client';

import { useEffect, useState } from 'react';
import { parseJsonc } from '@/lib/jsonc';

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

export interface HoursException {
  date: string; // YYYY-MM-DD
  hours: string; // '' = closed on that date
}

interface HoursData {
  schedule?: Array<{
    startDate: string;
    endDate: string;
    days: Record<string, string>;
  }>;
  exceptions?: HoursException[];
}

/**
 * Builds a local YYYY-MM-DD string from a Date. Unlike
 * toISOString().slice(0, 10) this does not shift the date into UTC, which
 * matters around midnight for the Czech CET/CEST timezone.
 */
export function todayLocalIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type WeekdayKey = 'pondeli' | 'utery' | 'streda' | 'ctvrtek' | 'patek';

// Maps JS getDay() (0 = Sunday … 6 = Saturday) to the Mon–Fri row keys.
const ROW_BY_JS_DAY: Record<number, WeekdayKey> = {
  1: 'pondeli',
  2: 'utery',
  3: 'streda',
  4: 'ctvrtek',
  5: 'patek',
};

/**
 * Returns the JS day index (0 = Sunday … 6 = Saturday) for a local
 * YYYY-MM-DD string, parsed without UTC timezone shifts.
 */
function localJsDay(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
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
  const [exceptions, setExceptions] = useState<HoursException[]>([]);

  useEffect(() => {
    const today = todayLocalIso();
    fetch(`/opening-hours.jsonc?v=${Date.now()}`)
      .then(res => {
        if (!res.ok) return null;
        // JSONC: the file is hand-edited and may contain comments and
        // trailing commas, which strict res.json() would reject.
        return res.text().then(text => parseJsonc<HoursData>(text));
      })
      .then(data => {
        if (Array.isArray(data?.exceptions)) {
          setExceptions(
            data.exceptions.filter(
              (e: { date?: unknown; hours?: unknown }) =>
                typeof e?.date === 'string' && typeof e?.hours === 'string'
            )
          );
        }

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

  // An exact-date exception overrides the weekly schedule for today.
  const today = todayLocalIso();
  const exception = exceptions.find(x => x.date === today);
  const exceptionDay = exception ? localJsDay(exception.date) : -1;
  const weekdayExceptionKey = exception
    ? (ROW_BY_JS_DAY[exceptionDay] ?? null)
    : null;
  const weekendException =
    exception && (exceptionDay === 0 || exceptionDay === 6) ? exception : null;

  const dayCell = (key: WeekdayKey): { text: string; closed: boolean } => {
    if (exception && weekdayExceptionKey === key) {
      return { text: exception.hours, closed: exception.hours === '' };
    }
    const text = schedule[key];
    return {
      text,
      closed: (key === 'pondeli' || key === 'patek') && hasNotClosedText(text),
    };
  };

  const pondeli = dayCell('pondeli');
  const utery = dayCell('utery');
  const streda = dayCell('streda');
  const ctvrtek = dayCell('ctvrtek');
  const patek = dayCell('patek');

  return (
    <div id="openinghours">
      <div id="opening-hours">
        <h3 className="text-lg font-semibold mb-3 text-amber-600 dark:text-amber-400 md:text-amber-400!">
          {heading}
        </h3>
        <div className="space-y-2 text-zinc-600 dark:text-zinc-300 md:text-zinc-300!">
          <div className="flex justify-between">
            <span>Pondělí</span>
            <span className={pondeli.closed ? redClosedClasses : 'font-medium'}>
              {pondeli.text}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Úterý</span>
            <span className={utery.closed ? redClosedClasses : 'font-medium'}>
              {utery.text}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Středa</span>
            <span className={streda.closed ? redClosedClasses : 'font-medium'}>
              {streda.text}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Čtvrtek</span>
            <span className={ctvrtek.closed ? redClosedClasses : 'font-medium'}>
              {ctvrtek.text}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Pátek</span>
            <span className={patek.closed ? redClosedClasses : 'font-medium'}>
              {patek.text}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Sobota - Neděle, svátky</span>
            {weekendException ? (
              <span
                className={
                  weekendException.hours === ''
                    ? redClosedClasses
                    : 'font-medium'
                }
              >
                {weekendException.hours}
              </span>
            ) : (
              <span className={redClosedClasses}>{notClosedText}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
