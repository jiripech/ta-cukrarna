'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const STORAGE_KEY = 'ta-cukrarna-opening-hours-draft';
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const csrfToken = csrf?.enabled ? csrf.csrfToken : undefined;
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seasonContainerRef = useRef<HTMLDivElement>(null);

  // Validation helpers
  const validateEntry = useCallback(
    (entry: ScheduleEntry, index: number): Record<string, string> => {
      const errors: Record<string, string> = {};
      const prefix = `entry-${index}`;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.startDate)) {
        errors[`${prefix}-startDate`] = t('Neplatné datum.', 'Invalid date.');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.endDate)) {
        errors[`${prefix}-endDate`] = t('Neplatné datum.', 'Invalid date.');
      }
      if (entry.startDate && entry.endDate && entry.startDate > entry.endDate) {
        errors[`${prefix}-endDate`] = t(
          'Počátek po konci.',
          'Start after end.'
        );
      }
      for (const k of DAY_KEYS) {
        if (entry.days[k].length > 100) {
          errors[`${prefix}-days-${k}`] = t(
            'Příliš dlouhý text.',
            'Text too long.'
          );
        }
      }
      return errors;
    },
    [t]
  );

  const validateExceptions = useCallback(
    (excs: HoursException[]): Record<string, string> => {
      const errors: Record<string, string> = {};
      for (let i = 0; i < excs.length; i++) {
        const ex = excs[i];
        const prefix = `exception-${i}`;
        if (ex.date && !/^\d{4}-\d{2}-\d{2}$/.test(ex.date)) {
          errors[`${prefix}-date`] = t('Neplatné datum.', 'Invalid date.');
        }
        if (ex.date) {
          for (let j = 0; j < excs.length; j++) {
            if (i !== j && excs[j].date === ex.date) {
              errors[`${prefix}-date`] = t(
                'Výjimka pro toto datum již existuje.',
                'Exception for this date already exists.'
              );
              break;
            }
          }
        }
      }
      return errors;
    },
    [t]
  );

  const validateAll = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (entries.length === 0) {
      errors['general'] = t(
        'Přidejte prosím alespoň jedno období.',
        'Please add at least one period.'
      );
    }
    for (let i = 0; i < entries.length; i++) {
      Object.assign(errors, validateEntry(entries[i], i));
    }
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i],
          b = entries[j];
        if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
          errors[`entry-${i}-overlap`] = t(
            'Období se překrývají.',
            'Periods overlap.'
          );
          errors[`entry-${j}-overlap`] = t(
            'Období se překrývají.',
            'Periods overlap.'
          );
        }
      }
    }
    Object.assign(errors, validateExceptions(exceptions));
    return errors;
  }, [entries, exceptions, validateEntry, validateExceptions, t]);

  // Autosave draft to localStorage
  const saveDraft = useCallback(() => {
    try {
      const draft = { entries, exceptions, defaults, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore quota exceeded or other storage errors
    }
  }, [entries, exceptions, defaults]);

  const loadDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const draft = JSON.parse(stored);
        // Only restore if draft is less than 24 hours old
        if (Date.now() - (draft.timestamp || 0) < 24 * 60 * 60 * 1000) {
          return draft;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Setup autosave timer
  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearInterval(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setInterval(saveDraft, AUTOSAVE_INTERVAL);
    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current);
      }
    };
  }, [saveDraft]);

  // Load data on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Check for draft first
        const draft = loadDraft();
        if (draft && !cancelled) {
          setShowDraftRestore(true);
        }

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
  }, [t, loadDraft]);

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

  const handleDayChange = (
    i: number,
    day: keyof ScheduleEntry['days'],
    v: string
  ) => {
    updateDay(i, day, v);
    // Clear field error on change
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[`entry-${i}-days-${day}`];
      return next;
    });
  };

  const handleDateChange = (
    i: number,
    field: 'startDate' | 'endDate',
    v: string
  ) => {
    updateEntry(i, { [field]: v });
    // Clear field error on change
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[`entry-${i}-${field}`];
      delete next[`entry-${i}-overlap`];
      return next;
    });
  };

  const handleExceptionDateChange = (idx: number, newDate: string) => {
    if (newDate && exceptions.some((e, i) => i !== idx && e.date === newDate)) {
      // Error will be caught by validation
      setFieldErrors(prev => ({
        ...prev,
        [`exception-${idx}-date`]: t(
          'Výjimka pro toto datum již existuje.',
          'Exception for this date already exists.'
        ),
      }));
      return;
    }
    setExceptions(prev =>
      prev.map((e, i) => (i === idx ? { ...e, date: newDate } : e))
    );
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[`exception-${idx}-date`];
      return next;
    });
  };

  const handleExceptionHoursChange = (idx: number, hours: string) => {
    setExceptions(prev =>
      prev.map((e, i) => (i === idx ? { ...e, hours } : e))
    );
  };

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
    setEntries((prev: ScheduleEntry[]) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev
    );

  // Copy/paste week schedule
  const handlePaste = (e: React.ClipboardEvent, entryIndex: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const values = text
      .split(/[\s,\t\n]+/)
      .map(v => v.trim())
      .filter(Boolean);
    if (values.length === 7) {
      const dayMap: ScheduleEntry['days'] = {
        mon: values[0] || '',
        tue: values[1] || '',
        wed: values[2] || '',
        thu: values[3] || '',
        fri: values[4] || '',
        sat: values[5] || '',
        sun: values[6] || '',
      };
      setEntries(prev =>
        prev.map((entry, i) =>
          i === entryIndex ? { ...entry, days: dayMap } : entry
        )
      );
    }
  };

  // Keyboard navigation: Enter moves to next day
  const handleKeyDown = (
    e: React.KeyboardEvent,
    entryIndex: number,
    dayIndex: number
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const nextDayIndex = dayIndex + 1;
      if (nextDayIndex < DAY_KEYS.length) {
        // Focus next day input in same entry
        const nextInput = document.getElementById(
          `day-${entryIndex}-${DAY_KEYS[nextDayIndex]}`
        ) as HTMLInputElement;
        nextInput?.focus();
      } else if (entryIndex + 1 < entries.length) {
        // Focus first day of next entry
        const nextInput = document.getElementById(
          `day-${entryIndex + 1}-${DAY_KEYS[0]}`
        ) as HTMLInputElement;
        nextInput?.focus();
      }
    }
  };

  const save = useCallback(async () => {
    const normalized = ensureContiguous(entries);
    const validationErrors = validateAll();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError(
        t(
          'Opravte prosím chyby ve formuláři.',
          'Please fix errors in the form.'
        )
      );
      setSuccess(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
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
      clearDraft();
      setShowDraftRestore(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg || t('Uložení selhalo.', 'Save failed.'));
    } finally {
      setSaving(false);
    }
  }, [
    entries,
    exceptions,
    defaults,
    validateAll,
    csrfToken,
    lang,
    t,
    clearDraft,
  ]);

  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (draft) {
      setEntries(draft.entries || [emptyEntry()]);
      setExceptions(draft.exceptions || []);
      setDefaults(
        draft.defaults || { summer: emptyDayMap(), spring: emptyDayMap() }
      );
      setShowDraftRestore(false);
    }
  }, [loadDraft]);

  const dismissDraft = useCallback(() => {
    setShowDraftRestore(false);
    clearDraft();
  }, [clearDraft]);

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
      const isToday = targetDate === today;
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
        isToday,
        source: exc ? 'exception' : season ? 'season' : 'none',
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, exceptions, lang, t, today]);

  if (loading) {
    return (
      <div className="glass-card text-center" role="status" aria-live="polite">
        <p className="glass-text">{t('Načítám…', 'Loading…')}</p>
      </div>
    );
  }

  return (
    <>
      {/* Draft restore banner */}
      {showDraftRestore && (
        <div
          className="glass-card mb-4 p-4 flex items-center justify-between"
          role="alert"
        >
          <span className="glass-text">
            {t('Nalezen neuložený koncept.', 'Unsaved draft found.')}
          </span>
          <div className="flex gap-2 ml-4 shrink-0">
            <button
              type="button"
              onClick={restoreDraft}
              className="glass-submit-full"
            >
              {t('Obnovit', 'Restore')}
            </button>
            <button
              type="button"
              onClick={dismissDraft}
              className="glass-ghost"
            >
              {t('Zahodit', 'Discard')}
            </button>
          </div>
        </div>
      )}

      <div className="glass-page min-h-[70vh] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-white font-semibold text-lg">
              {t('Správa sezón', 'Season management')}
            </h2>
            <button
              className="glass-submit-full w-auto px-4 py-2 shrink-0"
              onClick={() => setDefaultsModalOpen(true)}
            >
              {t('Upravit výchozí', 'Edit defaults')}
            </button>
          </div>

          {/* Seasons - with drag handle for reordering */}
          <div
            ref={seasonContainerRef}
            className="flex gap-4 overflow-x-auto pb-4"
            role="list"
            aria-label={t('Sezóny', 'Seasons')}
          >
            {entries.map((e, i) => (
              <div
                key={i}
                className="glass-card min-w-[320px] flex-shrink-0"
                role="listitem"
                aria-label={`${t('Sezóna', 'Season')} ${i + 1}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold uppercase">
                    {t('Sezóna', 'Season')} {i + 1}
                  </h3>
                  <div className="flex items-center gap-1">
                    {/* Drag handle - placeholder for future @dnd-kit integration */}
                    <button
                      type="button"
                      className="glass-ghost text-xs p-1 opacity-50 hover:opacity-100"
                      aria-label={t('Přesunout sezónu', 'Move season')}
                      title={t(
                        'Přetáhnout pro změnu pořadí',
                        'Drag to reorder'
                      )}
                    >
                      ⋮⋮
                    </button>
                    <button
                      onClick={() => removeEntry(i)}
                      className="glass-ghost text-xs"
                      aria-label={t('Odstranit sezónu', 'Remove season')}
                    >
                      ×
                    </button>
                  </div>
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
                      handleDateChange(i, 'startDate', ev.target.value)
                    }
                    aria-label={t('Počátek sezóny', 'Season start')}
                    aria-invalid={!!fieldErrors[`entry-${i}-startDate`]}
                    aria-describedby={
                      fieldErrors[`entry-${i}-startDate`]
                        ? `error-entry-${i}-startDate`
                        : undefined
                    }
                  />
                  {fieldErrors[`entry-${i}-startDate`] && (
                    <p
                      id={`error-entry-${i}-startDate`}
                      className="glass-error text-xs mt-1"
                      role="alert"
                    >
                      {fieldErrors[`entry-${i}-startDate`]}
                    </p>
                  )}
                  <input
                    className="glass-input"
                    type="date"
                    value={e.endDate}
                    onChange={ev =>
                      handleDateChange(i, 'endDate', ev.target.value)
                    }
                    aria-label={t('Konec sezóny', 'Season end')}
                    aria-invalid={!!fieldErrors[`entry-${i}-endDate`]}
                    aria-describedby={
                      fieldErrors[`entry-${i}-endDate`]
                        ? `error-entry-${i}-endDate`
                        : undefined
                    }
                  />
                  {fieldErrors[`entry-${i}-endDate`] && (
                    <p
                      id={`error-entry-${i}-endDate`}
                      className="glass-error text-xs mt-1"
                      role="alert"
                    >
                      {fieldErrors[`entry-${i}-endDate`]}
                    </p>
                  )}
                  {fieldErrors[`entry-${i}-overlap`] && (
                    <p className="glass-error text-xs mt-1" role="alert">
                      {fieldErrors[`entry-${i}-overlap`]}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DAY_KEYS.map((k, dayIdx) => (
                    <label
                      key={k}
                      className="glass-label text-xs"
                      htmlFor={`day-${i}-${k}`}
                    >
                      {DAY_LABELS[k][lang]}
                      <input
                        id={`day-${i}-${k}`}
                        className="glass-input"
                        value={e.days[k]}
                        onChange={ev => handleDayChange(i, k, ev.target.value)}
                        onKeyDown={ev => handleKeyDown(ev, i, dayIdx)}
                        onPaste={ev => handlePaste(ev, i)}
                        placeholder={t('9:00 - 17:00', '9:00 - 17:00')}
                        aria-label={`${DAY_LABELS[k][lang]} ${t('otevírací doba', 'opening hours')}`}
                        aria-invalid={!!fieldErrors[`entry-${i}-days-${k}`]}
                        aria-describedby={
                          fieldErrors[`entry-${i}-days-${k}`]
                            ? `error-entry-${i}-days-${k}`
                            : undefined
                        }
                      />
                      {fieldErrors[`entry-${i}-days-${k}`] && (
                        <p
                          id={`error-entry-${i}-days-${k}`}
                          className="glass-error text-xs mt-1"
                          role="alert"
                        >
                          {fieldErrors[`entry-${i}-days-${k}`]}
                        </p>
                      )}
                    </label>
                  ))}
                </div>
                <button
                  className="glass-submit-full mt-3"
                  onClick={() => addSeasonAt(i + 1)}
                  aria-label={t(
                    'Přidat sezónu po této',
                    'Add season after this'
                  )}
                >
                  + {t('Přidat sezónu', 'Add season')}
                </button>
              </div>
            ))}
            <button
              className="glass-submit mt-0"
              style={{ width: '56px', height: '56px', alignSelf: 'center' }}
              onClick={() => addSeasonAt(null)}
              aria-label={t('Přidat sezónu na konec', 'Add season at end')}
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
                        onChange={ev =>
                          handleExceptionDateChange(idx, ev.target.value)
                        }
                        aria-label={t('Datum výjimky', 'Exception date')}
                        aria-invalid={!!fieldErrors[`exception-${idx}-date`]}
                        aria-describedby={
                          fieldErrors[`exception-${idx}-date`]
                            ? `error-exception-${idx}-date`
                            : undefined
                        }
                      />
                      {fieldErrors[`exception-${idx}-date`] && (
                        <p
                          id={`error-exception-${idx}-date`}
                          className="glass-error text-xs mt-1"
                          role="alert"
                        >
                          {fieldErrors[`exception-${idx}-date`]}
                        </p>
                      )}
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
                          handleExceptionHoursChange(idx, ev.target.value)
                        }
                        aria-label={t('Hodiny výjimky', 'Exception hours')}
                      />
                    </label>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      className="glass-ghost"
                      onClick={() =>
                        setExceptions(prev => prev.filter((_, i) => i !== idx))
                      }
                      aria-label={t('Odstranit výjimku', 'Remove exception')}
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
                aria-label={t('Přidat výjimku', 'Add exception')}
              >
                + {t('Přidat výjimku', 'Add exception')}
              </button>
            </div>

            <div className="glass-card">
              <h3 className="mb-3 text-sm uppercase tracking-wide">
                {t('Náhled', 'Preview')}
              </h3>
              <div
                role="table"
                aria-label={t('Týdenní náhled', 'Weekly preview')}
              >
                {previewRows.map(r => (
                  <div
                    key={r.label}
                    className={`flex justify-between py-1 border-b border-white/10 ${
                      r.isToday ? 'bg-amber-500/10 font-medium' : ''
                    }`}
                    role="row"
                  >
                    <span role="columnheader">
                      {r.label}
                      {r.isToday && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500 text-black rounded">
                          {t('Dnes', 'Today')}
                        </span>
                      )}
                    </span>
                    <span
                      className={r.closed ? 'text-red-300' : ''}
                      role="gridcell"
                    >
                      {r.text}
                      {r.source === 'exception' && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-zinc-700 text-zinc-200 rounded">
                          {t('výjimka', 'exception')}
                        </span>
                      )}
                      {r.source === 'season' && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-zinc-700 text-zinc-200 rounded">
                          {t('sezóna', 'season')}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  className="glass-submit-full"
                  onClick={save}
                  disabled={saving}
                  aria-busy={saving}
                >
                  {saving ? t('Ukládám…', 'Saving…') : t('Uložit', 'Save')}
                </button>
              </div>
              {error && (
                <p className="glass-error mt-2" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <p className="glass-text mt-2" role="status">
                  {success}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      {defaultsModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={() => setDefaultsModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="defaults-modal-title"
        >
          <div
            className="glass-card min-w-[360px] max-w-[90vw] max-h-[80vh] overflow-y-auto p-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 id="defaults-modal-title" className="mb-3">
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
                      <label
                        key={k}
                        className="glass-label text-xs"
                        htmlFor={`default-${key}-${k}`}
                      >
                        {DAY_LABELS[k][lang]}
                        <input
                          id={`default-${key}-${k}`}
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
