# Changelog

## v1.2.18

### Fixed

- **E2E test: opening hours Friday row**: Fixed test date from September
  (extended summer period) to January (outside extended summer) and changed
  assertion from `toHaveText` to `toContainText` to properly verify the "Pátek"
  day name is present when the Friday schedule is empty (`fri: ''`).

## Updated

- **Nextjs** updated to 16.3.3 to elimininate two critical issues identified by
  [dependabot][dependabotGuide].

## v1.2.17

### Added

- **Security updates**
- **Per-date opening-hours exceptions**: Admins can add single-date overrides
  (e.g. open 9:00 - 15:00 on a normally closed Friday) alongside the weekly
  schedule; exact-date exceptions win over schedule ranges, empty hours mean
  closed.
- **Two-file opening hours structure**: `public/holiday.jsonc` contains
  system-defined Czech public holidays with lower precedence than user
  exceptions, while `public/opening-hours.jsonc` holds the weekly schedule and
  admin-added exceptions with highest precedence. User exceptions override
  system holidays and the weekly schedule.
- **JSONC opening-hours file**: The runtime file is now `opening-hours.jsonc` —
  hand edits may use comments and trailing commas (`parseJsonc` in
  `src/lib/jsonc.ts`, `jsoncDecode()` in PHP). Admin saves normalize the file
  back to strict JSON.
- **Register flow audit log**: `register.php` logs every step (rate limiting,
  mail-DB check, token insert, mail send result, IMAP verification) as JSONL
  into `api/DB/api-debug.log` (web-protected, 1 MiB rotation) to make silent
  failures diagnosable.
- **Opening hours admin panel**: Biometric-secured (WebAuthn/passkey) admin
  interface for managing opening hours. Owner authenticates via Touch ID/Face ID
  and can create custom schedule entries with date ranges and per-day hours.
- **Opening hours JSON API**: New `/api/opening-hours.php` endpoint serves
  custom schedules to the public site with stale-while-revalidate caching.
- **Passkey registration flow**: One-time registration via email token + IMAP
  password verification. Registered devices can authenticate without passwords.
- **SQLite credential store**: Passkey public keys and registration tokens
  stored in an Apache-denied SQLite database.

### Changed

- **Register request-token**: e-mail is sent with a `-f info@tacukrarna.cz`
  envelope sender (SPF/DMARC alignment, parity with the chatbot mail path); the
  register UI surfaces generic 429/5xx failures (no account-existence leak).
- **Deploy**: `.rsyncignore` now protects runtime state (`api/DB/*.sqlite`,
  `opening-hours.jsonc`) from `rsync --delete` — previously every deploy wiped
  the passkeys database.
- **Service worker v11**: stale-while-revalidate path moved to
  `opening-hours.jsonc`.
- **Service worker v10**: Added stale-while-revalidate for `opening-hours.json`,
  excluded `/api/*` and `/admin/*` from caching.
- **Deploy workflow**: Added DB directory creation step for SQLite database.

[dependabotGuide]:
  https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/dependabot-quickstart
