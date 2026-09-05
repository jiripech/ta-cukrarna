'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseJsonc } from '@/lib/jsonc';
import { makeT, pickBilingual, useLang } from '@/lib/i18n';

export interface ScheduleEntry {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: {
    mon: string;
    tue: string;
    wed: string;
    thu: string;
    fri: string;
    sat: string;
    sun: string;
  };
}

export interface HoursException {
  date: string; // YYYY-MM-DD
  hours: string; // '' = closed on that date
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<
  (typeof DAY_KEYS)[number],
  Record<'cs' | 'en', string>
> = {
  mon: { cs: 'Pondělí', en: 'Monday' },
  tue: { cs: 'Úterý', en: 'Tuesday' },
  wed: { cs: 'Středa', en: 'Wednesday' },
  thu: { cs: 'Čtvrtek', en: 'Thursday' },
  fri: { cs: 'Pátek', en: 'Friday' },
  sat: { cs: 'Sobota', en: 'Saturday' },
  sun: { cs: 'Neděle', en: 'Sunday' },
};

const EMPTY_DAYS: ScheduleEntry['days'] = {
  mon: '',
  tue: '',
  wed: '',
  thu: '',
  fri: '',
  sat: '',
  sun: '',
};

function emptyEntry(): ScheduleEntry {
  const year = new Date().getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    days: { ...EMPTY_DAYS },
  };
}

/** Coerces a hand-edited schedule entry to the full 7-day shape. */
function normalizeEntry(entry: unknown): ScheduleEntry {
  const record =
    entry && typeof entry === 'object'
      ? (entry as Record<string, unknown>)
      : {};
  const rawDays =
    record.days && typeof record.days === 'object'
      ? (record.days as Record<string, unknown>)
      : {};
  const days = {} as ScheduleEntry['days'];
  for (const key of DAY_KEYS) {
    days[key] =
      typeof rawDays[key] === 'string' ? (rawDays[key] as string) : '';
  }
  return {
    startDate: typeof record.startDate === 'string' ? record.startDate : '',
    endDate: typeof record.endDate === 'string' ? record.endDate : '',
    days,
  };
}

/** Coerces a hand-edited exception to the {date, hours} shape. */
function normalizeException(exception: unknown): HoursException {
  const record =
    exception && typeof exception === 'object'
      ? (exception as Record<string, unknown>)
      : {};
  return {
    date: typeof record.date === 'string' ? record.date : '',
    hours: typeof record.hours === 'string' ? record.hours : '',
  };
}

const inputClasses =
  'w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

interface CsrfOptions {
  csrfToken: string;
  enabled: boolean;
}

