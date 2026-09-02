'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: 'Pondělí',
  tue: 'Úterý',
  wed: 'Středa',
  thu: 'Čtvrtek',
  fri: 'Pátek',
  sat: 'Sobota',
  sun: 'Neděle',
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

const inputClasses =
  'w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

interface CsrfOptions {
  csrfToken: string;
  enabled: boolean;
}

export default function OwnerHoursForm({ csrf }: { csrf?: CsrfOptions }) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
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
      const data = await res.json();
      const schedule: ScheduleEntry[] = Array.isArray(data.schedule)
        ? data.schedule
        : [];
      if (schedule.length === 0) {
        setEntries([emptyEntry()]);
      } else {
        setEntries(schedule);
      }
    } catch {
      setError(
        'Nepodařilo se načíst otevírací dobu. / Could not load the opening hours.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

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

  const validate = useCallback((): string | null => {
    if (entries.length === 0) {
      return 'Přidejte prosím alespoň jedno období. / Please add at least one period.';
    }
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.startDate)) {
        return 'Neplatné počáteční datum. / Invalid start date.';
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.endDate)) {
        return 'Neplatné koncové datum. / Invalid end date.';
      }
      if (entry.startDate > entry.endDate) {
        return 'Počáteční datum nemůže být později než koncové datum. / Start date cannot be after the end date.';
      }
      for (const key of DAY_KEYS) {
        const text = entry.days[key];
        if (text.length > 100) {
          return 'Text dne je příliš dlouhý. / Day text is too long.';
        }
        if (!/^[A-Za-z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .,:\-]*$/.test(text)) {
          return 'Neplatné znaky v textu dne. / Invalid characters in day text.';
        }
      }
    }
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
          return 'Období se překrývají. / Periods overlap.';
        }
      }
    }
    return null;
  }, [entries]);

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
        body: JSON.stringify({ schedule: entries }),
      });
      if (!res.ok) {
        let message =
          'Uložení se nezdařilo. Zkuste to prosím znovu. / Saving failed. Please try again.';
        try {
          const data = await res.json();
          if (data && data.error) {
            message = data.error;
          }
        } catch {
          // ignore parse errors, keep default message
        }
        throw new Error(message);
      }
      setSuccess(
        'Otevírací doba byla úspěšně uložena. / Opening hours saved successfully.'
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Uložení se nezdařilo. Zkuste to prosím znovu. / Saving failed. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }, [entries, validate, csrfToken]);

  const previewText = useMemo(() => {
    if (entries.length === 0) return 'Zatím žádné období. / No periods yet.';
    return entries
      .map(entry => {
        const days = DAY_KEYS.filter(k => entry.days[k].trim() !== '')
          .map(k => `${DAY_LABELS[k]}: ${entry.days[k] || '—'}`)
          .join(', ');
        return `${entry.startDate} → ${entry.endDate}: ${days || '—'}`;
      })
      .join('\n');
  }, [entries]);

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
          Načítám otevírací dobu… / Loading opening hours…
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
                    Období {index + 1} / Period {index + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeEntry(index)}
                    className="text-sm text-red-600 hover:text-red-500 dark:text-red-400 disabled:opacity-50"
                    disabled={entries.length === 1}
                  >
                    Odebrat / Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      Počáteční datum / Start date
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
                      Koncové datum / End date
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
                        {DAY_LABELS[key]}
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
            + Přidat období / Add period
          </button>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Ukládám… / Saving…' : 'Uložit / Save'}
            </button>
            {saving && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Ukládám změny…
              </span>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Náhled / Preview
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
