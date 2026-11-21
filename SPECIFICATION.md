# SPECIFICATION

Technical specification of the Ta Cukrárna website and admin backend. This
document describes **what the system is and how it behaves** (contracts, flows,
data). Operational guidance lives in [README.md](README.md) (setup),
[AGENTS.md](AGENTS.md) (agent conventions, Docker test environment),
[DEVELOPMENT_TOOLS.md](DEVELOPMENT_TOOLS.md) (VPS operations) and
[CHANGELOG.md](CHANGELOG.md) (history). Everything below reflects the code as of
v1.3.6; when code and this document disagree, the code wins and this document
must be updated.

## 1. System overview

Ta Cukrárna is a mostly static website with a small owner-only admin area for
managing opening hours.

- **Frontend**: Next.js 16 (App Router, React 19, TypeScript, Tailwind CSS v4)
  built as a **static export** into `out/`. PWA service worker (`public/sw.js`),
  dark mode, bilingual UI.
- **Backend**: PHP 8 files under `public/api/*.php`, executed by Apache on the
  VPS only (the static export cannot run PHP). No framework; shared helpers in
  `db.php` and `session.php`; the `lbuchs/WebAuthn` v2.2.0 library is vendored
  under `public/api/vendor/` and committed.
- **Hosting**: single Apache vhost on the VPS; the docroot is the _contents_ of
  `out/` (site at `/`, PHP API at `/api/`, runtime state file
  `opening-hours.jsonc` at the root). Deployed by GitHub Actions on version
  tags.

Environments:

| Environment           | Docroot / app               | PHP                 | Purpose                           |
| --------------------- | --------------------------- | ------------------- | --------------------------------- |
| Local dev             | `next dev` (port 3000)      | none                | UI work                           |
| Docker test container | bind-mounted `out/`         | 8.5 (Sury) + Apache | E2E against the real API          |
| CI (GitHub Actions)   | `npx serve out` (port 3001) | none                | E2E static harness, gates deploys |
| Production VPS        | `out/` contents via rsync   | VPS PHP-FPM/Apache  | live site                         |

## 2. Frontend

- **Pages**: `/` (public homepage with opening hours), `/admin/` (owner
  sign-in + opening-hours editor), `/admin/register/` (owner registration).
- **Languages**: `cs` | `en` (`src/lib/i18n.tsx`); server snapshot is Czech,
  browser locale decides the initial client value, toggle persists to
  localStorage.
- **Feature flags** (`src/lib/featureFlags.ts`): `NEXT_PUBLIC_USE_ADMIN` and
  `NEXT_PUBLIC_USE_CHATBOT`, inlined at build time. The admin pages render a
  "disabled" state when `NEXT_PUBLIC_USE_ADMIN !== '1'`. Values come from the
  host `.env` (local/Docker) or GitHub vars `USE_ADMIN` / `USE_CHATBOT` (CI
  build).
- **PWA**: `public/sw.js` caches static assets for offline use
  (`skipWaiting()` + `clients.claim()` for immediate takeover). Its `CACHE_NAME`
  (`ta-cukrarna-vX.Y.Z`) is rewritten by `scripts/write-version.sh` on every
  build, so each release activates a new cache. `/version.txt` is fetched
  network-first to keep the footer version fresh.

## 3. Backend API

All endpoints live in `public/api/`, are stateless PHP scripts addressed by
query parameter (`?action=…`), speak JSON (`jsonResponse()` in `db.php`) and
share:

- `db.php`: `getSqliteDb()` (passkey store), `getMailDb()` (MariaDB, calls
  `loadEnv()`), `loadEnv()` (parses the `.env` file **one level above the
  docroot**; existing process env vars take precedence), `jsonResponse()`,
  `logEvent()` (writes `api/DB/api-debug.log`), `getClientIp()`.
- `session.php`: `startSession()`, CSRF helpers (`generateCsrfToken`,
  `getCsrfToken`, `validateCsrfToken`), admin session helpers
  (`setAdminSession`, `isAdmin`, `requireAdmin`, `getAdminUsername`).