export default function OwnerHoursForm({ csrf }: { csrf?: CsrfOptions }) {
  const lang = useLang();
  const t = makeT(lang);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [exceptions, setExceptions] = useState<HoursException[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const csrfToken = csrf?.enabled ? csrf.csrfToken : undefined;

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/opening-hours.php', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Nepodařilo se načíst otevírací dobu.');
      }
      // The runtime file is JSONC (hand-edited: comments and trailing
      // commas), so strict res.json() would throw on it.
      const data = parseJsonc<{
        schedule?: unknown[];
        exceptions?: unknown[];
      }>(await res.text());
      // The file is hand-editable, so entries can be partial (a real-world
      // example: a days object with mon-fri only, missing sat/sun). Normalize
      // every entry to the full shape, or the preview/renderer would crash
      // on missing keys.
      const schedule: ScheduleEntry[] = (
        Array.isArray(data?.schedule) ? data.schedule : []
      ).map(normalizeEntry);
      setExceptions(
        (Array.isArray(data?.exceptions) ? data.exceptions : []).map(
          normalizeException
        )
      );
      if (schedule.length === 0) {
        setEntries([emptyEntry()]);
      } else {
        setEntries(schedule);
      }
    } catch (e) {
      setError(
        t(
          'Nepodařilo se načíst otevírací dobu.',
          'Could not load the opening hours.'
        ) +
          // Surface the real cause in the UI - no browser devtools needed.
          (e instanceof Error && e.message ? ` (${e.message})` : '')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const updateEntry = useCallback(
    (index: number, patch: Partial<ScheduleEntry>) => {
      setEntries(prev =>
        prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
      );
    },
    []
  );

  const updateDay = useCallback(
    (index: number, day: keyof ScheduleEntry['days'], value: string) => {
      setEntries(prev =>
        prev.map((entry, i) =>
          i === index
            ? { ...entry, days: { ...entry.days, [day]: value } }
            : entry
        )
      );
    },
    []
  );

  const addEntry = useCallback(() => {
    setEntries(prev => [...prev, emptyEntry()]);
  }, []);

  const removeEntry = useCallback((index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateException = useCallback(
    (index: number, patch: Partial<HoursException>) => {
      setExceptions(prev =>
        prev.map((exception, i) =>
          i === index ? { ...exception, ...patch } : exception
        )
      );
    },
    []
  );

  const addException = useCallback(() => {
    setExceptions(prev => [...prev, { date: '', hours: '' }]);
  }, []);

  const removeException = useCallback((index: number) => {
    setExceptions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const validate = useCallback((): string | null => {
    if (entries.length === 0) {
      return t(
        'Přidejte prosím alespoň jedno období.',
        'Please add at least one period.'
      );
    }
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.startDate)) {
        return t('Neplatné počáteční datum.', 'Invalid start date.');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.endDate)) {
        return t('Neplatné koncové datum.', 'Invalid end date.');
      }
      if (entry.startDate > entry.endDate) {
        return t(
          'Počáteční datum nemůže být později než koncové datum.',
          'Start date cannot be after the end date.'
        );
      }
      for (const key of DAY_KEYS) {
        const text = entry.days[key];
        if (text.length > 100) {
          return t('Text dne je příliš dlouhý.', 'Day text is too long.');
        }
        if (!/^[A-Za-z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .,:\-]*$/.test(text)) {
          return t(
            'Neplatné znaky v textu dne.',
            'Invalid characters in day text.'
          );
        }
      }
    }
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
          return t('Období se překrývají.', 'Periods overlap.');
        }
      }
    }
    for (let i = 0; i < exceptions.length; i++) {
      const exception = exceptions[i];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.date)) {
        return t('Neplatné datum výjimky.', 'Invalid exception date.');
      }
      if (exception.hours.length > 100) {
        return t(
          'Text výjimky je příliš dlouhý.',
          'Exception text is too long.'
        );
      }
      if (
        !/^[A-Za-z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .,:\-]*$/.test(
          exception.hours
        )
      ) {
        return t(
          'Neplatné znaky v textu výjimky.',
          'Invalid characters in exception text.'
        );
      }
    }
    for (let i = 0; i < exceptions.length; i++) {
      for (let j = i + 1; j < exceptions.length; j++) {
        if (exceptions[i].date === exceptions[j].date) {
          return t(
            'Data výjimek se nesmí opakovat.',
            'Exception dates must be unique.'
          );
        }
      }
    }
    return null;
  }, [t, entries, exceptions]);

  const save = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const res = await fetch('/api/opening-hours.php', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ schedule: entries, exceptions }),
      });
      if (!res.ok) {
        let message = t(
          'Uložení se nezdařilo. Zkuste to prosím znovu.',
          'Saving failed. Please try again.'
        );
        try {
          const data = await res.json();
          if (data && data.error) {
            // Server errors are bilingual ("cs / en") - show one language.
            message = pickBilingual(String(data.error), lang);
          }
        } catch {
          // ignore parse errors, keep default message
        }
        throw new Error(message);
      }
      setSuccess(
        t(
          'Otevírací doba byla úspěšně uložena.',
          'Opening hours saved successfully.'
        )
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              'Uložení se nezdařilo. Zkuste to prosím znovu.',
              'Saving failed. Please try again.'
            )
      );
    } finally {
      setSaving(false);
    }
  }, [t, lang, entries, exceptions, validate, csrfToken]);

  const previewText = useMemo(() => {
    if (entries.length === 0)
      return t('Zatím žádné období.', 'No periods yet.');
    return entries
      .map(entry => {
        const days = DAY_KEYS.filter(k => entry.days[k].trim() !== '')
          .map(k => `${DAY_LABELS[k][lang]}: ${entry.days[k] || '—'}`)
          .join(', ');
        return `${entry.startDate} → ${entry.endDate}: ${days || '—'}`;
      })
      .join('\n');
  }, [t, entries, lang]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40 px-4 py-3 text-sm text-green-700 dark:text-green-200">
          {success}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">
          {t('Načítám otevírací dobu…', 'Loading opening hours…')}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-6">
            {entries.map((entry, index) => (
              <div
                key={index}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {t('Období', 'Period')} {index + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeEntry(index)}
                    className="text-sm text-red-600 hover:text-red-500 dark:text-red-400 disabled:opacity-50"
                    disabled={entries.length === 1}
                  >
                    {t('Odebrat', 'Remove')}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {t('Počáteční datum', 'Start date')}
                    </span>
                    <input
                      type="date"
                      value={entry.startDate}
                      onChange={e =>
                        updateEntry(index, { startDate: e.target.value })
                      }
                      className={inputClasses}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {t('Koncové datum', 'End date')}
                    </span>
                    <input
                      type="date"
                      value={entry.endDate}
                      onChange={e =>
                        updateEntry(index, { endDate: e.target.value })
                      }
                      className={inputClasses}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {DAY_KEYS.map(key => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        {DAY_LABELS[key][lang]}
                      </span>
                      <input
                        type="text"
                        value={entry.days[key]}
                        onChange={e => updateDay(index, key, e.target.value)}
                        placeholder="9:00 - 17:00"
                        className={inputClasses}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addEntry}
            className="rounded-md border border-amber-500 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors"
          >
            {t('+ Přidat období', '+ Add period')}
          </button>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {t('Výjimky', 'Exceptions')}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t(
                  'Výjimka pro konkrétní datum přepíše týdenní otevírací dobu; prázdné hodiny znamenají zavřeno.',
                  'An exception for a specific date overrides the weekly schedule; empty hours means closed.'
                )}
              </p>
            </div>

            {exceptions.map((exception, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 sm:flex-row sm:items-end"
              >
                <label className="block sm:w-56">
                  <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {t('Datum', 'Date')}
                  </span>
                  <input
                    type="date"
                    value={exception.date}
                    onChange={e =>
                      updateException(index, { date: e.target.value })
                    }
                    aria-label={`${t('Datum výjimky', 'Exception date')}${exception.date ? ` ${exception.date}` : ''}`}
                    className={inputClasses}
                  />
                </label>
                <label className="block flex-1">
                  <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {t('Hodiny', 'Hours')}
                  </span>
                  <input
                    type="text"
                    value={exception.hours}
                    onChange={e =>
                      updateException(index, { hours: e.target.value })
                    }
                    placeholder="9:00 - 15:00"
                    aria-label={
                      exception.date
                        ? `${t('Hodiny pro', 'Hours for')} ${exception.date}`
                        : t('Hodiny pro výjimku', 'Hours for exception')
                    }
                    className={inputClasses}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeException(index)}
                  className="text-sm text-red-600 hover:text-red-500 dark:text-red-400 disabled:opacity-50"
                >
                  {t('Odebrat', 'Remove')}
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addException}
              className="rounded-md border border-amber-500 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors"
            >
              {t('+ Přidat výjimku', '+ Add exception')}
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {saving ? t('Ukládám…', 'Saving…') : t('Uložit', 'Save')}
            </button>
            {saving && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {t('Ukládám změny…', 'Saving changes…')}
              </span>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t('Náhled', 'Preview')}
            </h4>
            <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {previewText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
