import { test, expect } from '@playwright/test';
import { parseJsonc } from '@/lib/jsonc';

/**
 * Unit tests for the JSONC reader (src/lib/jsonc.ts) used for the
 * hand-edited /opening-hours.jsonc file: // and block comments plus
 * trailing commas must be tolerated, while string literals stay intact.
 * Runs in the Node test worker (pure function, no browser needed).
 */

test('parses trailing commas in objects and arrays', () => {
  expect(
    parseJsonc<{ a: number[]; b: string }>('{"a": [1, 2, 3,], "b": "x",}')
  ).toEqual({ a: [1, 2, 3], b: 'x' });
});

test('strips line and block comments', () => {
  expect(
    parseJsonc<{ hours: string }>(
      [
        '// opening hours',
        '{',
        '  /* friday special */',
        '  "hours": "9:00 - 15:00", // trailing comment',
        '}',
      ].join('\n')
    )
  ).toEqual({ hours: '9:00 - 15:00' });
});

test('keeps comment-like sequences inside strings', () => {
  expect(
    parseJsonc<{ url: string }>('{"url": "https://tacukrarna.cz/a//b"}')
  ).toEqual({ url: 'https://tacukrarna.cz/a//b' });
});

test('keeps commas and braces inside strings', () => {
  expect(parseJsonc<{ text: string }>('{"text": "a, } and ] stay"}')).toEqual({
    text: 'a, } and ] stay',
  });
});

test('parses a realistic opening-hours.jsonc document', () => {
  const doc = `{
    // Weekly schedule; first matching range wins.
    "schedule": [
      {
        "startDate": "2026-09-03",
        "endDate": "2026-09-06",
        "days": { "mon": "", "tue": "", "wed": "", "thu": "9:00 - 19:00", "fri": "9:00 - 15:00", },
      },
    ],
    "exceptions": [{ "date": "2026-09-11", "hours": "" }],
  }`;
  expect(parseJsonc(doc)).toEqual({
    schedule: [
      {
        startDate: '2026-09-03',
        endDate: '2026-09-06',
        days: {
          mon: '',
          tue: '',
          wed: '',
          thu: '9:00 - 19:00',
          fri: '9:00 - 15:00',
        },
      },
    ],
    exceptions: [{ date: '2026-09-11', hours: '' }],
  });
});

test('returns null for invalid JSON after stripping', () => {
  expect(parseJsonc('{"a": }')).toBeNull();
  expect(parseJsonc('not json at all')).toBeNull();
  expect(parseJsonc('{"unclosed": "string}')).toBeNull();
});

test('strips a leading UTF-8 BOM', () => {
  expect(parseJsonc('\uFEFF{"a": 1}')).toEqual({ a: 1 });
});
