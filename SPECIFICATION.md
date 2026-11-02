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

## 5. Admin area

Both admin routes are client components gated by `NEXT_PUBLIC_USE_ADMIN`
(`src/lib/featureFlags.ts`): `/admin/` renders a "disabled" card when the flag
is not `1`, `/admin/register/` renders nothing. `src/app/admin/layout.tsx`
contributes only the page title/description. Every admin request uses
`credentials: 'include'` so the PHP session cookie travels with it.

### 5.1 Registration (`/admin/register/`, `register.php`)

The page is a single `view` state machine with these screens:

- **Request** — a bare e-mail input; the `→` submit button only appears once the
  address matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Submitting POSTs
  `{ "username": "<email>" }`.
- **Sent** — the neutral "Pokud účet existuje, e-mail s odkazem byl odeslán."
  card with a Back button; identical for existing and unknown accounts.
- **Validating / Registering** — spinners ("…", "Postupujte podle pokynů v
  prohlížeči.").
- **Password** — rendered only when `validate-token` reports
  `password_required: true`.
- **Success** — "Vaše zařízení je připraveno." with a link to `/admin/`.
- **Invalid / error** — one shared card; `invalid` is the expired-link case,
  `error` everything else.

Server contract:

- `request-token` (POST, rate limit 3/h/IP, counters in `sys_get_temp_dir()`
  files): 400 when the address fails `FILTER_VALIDATE_EMAIL`, 429 when rate
  limited, 500 when the token insert fails. Existence is `ADMIN_USERS`
  membership when that env is set, else the MariaDB lookup of §4.2
  (`MAILDB_TABLE`, `active = 1`); a `PDOException` is logged and treated as "may
  exist". A 32-byte `bin2hex(random_bytes(32))` token is inserted into
  `reg_tokens` (`expires_at = now + 1 hour`) **before** any mail is attempted,
  so both branches cost the same. When the account exists the link is
  `{APP_BASE_URL}/admin/register/?token=…` (`APP_BASE_URL` defaults to
  `https://tacukrarna.cz`), sent with `mb_send_mail()` and a `-f<from>` envelope
  sender from `SMTP_FROM` (default `Ta Cukrárna <info@tacukrarna.cz>`) for
  SPF/DMARC alignment; a missing `mb_send_mail` is logged, not reported. The
  response is always `{ "status": "success", … }` — only 429 and 5xx are
  unconditional and are shown verbatim by the UI.
- `validate-token` (GET `?token=…`): requires `used = 0 AND expires_at > now`
  (400 "Token neplatný nebo vypršel" otherwise). On success it stores
  `reg_username` + `reg_token_id` in the session and returns
  `{ valid, username, password_required }`; `password_required` is `false`
  exactly when `ADMIN_USERS` covers the session user, in which case the UI skips
  the password form and starts the ceremony immediately.
- `verify-password` (POST `{ "password": … }`): 405 for non-POST, 403 without a
  registration session, 400 for an empty password. The `ADMIN_USERS` branch
  (test mode only) logs `imap_bypass_admin_users`, marks the token used and sets
  `reg_verified`. The production branch calls `imap_open()` with the whole
  mailbox string from `IMAP_SERVER` (default
  `127.0.0.1:993/imap/ssl/novalidate-cert`; port 143 is deliberately not a
  fallback). A TLS/certificate transport error answers 503 "not currently
  available", anything else 401 "Nesprávné heslo" — a wrong password must not
  look like an outage.
- **Token single-use**: `markTokenUsed()` fires at the password step, not at
  `verify_register`. A ceremony that fails after a successful password proof
  therefore needs a fresh link.
- Ceremony (`challenge_register` / `verify_register`, details in §6):
  `challenge_register` needs `reg_username` in the session (403) and refuses a
  second challenge in the same session (400 "Výzva byla již vygenerována"); the
  user handle is a fresh random 16-byte value (`reg_user_id`), not derived from
  the e-mail. Both steps enforce the 120 s challenge TTL (400 "Výzva vypršela").
  `verify_register` needs `clientDataJSON` + `attestationObject` (400
  otherwise), inserts the passkey (counter = attested counter or 0) and clears
  the whole registration session state. It does **not** touch `reg_tokens` —
  that row is already `used = 1`.
- `?action=reset` (POST) unsets the same registration keys explicitly; no UI
  screen calls it today (manual/debug cleanup).

### 5.2 Sign-in (`/admin/`, `webauthn.php`)

1. `challenge_login` (POST, no auth): 400 "Nejsou registrovány žádné přístupové
   klíče" when the `passkeys` table is empty — the sign-in button is useless
   before any device is registered. Otherwise it issues discoverable-credential
   `getArgs` and stores `login_challenge` (+ `login_challenge_time`, 120 s TTL)
   in the session.
2. `verify_login` (POST): 403 without a session challenge, 400 on an expired
   challenge or a payload missing `id` / `clientDataJSON` / `authenticatorData`
   / `signature`. The credential id is base64url and is looked up in SQLite; an
   unknown id, a failed `processGet()` and an invalid result all answer the same
   generic 401 (§10). On success the signature counter and `last_used_at` are
   updated and `setAdminSession()` opens the session.
3. The page then obtains the CSRF token: it prefers a `csrfToken` field in the
   `verify_login` response (the server does not send one today) and otherwise
   calls `GET /api/csrf.php`, which creates the token on first use.

**Session model** (`session.php`): cookie `lifetime = 86400`, `path = /`,
`httponly`, `samesite = Lax`, `secure` except on localhost/127.0.0.1 hosts;
`isAdmin()` additionally rejects an admin session whose `admin_login_time` is
older than 24 h; `requireAdmin()` answers 401 `{ "error": "Unauthorized" }` —
note this one message is not bilingual, so the editor shows it verbatim.

**There is no sign-out endpoint.** The "Odhlásit se" link on the editor screen
is a plain client-side `<Link href="/">`; the PHP session stays valid until its
24 h expiry, so an admin session ends only by cookie clear or timeout (same gap
as the missing passkey-revocation UI, §11).

UI: sign-in card → "Připravuji přihlášení…" / "Čekám na přístupový klíč…"
spinner → error card with a retry button → editor card.

### 5.3 Opening-hours editor (`/admin/`, `OwnerHoursGlassForm.tsx`)

- On mount it GETs `/api/opening-hours.php` (`credentials: 'include'`) and
  parses the raw JSONC body with the client-side `parseJsonc()`; a load failure
  keeps the card in its error state and the save button never renders.
  `OwnerHoursForm.tsx` is a superseded copy (not imported by any page) — the
  live editor is the Glass form.
- Seasons: one card per entry with two date inputs and seven free-text day
  cells; `+ Přidat sezónu` inserts after a card (or appends), `×` removes one.
  The last remaining season cannot be removed and saving with zero seasons is
  rejected client-side. New seasons prefill their day cells from the `defaults`
  template matching their start month (July/August → `summer`, otherwise
  `spring`); unknown season keys contribute nothing.
- Dates are editable in the form, but `ensureContiguous()` rewrites them on
  save: every start becomes the previous end + 1 day and the last `endDate`
  becomes the `9999-12-31` sentinel (§4.3). Because that sentinel is always the
  last end date, appending one more season after it produces a malformed start
  date which the client-side date check rejects ("Neplatné datum") — the save is
  blocked rather than writing garbage.
- Client-side validation mirrors the server: ISO `YYYY-MM-DD` dates, start ≤
  end, per-day text ≤ 100 chars, no overlapping ranges, at least one season.
- Exceptions: date + free-text hours per row; `+ Přidat výjimku` is disabled
  while a row still has an empty date, and a duplicate date is blocked with an
  `alert()` client-side (the server rejects it too). The "Náhled" panel renders
  the current week — the season covering each date, overridden by an exception
  for that exact date — with empty values and "Výdej objednávek" / "Order
  pickup" shown as closed (red).
- "Upravit výchozí" opens the defaults modal with `summer` ("Léto") and `spring`
  ("Mimo léto") day grids. Cancel only closes it; "Uložit" closes the modal
  **and** runs the same save, so the modal has no separate persistence path —
  values load from and save to the server file (no localStorage).
- Saving POSTs `{ schedule, exceptions, defaults }` as JSON with the
  `X-CSRF-Token` header (omitted when the `csrf` prop is disabled). The server
  re-validates everything (§4.3) and answers 401 without an admin session, 403
  on a stale token, 429 above 10 saves/h/IP and 400 on invalid data; the server
  error text is shown verbatim via `pickBilingual()`, falling back to "Uložení
  selhalo." only when empty. Success shows "Otevírací doba byla úspěšně
  uložena."

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

- No passkey management UI (list/revoke); recovery for a lost device is a manual
  SQLite delete (backlog item in DEV_NOTES.md). **Planned for v1.4.0: add
  "Správa zařízení" tab in the admin panel to list registered passkeys with
  creation/last-used timestamps and a revoke action.**
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

### 12.1 Passkey management UI ("Správa zařízení")

**New admin tab** accessible after successful WebAuthn sign-in, alongside the
opening-hours editor.

**Backend changes** (`public/api/webauthn.php`):

- New action `list_credentials` (POST, admin session + CSRF): returns all
  passkeys for the authenticated admin user (`username` from session), including
  `credential_id` (base64url), `created_at`, `last_used_at`, `counter`, and
  `user_agent`/`device_info` if available (new columns in `passkeys` table).
- New action `revoke_credential` (POST, admin session + CSRF): accepts
  `credential_id` (base64url), deletes the row if it belongs to the session
  user, returns success. Rate-limited to 10/h/IP.

**Database schema changes** (`public/api/DB/init.php`):

- Add `user_agent` TEXT and `device_info` JSON columns to `passkeys` table.
- Populate on registration from `navigator.userAgent` and `PublicKeyCredential`
  metadata (transports, etc.).

**Frontend changes** (`src/app/admin/page.tsx`, new component
`src/components/PasskeyManager.tsx`):

- Tabbed layout: "Otevírací doba" | "Správa zařízení".
- Passkey list: table with columns "Registrováno", "Naposledy použito", "Počet
  podpisů", "Zařízení", "Akce".
- "Odvolat" button per row with confirmation modal (prevents accidental
  revocation of the currently used passkey).
- Empty state: "Zatím nejsou registrována žádná zařízení." with link to
  `/admin/register/`.
- Accessibility: proper table semantics, keyboard navigation, ARIA labels.

**Security considerations**:

- Users can only list/revoke their own passkeys (enforced by `username` in
  session).
- Revoking the last passkey is allowed (owner can re-register via
  `/admin/register/`).
- No "revoke all" bulk action to prevent lockout mistakes.
- CSRF protection on both endpoints.

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
