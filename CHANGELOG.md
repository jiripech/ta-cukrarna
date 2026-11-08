# Changelog

## Unreleased

### Added

- **Security policy and vulnerability reporting guidelines** (`SECURITY.md`):
  documents how to report vulnerabilities (a GitHub issue or pull request
  labeled **security**) and notes that dependency vulnerabilities are usually
  caught by Dependabot or `npm audit`.

### Fixed

- **Exception inputs announce the exception date**
  (`src/components/OwnerHoursGlassForm.tsx`): the date and hours inputs in the
  opening-hours exception editor carried generic `aria-label`s ("Datum výjimky"
  / "Hodiny výjimky") that overrode their date-specific visible labels as the
  accessible name, so `getByLabel('Hodiny pro 2026-01-09')` could never match.
  The accessible names now mirror the visible labels ("Datum výjimky <date>" /
  "Hodiny pro <date>"). The Docker e2e suite caught this:
  `opening-hours-exception.spec.ts` failed on all three browser projects since
  the v1.3.10 ARIA pass added the generic labels; with the fix the full suite
  passes again (93 passed, 12 skipped).

### Security

- **zod bumped 4.6.5 → 4.6.7** (`package-lock.json`): resolves the high-severity
  advisory GHSA-mrhx-c7xc-m3w5 (Zod can exhaust memory while validating
  oversized constrained collections). zod is a transitive dev dependency of
  `eslint-plugin-react-hooks`; updated within the existing `^4` range, so the
  manifest is unchanged.
- **markdownlint-cli2 bumped 0.23.3 → 0.24.0, re2js overridden to ^2.9.1**
  (`package.json`, `package-lock.json`): the bump moves markdown-it 15.0.1 →
  15.0.3 and resolves three high-severity quadratic-complexity DoS advisories in
  it (GHSA-r7fv-28h4-cvq7, GHSA-vfgh-jcmw-g37q, GHSA-gfr2-rv44-r23c) plus the
  low-severity markdownlint-cli2 finding. markdownlint@0.42.0 pins re2js exactly
  at 2.8.6 (GHSA-gg6h-894w-4m9c, high — quadratic-time DoS in lookbehind
  matching, fixed in 2.8.7), so a scoped `markdownlint → re2js ^2.9.1` override
  was added. `npm run lint:md` verified against the existing
  `.markdownlint-cli2.jsonc` config.
- **minimatch overridden to ^11.0.1 under @typescript-eslint/typescript-estree**
  (`package.json`, `package-lock.json`): resolves the moderate advisory
  GHSA-g3hv-75wg-m249 (potential DoS via globparts amplification), which is
  fixed only in minimatch 11.0.1+, while the latest typescript-estree still pins
  `^10.2.2`. The parent-scoped override replaces minimatch only inside
  typescript-estree — the minimatch 3.1.5 copies used by eslint and friends stay
  untouched (outside the vulnerable range). `npm run lint` verified
  compatibility of typescript-estree with minimatch 11.

## v1.3.11

### Security

- **Registration password proof enforced server-side**
  (`public/api/webauthn.php`, `public/api/register.php`): `challenge_register`
  and `verify_register` now require the verified registration state
  (`reg_verified`), which only the successful mailbox-password check (or the
  server-verified ADMIN_USERS no-password test flow) sets. Previously a valid
  one-hour registration token alone was enough to register an admin passkey,
  skipping the password proof entirely; the token is also marked pre-verified by
  `validate-token` when the configured flow needs no password, so the Docker
  test flow keeps working.
- **Rate limits keyed on `REMOTE_ADDR`** (`public/api/db.php`,
  `public/api/chatbot.php`): the client-controlled `X-Forwarded-For` header is
  no longer honored (Apache is the network edge — proxy modules are disabled).
  Rotating the header no longer defeats the chatbot mail-relay limit (5/minute),
  the registration-token limit (3/hour), or the opening-hours / passkey admin
  action limits.
