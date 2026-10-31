'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseJsonc } from '@/lib/jsonc';
import { makeT, pickBilingual, useLang } from '@/lib/i18n';

export interface ScheduleEntry {
  startDate: string;
  endDate: string;
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
  date: string;
  hours: string;
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

function addDays(iso: string, days: number) {
  const [y, m, day] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + days));
  return dt.toISOString().slice(0, 10);
}

function ensureContiguous(entries: ScheduleEntry[]): ScheduleEntry[] {
  const out = entries.map(e => ({ ...e, days: { ...e.days } }));
  for (let i = 0; i < out.length; i++) {
    if (i > 0) {
      out[i].startDate = addDays(out[i - 1].endDate, 1);
    }
    if (i === out.length - 1) {
      out[i].endDate = '9999-12-31';
    }
  }
  return out;
}

function emptyEntry(): ScheduleEntry {
  const year = new Date().getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    days: { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' },
  };
}

function emptyDayMap(): Record<string, string> {
  return Object.fromEntries(DAY_KEYS.map(k => [k, '']));
}

/**
 * Normalizes the server's `defaults` (nested by season key, see
 * SPECIFICATION.md §4.3) into day-keyed maps, keeping unknown season keys so
 * a save never drops them.
 */
function normalizeDefaults(
  raw: unknown
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {
    summer: emptyDayMap(),
    spring: emptyDayMap(),
  };
  if (!raw || typeof raw !== 'object') {
    return out;
  }
  for (const [season, days] of Object.entries(raw as Record<string, unknown>)) {
    if (!days || typeof days !== 'object') continue;
    const rec = days as Record<string, unknown>;
    const map = emptyDayMap();
    for (const k of DAY_KEYS) {
      map[k] = typeof rec[k] === 'string' ? (rec[k] as string) : '';
    }
    out[season] = map;
  }
  return out;
}

function normalizeEntry(entry: unknown): ScheduleEntry {
  const rec =
    entry && typeof entry === 'object'
      ? (entry as Record<string, unknown>)
      : {};
  const raw =
    rec.days && typeof rec.days === 'object'
      ? (rec.days as Record<string, unknown>)
      : {};
  const days = {} as ScheduleEntry['days'];
  for (const k of DAY_KEYS) {
    days[k] = typeof raw[k] === 'string' ? (raw[k] as string) : '';
  }
  return {
    startDate: typeof rec.startDate === 'string' ? rec.startDate : '',
    endDate: typeof rec.endDate === 'string' ? rec.endDate : '',
    days,
  };
}

function normalizeException(e: unknown): HoursException {
  const r = e && typeof e === 'object' ? (e as Record<string, unknown>) : {};
  return {
    date: typeof r.date === 'string' ? r.date : '',
    hours: typeof r.hours === 'string' ? r.hours : '',
  };
}

interface CsrfOptions {
  csrfToken: string;
  enabled: boolean;
}

