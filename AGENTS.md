# AGENTS.md

Guidance for AI agents working in this repository. Facts here are verified;
prefer them over plausible-sounding assumptions.

## Project shape

- Next.js app, **static export** (`out/`), deployed to a VPS by GitHub Actions.
  The PHP backend (`public/api/*.php`) is copied verbatim into `out/api/` and is
  served by Apache on the VPS — it runs there ONLY (the local test harness
  `npx serve out` cannot execute PHP). Runtime state lives in `api/DB/` (SQLite)
  and `opening-hours.jsonc` (docroot; JSONC — comments and trailing commas
  allowed for hand edits, parsed via `src/lib/jsonc.ts` / `jsoncDecode()` in
  PHP); both are excluded in `.rsyncignore` so `rsync --delete` cannot wipe them
  across deploys.
- Production URL: `<https://tacukrarna.cz>` (RP ID for WebAuthn:
  `tacukrarna.cz`).

## Release flow (follow exactly)

1. Commit on `main` with `git commit -s -S` (sign-off + SSH signature).
2. Sync the version files: `bash scripts/write-version.sh vX.Y.Z` (updates
   `package.json`, `package-lock.json` — **both** version fields — and
   `public/version.txt`).
3. Commit them: `git commit -s -S -m "🔖 Release vX.Y.Z"` (only the three
   version files).
4. `git tag -a -s vX.Y.Z -m "Release vX.Y.Z"` (patch increments only, on the
   release commit from step 3).
5. `git push origin main --follow-tags` — **a single push succeeds**: the
   pre-push hook finds the version files already in sync with the tag and is a
   no-op (`scripts/release.sh` automates steps 2–5). If you tag HEAD without
   syncing first, the hook syncs, re-points the tag and aborts the first push by
   design — re-run the identical push (details in `DEVELOPMENT_TOOLS.md`). Never
   bypass with `--no-verify`.
6. Deploys trigger ONLY on tag push (`on: push: tags: ['v*']`). The `ci` job
   gates `Deploy to VPS`, so **one failing E2E test blocks the release**.
7. Verify releases via `gh run view <id> --log-failed` (allowed commands:
   `gh run list`, `gh run view`).

## Feature flags

- Client-side flags MUST use the `NEXT_PUBLIC_` prefix (`NEXT_PUBLIC_USE_ADMIN`,
  `NEXT_PUBLIC_USE_CHATBOT` in `src/lib/featureFlags.ts`). A plain
  `process.env.X` in a `'use client'` module compiles to a browser runtime read
  and is always `undefined` — the flag silently disables UI with no error.
- The deploy workflow maps GitHub vars `USE_ADMIN` / `USE_CHATBOT` onto the
  `NEXT_PUBLIC_*` names in the build step. Local dev uses `.env` (gitignored).
- After changing flag wiring, grep the built chunks in `out/_next/static/`: an
  inlined flag disappears (literal true/false); a broken one shows a runtime
  `env.X` accessor.

## E2E tests (Playwright)

- Harness: `npm run test:e2e` serves `out/` with `npx serve` on `127.0.0.1:3001`
  — **static only, no PHP**. Mock `/api/*.php` endpoints via
  `page.addInitScript` fetch overrides in every spec that hits them, including
  `/api/opening-hours.php` (`OwnerHoursForm` stays in its loading state without
  it, so the save button never renders).
- **WebAuthn cannot be tested with real ceremonies here**: the browser rejects
  RP ID `tacukrarna.cz` on a `127.0.0.1` origin, so
  `navigator.credentials.create/get` always fail. Stub `navigator.credentials`
  instead (see `e2e/admin-webauthn.spec.ts`).
- Projects: chromium, Pixel 5, Galaxy S5. There is deliberately **no WebKit
  project** — every spec skipped webkit (zero coverage) while WebKit browser
  launches hung on the self-hosted CI runner and blocked deploys. Re-add a
  browser project only if at least one spec actually exercises it.
- Run the suite locally **before** pushing a release tag; CI failures cost a
  full ~9-minute cycle each. Read `--log-failed` output precisely:
  `- waiting for locator(...)` means the element never appeared (flow or mock
  bug), not merely a wrong assertion.
- React forms: never unmount a submit button inside its own `onClick` state
  update — the form submission gets canceled. Gate with `disabled={sending}`
  instead (see `src/app/admin/register/page.tsx`).

## Conventions

- Commits: `-s -S`, concise conventional style. Push with `--follow-tags`.
- `DEV_NOTES.md` is deliberately gitignored — never stage or commit it.
- Before committing, `git status` + `git diff --cached` to keep stray files
  (scratch scripts, notes) out; pre-commit lint-staged runs secretlint, eslint
  and prettier and will rewrite staged files.