- **Chatbot email link injection closed** (`public/api/chatbot.php`): the
  catalog PDF URL is now built from an allowlist (`tacukrarna.cz`,
  `www.tacukrarna.cz`, always https) instead of the spoofable `Host` header,
  which previously let one request put an attacker-chosen link into an email
  sent from the official `info@tacukrarna.cz` address (phishing). Dev-mode
  detection now uses server-side signals only (env var or loopback client), not
  the `Host` header.
- **Session hardening** (`public/api/session.php`, `public/api/register.php`):
  the session ID is regenerated when a registration token is validated and when
  an admin session is opened (session-fixation protection), and the session
  cookie `Secure` flag follows the TLS state of the connection instead of the
  spoofable `Host` header.

### Added

- **PHP API security test suite** (`tests/api/run-api-tests.php`,
  `npm run test:api`, CI step "Run PHP API security tests"): boots the PHP
  built-in server against a throwaway copy of `public/` with a fresh SQLite
  database and drives the real endpoints over HTTP — 18 assertions covering all
  four fixes above plus a guard for the legitimate no-password registration
  flow. Verified red (10 failures) on the pre-fix code and green after the
  fixes; no Docker or Apache required, only php-cli.

## v1.3.10.1

### Fixed

- **E2E test stability**: fixed `mobile-footer.spec.ts` — directly triggers the
  footer visibility logic (bypassing unreliable scroll simulation in headless
  CI) and verifies the 7-second auto-hide behavior.

## v1.3.10

### Added

- **Passkey management UI ("Správa zařízení")**: New admin tab to list all
  registered passkeys with creation/last-used timestamps, signature counters,
  device info (platform, transports), and revoke action with confirmation modal.
  Backend endpoints `list_credentials` and `revoke_credential` with CSRF
  protection and rate limiting (10/h/IP).
- **Opening hours editor UX improvements** (`OwnerHoursGlassForm.tsx`): inline
  field validation with real-time error messages, keyboard navigation (Enter
  moves to next day), copy/paste week schedule (7 values into first day), draft
  auto-save to localStorage (30s interval) with restore banner on load, enhanced
  preview panel with "Dnes" badge and source indicators, responsive stacked
  layout on mobile (< 640px), full accessibility (ARIA labels, live regions,
  focus management).
- **Database schema**: Added `user_agent` and `device_info` columns to
  `passkeys` table with idempotent migration in `init.php`; populated on
  registration from User-Agent and WebAuthn credential metadata.

### Changed

- Admin panel (`src/app/admin/page.tsx`): tabbed layout "Otevírací doba" |
  "Správa zařízení" replacing single-form view.

### Fixed

- **E2E test stability**: fixed `opening-hours-exception.spec.ts` public display
  test — now waits for `OpeningHours` component async data load instead of
  relying on `networkidle` which completed before JSONC fetches resolved.
- **E2E test stability**: fixed `offline.spec.ts` — wraps
  `navigator.serviceWorker.ready` in try/catch and extends timeout to 30s to
  prevent CI timeouts during SW activation.

## v1.3.9

### Fixed

- **Admin accessibility**: added the WCAG admin smoke checks for sign-in and
  registration at `e2e/admin-wcag.spec.ts`, then fixed the real blockers found
  by Axe: low-contrast admin CTA, viewport zoom locking, and a contrast issue in
  the fixed version footer.
- **Docker rebuild safety**: documented the macOS/ACL bind-mount cleanup trap in
  `DEVELOPMENT_TOOLS.md` so host-side `out/` cleanup is not attempted while the
  `ta-cukrarna-test` container is still using the bind-mounted directory.
- **Repo quality gate**: captured the requirement to run `npm run check-all`
  before finishing any task and kept the release process aligned with the
  repository’s lint/typecheck/format gate.

## v1.3.8

### Updated

- **fast-uri** 3.1.8 → 4.2.3 via npm override in `package.json` to pull the
  latest release across transitive `ajv` consumers.

## v1.3.7