export default function OwnerHoursGlassForm({ csrf }: { csrf?: CsrfOptions }) {
  const lang = useLang();
  const t = makeT(lang);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [exceptions, setExceptions] = useState<HoursException[]>([]);
  const [defaults, setDefaults] = useState<
    Record<string, Record<string, string>>
  >(() => ({ summer: emptyDayMap(), spring: emptyDayMap() }));
  const [defaultsModalOpen, setDefaultsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const csrfToken = csrf?.enabled ? csrf.csrfToken : undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/opening-hours.php', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('load fail');
        const data = parseJsonc<unknown>(await res.text()) as Record<
          string,
          unknown
        >;
        const schedule = Array.isArray(data?.schedule)
          ? data.schedule
          : undefined;
        const ex = data?.exceptions;
        const norm = (Array.isArray(schedule) ? schedule : []).map(
          normalizeEntry
        );
        if (!cancelled) {
          setEntries(norm.length ? norm : [emptyEntry()]);
          setExceptions((Array.isArray(ex) ? ex : []).map(normalizeException));
          setDefaults(normalizeDefaults(data?.defaults));
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '';
          setError(
            t(
              'Nepodařilo se načíst otevírací dobu.',
              'Could not load opening hours.'
            ) + (msg ? ` (${msg})` : '')
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const updateEntry = (i: number, patch: Partial<ScheduleEntry>) =>
    setEntries(prev =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e))
    );
  const updateDay = (i: number, day: keyof ScheduleEntry['days'], v: string) =>
    setEntries(prev =>
      prev.map((e, idx) =>
        idx === i ? { ...e, days: { ...e.days, [day]: v } } : e
      )
    );

  const addSeasonAt = (idx: number | null) => {
    setEntries(prev => {
      const list = [...prev];
      const start = (() => {
        if (idx === null) {
          const last = list[list.length - 1];
          return last
            ? addDays(last.endDate, 1)
            : addDays(new Date().toISOString().slice(0, 10), 0);
        }
        const prevEntry = list[idx - 1];
        return prevEntry
          ? addDays(prevEntry.endDate, 1)
          : addDays(new Date().toISOString().slice(0, 10), 0);
      })();
      // Prefill from the saved default matching the season the new entry
      // starts in (July/August = summer template, otherwise the rest of
      // the year).
      const month = Number(start.slice(5, 7));
      const templateKey = month >= 7 && month <= 8 ? 'summer' : 'spring';
      const baseDays = {
        ...emptyDayMap(),
        ...(defaults[templateKey] ?? {}),
      } as ScheduleEntry['days'];
      if (idx === null) {
        const newEntry: ScheduleEntry = {
          startDate: start,
          endDate: '9999-12-31',
          days: baseDays,
        };
        return [...list, newEntry];
      } else {
        const nextEntry = list[idx];
        const end = nextEntry ? addDays(nextEntry.startDate, -1) : '9999-12-31';
        const newEntry: ScheduleEntry = {
          startDate: start,
          endDate: end,
          days: baseDays,
        };
        list.splice(idx, 0, newEntry);
        return list;
      }
    });
  };

  const removeEntry = (i: number) =>
    setEntries(prev =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev
    );

  const validate = useCallback((): string | null => {
    if (entries.length === 0)
      return t(
        'Přidejte prosím alespoň jedno období.',
        'Please add at least one period.'
      );
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(e.startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.endDate)
      )
        return t('Neplatné datum.', 'Invalid date.');
      if (e.startDate > e.endDate)
        return t('Počátek po konci.', 'Start after end.');
      for (const k of DAY_KEYS) {
        if (e.days[k].length > 100)
          return t('Příliš dlouhý text.', 'Text too long.');
      }
    }
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i],
          b = entries[j];
        if (a.startDate <= b.endDate && b.startDate <= a.endDate)
          return t('Období se překrývají.', 'Periods overlap.');
      }
    }
    return null;
  }, [entries, t]);

  const save = useCallback(async () => {
    const normalized = ensureContiguous(entries);
    const v = validate();
    if (v) {
      setError(v);
      setSuccess(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const headers: { 'Content-Type': string; 'X-CSRF-Token'?: string } = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
      const res = await fetch('/api/opening-hours.php', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ schedule: normalized, exceptions, defaults }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(
          pickBilingual(String(d?.error || ''), lang) ||
            t('Uložení selhalo.', 'Save failed.')
        );
      }
      setSuccess(
        t(
          'Otevírací doba byla úspěšně uložena.',
          'Opening hours saved successfully.'
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg || t('Uložení selhalo.', 'Save failed.'));
    } finally {
      setSaving(false);
    }
  }, [entries, exceptions, defaults, validate, csrfToken, lang, t]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const WEEKDAY_IDX: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const previewRows = useMemo(() => {
    const dateForWeekday = (
      baseIso: string,
      weekday: keyof ScheduleEntry['days']
    ) => {
      const base = new Date(baseIso + 'T00:00:00Z');
      const baseIdx = base.getUTCDay();
      const targetIdx = WEEKDAY_IDX[weekday as string] ?? 1;
      const offset = (targetIdx - baseIdx + 7) % 7;
      return addDays(baseIso, offset);
    };
    const closedText = t('Zavřeno', 'Closed');
    const pickupText = t('Výdej objednávek', 'Order pickup');
    return DAY_KEYS.map(k => {
      const targetDate = dateForWeekday(today, k);
      const season = entries.find(
        e => targetDate >= e.startDate && targetDate <= e.endDate
      );
      let txt = season?.days[k] || '';
      const exc = exceptions.find(e => e.date === targetDate);
      if (exc) txt = exc.hours;
      const closed =
        !txt ||
        txt.includes('Výdej') ||
        txt.includes('Pickup') ||
        txt.includes(pickupText);
      return {
        label: DAY_LABELS[k][lang],
        text: txt || closedText,
        closed,
        targetDate,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, exceptions, lang, t, today]);

  if (loading) {
    return (
      <div className="glass-card text-center">
        <p className="glass-text">{t('Načítám…', 'Loading…')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="glass-page min-h-[70vh] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">
              {t('Správa sezón', 'Season management')}
            </h2>
            <button
              className="glass-submit-full w-auto px-4 py-2"
              onClick={() => setDefaultsModalOpen(true)}
            >
              {t('Upravit výchozí', 'Edit defaults')}
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4">
            {entries.map((e, i) => (
              <div key={i} className="glass-card min-w-[320px] flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold uppercase">
                    {t('Sezóna', 'Season')} {i + 1}
                  </h3>
                  <button
                    onClick={() => removeEntry(i)}
                    className="glass-ghost text-xs"
                  >
                    ×
                  </button>
                </div>
                <div className="glass-text text-xs mb-2">
                  {e.startDate} → {e.endDate}
                </div>
                <div className="glass-field mb-3">
                  <input
                    className="glass-input"
                    type="date"
                    value={e.startDate}
                    onChange={ev =>
                      updateEntry(i, { startDate: ev.target.value })
                    }
                  />
                  <input
                    className="glass-input"
                    type="date"
                    value={e.endDate}
                    onChange={ev =>
                      updateEntry(i, { endDate: ev.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DAY_KEYS.map(k => (
                    <label key={k} className="glass-label text-xs">
                      {DAY_LABELS[k][lang]}
                      <input
                        className="glass-input"
                        value={e.days[k]}
                        onChange={ev => updateDay(i, k, ev.target.value)}
                        placeholder={t('9:00 - 17:00', '9:00 - 17:00')}
                      />
                    </label>
                  ))}
                </div>
                <button
                  className="glass-submit-full mt-3"
                  onClick={() => addSeasonAt(i + 1)}
                >
                  + {t('Přidat sezónu', 'Add season')}
                </button>
              </div>
            ))}
            <button
              className="glass-submit mt-0"
              style={{ width: '56px', height: '56px', alignSelf: 'center' }}
              onClick={() => addSeasonAt(null)}
            >
              +
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="glass-card">
              <h3 className="mb-3 text-sm uppercase tracking-wide">
                {t('Výjimky', 'Exceptions')}
              </h3>
              {exceptions.map((ex, idx) => (
                <div key={idx} className="glass-card mb-3 p-4">
                  <div className="grid grid-cols-1 gap-3">
                    <label
                      className="glass-label text-xs"
                      htmlFor={`ex-date-${idx}`}
                    >
                      {t('Datum výjimky', 'Exception date')}
                      {ex.date ? ` ${ex.date}` : ''}
                      <input
                        id={`ex-date-${idx}`}
                        className="glass-input"
                        type="date"
                        value={ex.date}
                        onChange={ev => {
                          const newDate = ev.target.value;
                          if (
                            newDate &&
                            exceptions.some(
                              (e, i) => i !== idx && e.date === newDate
                            )
                          ) {
                            alert(
                              t(
                                'Výjimka pro toto datum již existuje.',
                                'Exception for this date already exists.'
                              )
                            );
                            return;
                          }
                          setExceptions(prev =>
                            prev.map((e, i) =>
                              i === idx ? { ...e, date: newDate } : e
                            )
                          );
                        }}
                      />
                    </label>
                    <label
                      className="glass-label text-xs"
                      htmlFor={`ex-hours-${idx}`}
                    >
                      {ex.date
                        ? t('Hodiny pro', 'Hours for') + ` ${ex.date}`
                        : t('Hodiny pro výjimku', 'Hours for exception')}
                      <input
                        id={`ex-hours-${idx}`}
                        className="glass-input"
                        placeholder={t('Hodiny', 'Hours')}
                        value={ex.hours}
                        onChange={ev =>
                          setExceptions(prev =>
                            prev.map((e, i) =>
                              i === idx ? { ...e, hours: ev.target.value } : e
                            )
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      className="glass-ghost"
                      onClick={() =>
                        setExceptions(prev => prev.filter((_, i) => i !== idx))
                      }
                    >
                      × {t('Odebrat', 'Remove')}
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="glass-submit-full"
                onClick={() => {
                  if (exceptions.some(e => e.date === '')) return;
                  setExceptions(prev => [...prev, { date: '', hours: '' }]);
                }}
              >
                + {t('Přidat výjimku', 'Add exception')}
              </button>
            </div>

            <div className="glass-card">
              <h3 className="mb-3 text-sm uppercase tracking-wide">
                {t('Náhled', 'Preview')}
              </h3>
              {previewRows.map(r => (
                <div
                  key={r.label}
                  className="flex justify-between py-1 border-b border-white/10"
                >
                  <span>{r.label}</span>
                  <span className={r.closed ? 'text-red-300' : ''}>
                    {r.text}
                  </span>
                </div>
              ))}
              <button
                className="glass-submit-full mt-4"
                onClick={save}
                disabled={saving}
              >
                {saving ? t('Ukládám…', 'Saving…') : t('Uložit', 'Save')}
              </button>
              {error && <p className="glass-error mt-2">{error}</p>}
              {success && <p className="glass-text mt-2">{success}</p>}
            </div>
          </div>
        </div>
      </div>
      {defaultsModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={() => setDefaultsModalOpen(false)}
        >
          <div
            className="glass-card min-w-[360px] max-w-[90vw] max-h-[80vh] overflow-y-auto p-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="mb-3">
              {t('Výchozí otevírací doba', 'Default opening hours')}
            </h3>
            {(['summer', 'spring'] as const).map(key => {
              const sectionLabel =
                key === 'summer'
                  ? t('Léto', 'Summer')
                  : t('Mimo léto', 'Outside summer');
              return (
                <div key={key} className="mb-3">
                  <p className="glass-label mb-1 text-xs">{sectionLabel}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DAY_KEYS.map(k => (
                      <label key={k} className="glass-label text-xs">
                        {DAY_LABELS[k][lang]}
                        <input
                          className="glass-input"
                          aria-label={`${sectionLabel} ${DAY_LABELS[k][lang]}`}
                          value={defaults[key]?.[k] || ''}
                          onChange={e =>
                            setDefaults(d => ({
                              ...d,
                              [key]: { ...d[key], [k]: e.target.value },
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="glass-ghost"
                onClick={() => setDefaultsModalOpen(false)}
              >
                {t('Zrušit', 'Cancel')}
              </button>
              <button
                className="glass-submit-full"
                onClick={() => {
                  setDefaultsModalOpen(false);
                  void save();
                }}
              >
                {t('Uložit', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