| Endpoint                | Method(s) | Auth                                        | Purpose                                                                                     |
| ----------------------- | --------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `api/opening-hours.php` | GET       | public                                      | read schedule + exceptions (JSONC-tolerant)                                                 |
| `api/opening-hours.php` | POST      | admin session + CSRF + rate limit (10/h/IP) | validate + atomically write the file                                                        |
| `api/webauthn.php`      | POST      | varies (see §6)                             | `challenge_register`, `verify_register`, `challenge_login`, `verify_login`                  |
| `api/register.php`      | POST      | varies (see §5)                             | `request-token`, `verify-password`, `reset`                                                 |
| `api/register.php`      | GET       | —                                           | `validate-token`                                                                            |
| `api/csrf.php`          | GET       | session                                     | returns the session CSRF token (CORS allowlist)                                             |
| `api/chatbot.php`       | POST      | public (rate-limited upstream)              | e-mails the wedding-handbook link via the system MTA (`mb_send_mail`, `-f` envelope sender) |

Mail transport on both the VPS and in the Docker container is the **system
sendmail** (`msmtp` in the container, Postfix/sendmail on the VPS); there is no
SMTP-socket client in the PHP code.

## 4. Data stores

### 4.1 SQLite (`public/api/DB/passkeys.sqlite`, schema in `DB/init.php`)