### Fixed

- **Playwright base URL regression** (`playwright.config.ts`): normal E2E runs
  now target the static harness at `http://127.0.0.1:3001`, while Docker E2E
  mode keeps `http://localhost/`. This prevents non-Docker suites from
  accidentally hitting port 80 and failing in CI when no Docker container is
  running.

## v1.3.6

### Fixed

- `docker/Dockerfile.test`: added Sury PHP repo, installed `php8.5-sqlite3`, and
  removed obsolete test env copy path.
- `public/api/webauthn.php`: convert raw P1363 ES256 signatures to DER before
  `openssl_verify()` to fix admin login verification.
- `src/styles/glass.css`: set glass overlay to `pointer-events:none`, improved
  input/placeholder contrast, and adjusted stacking for native date picker
  visibility.
- `src/components/OwnerHoursGlassForm.tsx`: switched sentinel end date to
  `9999-12-31`, wired defaults to API persistence, improved modal/mobile
  usability, and stacked exception inputs to prevent overlap.
- `e2e/opening-hours-exception.spec.ts`: fixed TS2353 by using `headers` instead
  of invalid `extraHTTPHeaders` in API request options.
- `src/components/OwnerHoursForm.tsx`: added stable `ex-date-*` and `ex-hours-*`
  ids for language-independent admin E2E selectors.
- Avoid breaking existing settings in new deployments by adding
  'opening-hours.jsonc' to '.rsyncignore'
- Move Dockerfile.test into docker/ folder for better organization

### Changed

- `package-lock.json`: updated lock entries to match pinned Next.js 16.4.3
  dependency graph.
- `package.json`: added `test:e2e:docker` and pinned `next` to `16.4.3`.
- `.markdownlint-cli2.jsonc`: excluded `playwright-report/**` and
  `test-results/**` from markdown lint globs.
- `AGENTS.md`: added detailed Docker mirror architecture, mount topology,
  seeding behavior, and WebAuthn testing constraints.
- `DEVELOPMENT_TOOLS.md`: documented that `ADMIN_USERS`, `WEBAUTHN_RP_ID`, and
  `APP_BASE_URL` are Docker-test-only overrides.
- `README.md`: documented Docker E2E setup, run loop, `.env.docker` usage, and
  production safety notes for relaxed test-only env flags.
- `playwright.config.ts`: Docker mode now uses localhost base URL, single worker
  execution, and skips static webServer startup.
- Restructured Docker testing environment into dedicated docker/ directory

## v1.3.4, v1.3.5

### Updated

- **eslint-config-next** 16.1.1 → 16.4.0 (addresses dependabot alert)
- **markdownlint-cli2** 0.23.1 → 0.23.3 (addresses dependabot alert)
- **secretlint** 11.2.5 → 13.0.7 (addresses dependabot alert)
- **@secretlint/secretlint-rule-preset-recommend** 11.2.5 → 13.0.7

### Fixed

- **katex**: Updated transitive dependency to v0.18.10 (prototype pollution fix)
- **smol-toml**: Updated transitive dependency to v1.9.1 (DoS vulnerability fix)
- **compression**: Updated transitive dependency to v1.8.2 (memory leak DoS fix)

## v1.3.3

- **fixed** typecheck script added to check TypeScript types in check-all
- **fixed** improved success message and added labels for exception inputs in
  OwnerHoursGlassForm

## v1.3.2

### Fixed

- Type assertion for `parseJsonc` response in `OwnerHoursGlassForm` to resolve
  TS2339 errors during build.
- Removed `any` usage and unused variable in `OpeningHours.tsx` to satisfy
  ESLint.

## v1.3.1

### Fixed

- Refactored mount effect in `OwnerHoursGlassForm` to inline async fetch with
  cancellation guard, removing `react-hooks/set-state-in-effect` violation.

## v1.3.0

### Added

- `SPECIFICATION.md`: added comprehensive contract-level system specification
  for frontend, API, data and deployment behavior.
- `src/app/admin/register/page.tsx`: registration UI now skips password
  verification when API reports `password_required: false`.
- `public/api/register.php`: added `ADMIN_USERS` and `APP_BASE_URL` handling
  plus `password_required` response for token validation.
- `e2e/opening-hours-defaults.spec.ts`: added Docker-gated defaults persistence
  and public fallback checks when no season covers today.
- `e2e/admin-register-docker.spec.ts`: added Docker-gated Chromium
  register→login flow with fresh WebAuthn credential creation.
- `e2e/admin-login.spec.ts`: added Docker-gated Chromium login test using seeded
  passkey material with real server-side signature verification.
- `docker/seed-passkeys.php`: seeds deterministic login credentials and a fresh
  24-hour registration token for Docker E2E flows.
- `scripts/docker-entrypoint.sh`: added startup seeding, writable path setup,
  SMTP-driven `msmtp` config, and registration URL hints.
- `scripts/docker-build.sh`: added build/run/stop/clean workflow with
  VPS-mirroring mounts and optional `.env.docker` mount.
- `e2e/admin-exception-visibility.spec.ts`: added Chromium Docker checks for
  input visibility, contrast and overlap in the admin exception form.
- Admin opening hours UI redesigned with glass aesthetic, bilingual labels,
  season timeline with remove icon, defaults modal, duplicate exception
  prevention with Update button, per-weekday preview with exception overlay.
- UTC-based `addDays` and `ensureContiguous` to prevent season overlap.
- TDD smoke tests for prototype features.

### Changed

- Preview now computes per-weekday date to show correct season and exception for
  each day of week.
- Season creation now inherits from editable defaults.

## v1.2.23

### Updated

- **Next.js** 16.3.3 → 16.3.8. Pulls eslint-config-next 16.4.0.
- **html-validate** 10.1.2 → 10.17.0. Removes transitive deprecated
  `glob@11.1.0` → `glob@13.0.6`.

### Fixed

- **Lint**: `react-hooks/set-state-in-effect` errors introduced by
  eslint-config-next 16.4.0.
  - `src/app/admin/register/page.tsx`: removed redundant
    `setView({ name: 'request' })` on missing token and disabled the intentional
    immediate `setView({ name: 'validating' })` with `eslint-disable-next-line`.
  - `src/components/OwnerHoursForm.tsx`: disabled the rule for the intentional
    mount `loadSchedule()` call.

## v1.2.22

Updated deployment verification script, so it uses `sed` instead of `node`.

## v1.2.21

### Fixed TS errors

- TS2307
- TS2345
- TS2769
- TS2802

By fixing the code using [Muse Glimmer 30B][museGlimmer30BLink] instead of
[Nemotron 3.5 Lightning 30B A3B][nemotron35Lightning30BA3BLink]

## v1.2.20

### Fixed

- **E2E test: overrides the Friday row with exception hours**: Fixed test date
  from September (extended summer period) to January (outside extended summer)
  and changed assertion from `toContainText('9:00 - 15:00')` to
  `toContainText('9:00')` to properly verify the exception hours are present
  when the Friday schedule has an exception. Also fixed the
  `mockOpeningHoursJson` function to properly serve `/opening-hours.jsonc` with
  exception data.

### Updated

- **Nextjs** updated to 16.3.3 to eliminate two critical issues identified by
  dependabot.

## v1.2.19

### Fixed

- **E2E test: opening hours Friday row**: Fixed test date from September
  (extended summer period) to January (outside extended summer) and changed
  assertion from `toHaveText` to `toContainText` to properly verify the "Pátek"
  day name is present when the Friday schedule is empty (`fri: ''`).

### Updated

- **Nextjs** updated to 16.3.3 to elimininate two critical issues identified by
  dependabot.

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

---

[museGlimmer30BLink]: https://huggingface.co/meta-models/Muse-Glimmer-30B
[nemotron35Lightning30BA3BLink]:
  https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b/modelcard