- `passkeys`: `id`, `credential_id` (BLOB, unique), `public_key` (**PEM** string
  of the credential's ES256 public key), `counter`, `username`, `created_at`,
  `last_used_at`.
- `reg_tokens`: `id`, `token` (unique), `username`, `expires_at`, `used`,
  `created_at`.
- Schema creation is idempotent (`php public/api/DB/init.php`); the deploy
  re-runs it on every release, data survives via `.rsyncignore`.
- The directory also holds `api-debug.log`. `api/DB/.htaccess`
  (`Require all denied`) makes both unreachable over HTTP.

### 4.2 MariaDB (VPS only)

The `MAILDB_TABLE` (default `admin`) holds the owner's mail accounts
(`username`, `active`). Used exclusively by the registration account check (§5).
Credentials come from the `.env` keys `MAILDB_HOST`, `MAILDB_NAME`,
`MAILDB_USER`, `MAILDB_PASSWORD`.

### 4.3 `opening-hours.jsonc` (docroot, runtime state)

```jsonc
{
  "schedule":   [ { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD",
                    "days": { "mon": "9:00 - 17:00", … , "sun": "" } } ],
  "exceptions": [ { "date": "YYYY-MM-DD", "hours": "9:00 - 15:00" } ],
  "defaults":   {                                   // optional, nested by season key
    "summer": { "mon": "…", … , "sun": "…" },
    "spring": { "mon": "…", … , "sun": "…" }
  }
}
```

- Read tolerantly as **JSONC** (comments and trailing commas); writes are strict
  JSON (admin saves normalize the file).
- Empty `hours`/day value means _closed_. An empty string never renders as red
  "closed" outside exceptions (display rule in `OpeningHours.tsx`).
- Precedence: user exceptions > system holidays (`public/holiday.jsonc`) >
  season schedule covering today > `defaults` (season-keyed fallback) > built-in
  schedules. The public homepage picks the `defaults` key by season (July/August
  → `summer`, otherwise `spring`) when no schedule entry covers today; unknown
  season keys are preserved on save.
- Validation on save: 4-digit ISO dates (`isValidIsoDate`), start ≤ end,
  non-overlapping ranges, all seven day keys present, day/hours text ≤ 100 chars
  from a whitelist charset. The admin form marks the last season open-ended with
  the sentinel endDate `9999-12-31`.
- Writes go to a temp file + atomic rename, so the docroot directory itself must
  be writable by PHP (see the group-write fixup in DEVELOPMENT_TOOLS.md).

## 5. Administration

Both admin routes are client components gated by `NEXT_PUBLIC_USE_ADMIN`
(`src/lib/featureFlags.ts`): `/admin/` renders a "disabled" card when the flag
is not `1`, `/admin/register/` renders nothing. `src/app/admin/layout.tsx`
contributes only the page title/description. Every admin request uses
`credentials: 'include'` so the PHP session cookie travels with it.

The admin panel (`/admin/`) is a **tabbed interface** with two panels:

- **Otevírací doba** (Opening hours) — season/exception editor
- **Správa zařízení** (Device management) — passkey list/revoke UI

### 5.1 Registration (`/admin/register/`, `register.php`)

A single-page state machine with these screens:

| View                | Trigger                                         | Notes                                                        |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| **Request**         | Initial load (no `?token=`)                     | Bare e-mail input; `→` button appears only on valid format   |
| **Sent**            | `request-token` returns 200                     | Neutral "Pokud účet existuje…" — no account-existence oracle |
| **Validating**      | Page load with `?token=`                        | Spinner while `validate-token` runs                          |
| **Password**        | `validate-token` → `password_required: true`    | IMAP password proof (production)                             |
| **Registering**     | Password verified or `password_required: false` | WebAuthn registration ceremony                               |
| **Success**         | `verify_register` returns 200                   | Link to `/admin/`                                            |
| **Invalid / Error** | Expired token or any failure                    | Shared card; `invalid` = expired, `error` = other            |

**Server actions** (`register.php`):

- `request-token` (POST, 3/h/IP): validates e-mail, checks account existence via
  `ADMIN_USERS` env (test) or MariaDB `MAILDB_TABLE` (prod; `active=1`), inserts
  32-byte token into `reg_tokens` (1 h TTL) **before** mail attempt, sends link
  via `mb_send_mail()` with `-f` envelope sender. Always returns 200
  `{status:"success"}`; only 429/5xx are unconditional.
- `validate-token` (GET): requires `used=0 AND expires_at>now`. Sets
  `reg_username` + `reg_token_id` in session. Returns
  `{valid, username, password_required}`; `password_required=false` when
  `ADMIN_USERS` covers the user.
- `verify-password` (POST): `ADMIN_USERS` branch marks token used, sets
  `reg_verified`. Prod branch calls `imap_open()` with `IMAP_SERVER` (default
  `127.0.0.1:993/imap/ssl/novalidate-cert`). TLS error → 503; auth failure → 401
  (never looks like outage).
- Token single-use: `markTokenUsed()` fires at password step, not at
  `verify_register`.
- Ceremony: `challenge_register`/`verify_register` (§6) need `reg_username` +
  `reg_verified` in session, enforce 120 s TTL, user handle = random 16 bytes.
  `verify_register` inserts passkey (counter = attested or 0), clears
  registration session.
- `reset` (POST): debug cleanup, no UI entry.

### 5.2 Sign-in (`/admin/`, `webauthn.php`)

1. **challenge_login** (POST, no auth): if `passkeys` empty → 400; else issues
   discoverable-credential `getArgs`, stores `login_challenge` + timestamp (120
   s TTL).
2. **verify_login** (POST): 403 without session challenge, 400 on expired/bad
   payload. Credential ID (base64url) looked up in SQLite; unknown/invalid →
   generic bilingual 401. On success: updates `counter` + `last_used_at`, calls
   `setAdminSession()`.
3. **CSRF token**: prefers `csrfToken` in `verify_login` response (not sent
   today), falls back to `GET /api/csrf.php`.

**Session model** (`session.php`): cookie `lifetime=86400`, `path=/`,
`httponly`, `samesite=Lax`, `secure` except localhost; `isAdmin()` rejects
sessions older than 24 h; `requireAdmin()` returns 401 `{error:"Unauthorized"}`
(non-bilingual).

**No sign-out endpoint.** "Odhlásit se" is a client-side `<Link href="/">`; PHP
session lives until 24 h expiry or cookie clear.

### 5.3 Opening-hours editor (`/admin/`, `OwnerHoursGlassForm.tsx`)

**Data model** (mirrors `opening-hours.jsonc` §4.3):

- **Schedule**: array of seasons — `startDate`, `endDate`, `days.{mon..sun}`
- **Exceptions**: array of `{date, hours}` (override schedule for exact date)
- **Defaults**: nested by season key (`summer`/`spring` + unknown preserved)

**UI features**:

- **Seasons**: horizontal scroll cards; `+ Přidat sezónu` inserts after/appends;
  `×` removes (min 1). New seasons prefill from `defaults` by start month
  (Jul/Aug → `summer`, else `spring`).
- **Date contiguity**: on save, `ensureContiguous()` rewrites — each `startDate`
  = previous `endDate`+1; last `endDate` = `9999-12-31`. Appending after
  sentinel is blocked client-side.
- **Validation** (client + server): ISO dates, start ≤ end, day text ≤ 100
  chars, no overlap, ≥1 season.
- **Exceptions**: date+hours rows; add disabled while any row has empty date;
  duplicate dates blocked client-side + server.
- **Preview panel**: current week, shows season/exception source, "Výdej
  objednávek"/"Order pickup" = closed (red), today highlighted.
- **Defaults modal**: tabbed `summer`/`spring` (Escape/Cancel dismisses, Save
  closes + triggers same save).
- **Autosave draft**: localStorage (`ta-cukrarna-opening-hours-draft`), 30 s
  interval, 24 h TTL, restore banner on load.
- **Copy/paste**: paste 7 values into first day cell → auto-fills week.
- **Keyboard nav**: Enter in day cell → next day; end of week → next season
  first day.
- **Save**: POST `{schedule, exceptions, defaults}` with `X-CSRF-Token`; server
  re-validates (§4.3), 401/403/429/400 errors shown verbatim via
  `pickBilingual()`.

### 5.4 Device management (`/admin/`, `PasskeyManager.tsx`)

**Backend** (`webauthn.php`):

- `list_credentials` (POST, admin session + CSRF, 10/h/IP): returns all passkeys
  for session `username` — `id`, `credential_id` (base64url), `counter`,
  `created_at`, `last_used_at`, `user_agent`, `device_info` (transports[],
  platform).
- `revoke_credential` (POST, admin session + CSRF, 10/h/IP): accepts
  `credential_id` (base64url), verifies ownership, deletes row. Last passkey
  revocation allowed (re-register via `/admin/register/`).

**Frontend**:

- Table: Registrováno, Naposledy použito, Počet podpisů, Zařízení (platform +
  transports), Akce.
- Two-step revoke: click "Odvolat" → confirm buttons (Potvrdit/Zrušit) → API
  call → auto-reload list.
- Empty state: "Zatím nejsou registrována žádná zařízení." + link to
  registration.
- Warning text: revocation is irreversible; device must be re-registered.

## 6. WebAuthn details

- **RP ID**: `tacukrarna.cz` (hard default). `WEBAUTHN_RP_ID` may override it
  (Docker test container uses `localhost`, which enables real browser ceremonies
  on `http://localhost`). The RP ID flows to the browser inside
  `createArgs`/`getArgs` — the frontend never hardcodes it.
- **Origin check** (lbuchs `_checkOrigin`): scheme must be https _unless_ the RP
  ID is `localhost`; the origin host must end with the RP ID.
- **Algorithms**: offered `EdDSA (-8)`, `ES256 (-7)`, `RS256 (-257)`; stored
  credentials in practice are ES256 / P-256.
- **Stored public key format**: PEM (converted from the COSE key at registration
  by `AuthenticatorData::getPublicKeyPem()`).
- **Assertion signature format**: browsers deliver **raw `r‖s`** (IEEE P1363, 64
  bytes for ES256); `openssl_verify()` requires DER, so `webauthn.php` converts
  raw signatures at the boundary (`rawEcdsaSignatureToDer()`). DER inputs pass
  through unchanged.
- **Signature counter**: must be **strictly greater** than the stored value when
  either side is non-zero (clone detection). The Docker seeder and
  `resetPasskeyCounter()` (e2e helper) reset counters to 0 so tests can always
  assert with counter 1.
- **Ceremonies** require user presence + user verification; registration uses
  resident keys (`residentKey: required`) with `excludeCredentials` populated
  from the user's stored credential ids.

## 7. Docker test environment

Contract-level summary — setup and day-to-day usage are documented in README.md
("Docker E2E Testing"), operational rules in AGENTS.md ("Docker test
environment").

- Image (`docker/Dockerfile.test`): Debian bookworm + Apache + PHP 8.5 (Sury
  repo, incl. `php8.5-sqlite3`) + `msmtp`/`msmtp-mta` + entrypoint. **No
  application code is baked in** — `out/`, `public/api`, `public/api/DB`, the
  entrypoint/seeder scripts and `.env.docker` (→ `/var/www/.env`) are
  bind-mounted at run time.
- At start, the entrypoint seeds SQLite (schema + one signable P-256 passkey +
  one 24 h registration token), cleans stale/previous tokens, generates
  `/etc/msmtprc` from `SMTP_*` and starts Apache in the foreground. Test client
  credentials land in gitignored `public/api/DB/test-credentials.json`
  (`credentialId`, JWK private key, `registerToken`, `registerUrl`).
- Env knobs (container only, **never on the VPS**): `ADMIN_USERS` (registration
  without MariaDB/IMAP), `SMTP_*` (external MTA), `WEBAUTHN_RP_ID=localhost`,
  `APP_BASE_URL=http://localhost`.
- Mounted docroot layout equals production: site at `/`, API at `/api/`,
  `opening-hours.jsonc` at the root.

## 8. Testing

Two Playwright harnesses share one config (`playwright.config.ts`; projects
chromium, Pixel 5, Galaxy S5 — deliberately no WebKit):

- **Static harness** (`npm run test:e2e`): serves `out/` on `127.0.0.1:3001`, no
  PHP — every `/api/*.php` call is mocked via `page.addInitScript` fetch
  overrides; `navigator.credentials` is stubbed (browsers reject the production
  RP ID on a localhost origin). Runs in CI and gates deploys.
- **Docker harness** (`npm run test:e2e:docker`, `DOCKER_E2E=1`): runs against
  the container on `http://localhost` with the real PHP backend; the local
  `webServer` is skipped. Only `navigator.credentials` is stubbed (software
  authenticator, `e2e/helpers/soft-webauthn.ts`): challenges, signatures, SQLite
  lookups, sessions and CSRF are real. Specs assert the server-sent RP ID
  (`expectedRpId()`) as a regression guard. Sign-in specs run chromium-only
  (server-side verification is browser-independent).

## 9. Deployment & release

- Deploys trigger **only on `vX.Y.Z` tag push**; the CI job runs the static E2E
  suite and gates the deploy job. The workflow builds with `NEXT_PUBLIC_*` flags
  from GitHub vars, rsyncs `out/` to the VPS docroot (`.rsyncignore` protects
  `api/DB/` and `opening-hours.jsonc`), re-runs `DB/init.php` and applies the
  www-data permission fixup.
- Release steps (commits with `-s -S`): `bash scripts/write-version.sh vX.Y.Z`
  (syncs `package.json`, `package-lock.json` — both version fields — and
  `public/version.txt`), commit the version files, annotated signed tag, single
  `git push origin main --follow-tags`. The pre-push hook validates tag
  monotonicity and version sync. Details: AGENTS.md "Release flow".

## 10. Security model

- **Passkeys are the only admin auth factor**; there is no password login. The
  IMAP password check during registration is a one-time ownership proof, not a
  login credential.
- **`.env` lives one level above the docroot** and is never web-reachable;
  secrets are never committed (`.gitignore` covers `.env`, `.env.docker`,
  `api/DB/*.sqlite*`, `test-credentials.json`, `api-debug.log`).
- **CSRF**: session-bound token required on all state-changing admin requests
  (`X-CSRF-Token` header or `csrf_token` field).
- **Rate limits**: registration tokens 3/h/IP, opening-hours saves 10/h/IP.
- **No account-existence oracle**: registration responses are neutral; all
  WebAuthn failures share one generic bilingual message.
- **Counter-based clone detection** on assertions (§6).
- `ADMIN_USERS` / `WEBAUTHN_RP_ID` relax production checks and must never be
  defined on the VPS.

## 11. Known limitations & open items

- No sign-out endpoint: the admin "Odhlásit se" link is client-side only, so a
  PHP admin session stays valid for its full 24 h lifetime.
- `OwnerHoursForm.tsx` is dead code kept for reference;
  `OwnerHoursGlassForm.tsx` is the editor the app actually uses (several
  comments in `AGENTS.md` and `e2e/*.spec.ts` still name the old component).
- The Docker container has no MariaDB/IMAP stack — the registration flow there
  relies on the `ADMIN_USERS` bypass and the seeded token.
- The chatbot endpoint trusts upstream rate limiting; there is no
  application-level throttle as of v1.3.6.
- First version of this specification: v1.3.6 (October 2026).

## 12. Planned improvements (v1.4.0+)

### 12.1 Passkey management UI ("Správa zařízení") — **Implemented in v1.3.x**

The passkey management tab is already live in the admin panel. Implementation
matches the plan below; remaining open items are tracked in DEV_NOTES.md.

**Backend** (`public/api/webauthn.php`): `list_credentials` +
`revoke_credential` actions (admin session + CSRF, 10/h/IP rate limit). Returns
`credential_id` (base64url), `created_at`, `last_used_at`, `counter`,
`user_agent`, `device_info` (transports[], platform).

**Database** (`public/api/DB/init.php`): `user_agent` TEXT + `device_info` JSON
columns added to `passkeys`; populated on registration from
`navigator.userAgent` and `PublicKeyCredential` metadata.

**Frontend** (`src/app/admin/page.tsx`, `src/components/PasskeyManager.tsx`):
Tabbed layout "Otevírací doba" | "Správa zařízení"; table with columns
Registrováno, Naposledy použito, Počet podpisů, Zařízení, Akce; two-step revoke
confirmation; empty state with registration link; full accessibility (table
semantics, ARIA labels).

**Security**: users list/revoke only their own passkeys (session `username`);
last passkey revocation allowed (re-register via `/admin/register/`); no bulk
revoke; CSRF on both endpoints.

### 12.2 Opening-hours editor UX improvements

**Target component**: `OwnerHoursGlassForm.tsx` (the live editor).

**Planned enhancements**:

1. **Inline validation feedback**: show field-level errors (red border +
   message) on blur/change instead of only blocking save with a toast.
2. **Keyboard navigation**: Tab/Shift+Tab flows naturally through season cards,
   date inputs, day cells, and exception rows; Enter in a day cell moves focus
   to the next day.
3. **Copy/paste support**: allow pasting a full week schedule (7 values) into
   the first day cell of a season — auto-fills the remaining days.
4. **Drag-to-reorder seasons**: use `@dnd-kit/core` (lightweight, no heavy deps)
   to reorder season cards; `ensureContiguous()` recalculates dates on drop.
5. **Exception date picker**: replace raw date input with a small calendar
   popover (native `<input type="date">` is kept as fallback).
6. **Preview panel enhancements**: highlight today's row, show "Dnes" badge,
   indicate which season/exception is active for each day.
7. **Auto-save draft to localStorage**: persist unsaved changes every 30s;
   restore on load with a "Obnovit koncept" banner; cleared on successful save.
8. **Responsive layout**: on mobile (< 640px), stack season cards vertically
   without horizontal scroll; day grid becomes 2 columns.
9. **Accessibility**: proper labels for all inputs, live region for save status,
   focus management in defaults modal.

**No backend changes required** — the API contract stays the same.
