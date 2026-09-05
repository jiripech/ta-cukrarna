# Development Tools Setup

## 🔧 Code Quality Tools

This project includes a complete setup for automated code quality checks.

### Markdown Linting

- **markdownlint-cli2** - checks markdown files against standard rules
- Automatically fixes what it can (e.g., spacing, formatting)
- Warns about issues such as MD031, MD022, etc.

### Code Formatting

- **Prettier** - consistent formatting for all files
- Configuration in `.prettierrc.json`
- Ignores `node_modules`, `.next`, and similar directories

### Pre-commit Hooks

- **Husky** + **lint-staged** - run checks automatically before each commit
- Only checks changed files (fast)
- Auto-fixes where possible

## 📝 Available commands

```bash
# Markdown checks
npm run lint:md
npm run lint:md:fix

# Formatting
npm run format
npm run format:check
npm run format:md

# ESLint (TypeScript/JavaScript)
npm run lint

# Full check
npm run check-all
```

## 🚀 Automatic fixes

On each `git commit`:

1. ESLint runs with auto-fix for .js/.ts/.tsx files
2. markdownlint runs with auto-fix for .md files
3. Prettier formats all files
4. Commit only proceeds if all checks pass

## 🎯 Benefits

- **Consistent quality**: All files follow the same style
- **Fewer bugs**: Automated detection of issues before commit
- **Quick fixes**: Most problems are auto-corrected
- **Clean history**: Commits contain well-formatted code

## 🔍 Resolved issues

Fixed in this update:

- MD040: All code blocks now specify the language
- MD031: Correct spacing around lists
- MD022: Proper spacing around headings
- Consistent formatting across all files

## 🧭 Preferred self-hosted runner

- To set the preferred self-hosted runner, add a repository variable
  `PREF_RUNNER` (e.g., `hq-runner-x64`) via: Repository → Settings → Actions →
  Variables.
- If `PREF_RUNNER` is set, production workflows will attempt to use it (if a
  runner with that label is online and not busy). If it is not set, workflows
  will use GitHub-hosted runners.

_Example (gh):_

```bash
# Create or update variable
gh api repos/:owner/:repo/actions/variables -f name='PREF_RUNNER' -f value='hq-runner-x64'
```

## 🧭 Preferovaný self-hosted runner

- Pro nastavení preferovaného self-hosted runneru přidejte repository variable
  `PREF_RUNNER` (např. `hq-runner-x64`) přes: Repository → Settings → Actions →
  Variables.
- Pokud je `PREF_RUNNER` nastaven, produkční workflowy jej zkusí použít (pokud
  je runner online a ne-zaneprázdněný). Pokud není nastaven, workflowy použijí
  GitHub-hosted runnery.

_Example (gh):_

```bash
# Create or update variable
gh api repos/:owner/:repo/actions/variables -f name='PREF_RUNNER' -f value='hq-runner-x64'
```

## 🏷️ Release pushes and the pre-push hook

### Hooks in this repository

- `pre-commit` (`npx lint-staged`): secretlint + eslint --fix + prettier on the
  staged files; the commit is blocked if a check fails.
- `pre-push` (`.husky/pre-push`): release-tag guard (strictly incremental
  `vX.Y.Z`) plus version-file sync for pushed release tags.

### The three pre-push outcomes for a `vX.Y.Z` tag

1. **Guard rejection** — the tag is not strictly greater than the highest
   `vX.Y.Z` tag on the remote. Push aborted. A real check failure; the message
   names the offending tag.
2. **Sync failure** — the hook tried to rewrite/commit/re-point the version
   files and something failed (reported as `✗ …`). Push aborted for inspection.
   A real failure.
3. **Sync-then-abort** — the version files on disk do not match the tag. The
   hook rewrites `package.json`, `package-lock.json` and `public/version.txt` to
   the tag's version, creates the `🔖 Sync version files to vX.Y.Z` commit on
   `main`, re-points the local tag at that commit, and then **exits 1 on
   purpose**. This is the designed behavior, not a broken check.

### Why outcome 3 aborts on purpose

`git push` resolves the OIDs it is going to send _before_ the pre-push hook
runs. Re-pointing a tag inside the hook therefore cannot change what the
in-flight push delivers: without the abort the remote would receive the stale
tag (pre-sync commit) and stale `main`, and the deployed site would show the
wrong version footer. Aborting forces a second push that carries the corrected
refs. This was verified empirically during the v1.2.2 rollout: without the abort
the remote received the old tag.

### Pattern A — tag HEAD directly (abort expected once)

```bash
git commit -s -S -m "..."
git tag -a -s vX.Y.Z -m "Release vX.Y.Z"
git push origin main --follow-tags # exits 1: sync done, tag re-pointed
git push origin main --follow-tags # identical command now succeeds
```

The first push prints
`🔖 Version sync performed during pre-push … the in-flight push carried the OLD tag, so it was aborted.`
— exit code 1 here is expected. Re-run the same push; it delivers `main` at the
sync commit and the re-pointed tag. Never bypass with `--no-verify`; a guard
rejection (outcome 1) means the tag number is wrong, not that the hook is
misbehaving.

### Pattern B — commit version files first (no abort, single push)

```bash
npm version patch --no-git-tag-version
bash ./scripts/write-version.sh X.Y.Z
git add package.json package-lock.json public/version.txt
git commit -s -S -m "🔖 Release vX.Y.Z"
git tag -a -s vX.Y.Z -m "Release vX.Y.Z"
git push origin main --follow-tags # succeeds on the first push
```

When the version files already match the tag, `sync_version_files()` returns
early, no sync commit is made, and the push goes straight through. This is the
flow `scripts/release.sh` automates and the historical v1.1.x behavior.

### Why version files must be inside the tag at all

The VPS build checks out the tag and reads `public/version.txt` / `package.json`
to render the version footer. The sync exists because `scripts/release.sh`
historically left `public/version.txt` stale (the v1.1.x footer bug), so the
hook guarantees the pushed tag always carries a version consistent with itself.

### Verifying a release landed

```bash
git rev-list -n1 vX.Y.Z # tag target (sync commit under Pattern A)
git rev-parse HEAD      # equals the tag target after Pattern A, push 2
gh run list --limit 1   # deploy run triggered by the tag push
```

### Runtime state on the VPS (excluded from rsync --delete)

The deploy runs `rsync --delete ./out/ → apps/website/`, so anything the server
creates at runtime must be listed in `.rsyncignore` or the next deploy wipes it:

- `api/DB/*.sqlite` (+ `-wal`/`-shm`) — passkeys and registration tokens.
- `opening-hours.jsonc` (docroot root) — admin-edited opening hours, JSONC
  format: comments and trailing commas are fine for hand edits (parsed
  tolerantly by `src/lib/jsonc.ts` / `jsoncDecode()`; note that an admin save
  normalizes the file back to strict JSON, so manual comments do not survive a
  save). It is never committed; on a fresh VPS create it manually, e.g.
  `{"schedule":[],"exceptions":[]}` — or call `GET /api/opening-hours.php` once
  as admin, which creates the empty file (the docblock in
  `public/api/opening-hours.php` documents the schema).

`api/DB/` is also `chmod 700` and re-initialized (`init.php`) on every deploy by
the workflow — the schema creation is idempotent, the data survives via the
rsync exclusions above.

### Service worker cache naming

`scripts/write-version.sh` (called on every dev/build) bakes the release version
into `public/sw.js`'s `CACHE_NAME` (`ta-cukrarna-vX.Y.Z`). Every release
therefore changes the SW bytes: the updated service worker activates, deletes
the previous cache and clients refetch runtime files (`/version.txt` is
network-first since v1.2.15 for the same reason). Do not revert to a static
cache name — runtime files would go stale across deploys.

### Environment (.env)

`loadEnv()` (`public/api/db.php`) reads `apps/.env` — **one level above the
docroot** (`__DIR__/../../.env` from `api/db.php`), which keeps it outside
Apache's reach. The register/mail/IMAP flow needs these keys (values live only
on the VPS):

- `MAILDB_HOST` (IMAP + MySQL host, e.g. `127.0.0.1`), `MAILDB_NAME`,
  `MAILDB_USER`, `MAILDB_PASSWORD`
- `IMAP_SERVER` — full mailbox specification for `imap_open()` in the register
  password check, e.g. `127.0.0.1:993/imap/ssl/novalidate-cert` (host, port and
  TLS flags in one value, so a server-side change is a `.env` edit rather than a
  deploy)
- optional: `MAILDB_TABLE` (default `admin`), `SMTP_FROM`

Vars already present via Apache/systemd `getenv()` take precedence; a missing
file is logged as `env_file_missing` with a `has_maildb_host` flag so the benign
case (vars provided by the service config) is distinguishable from a fully
unconfigured server. Note: the deploy's `find ... chmod 644` re-applies
read-only file permissions to `api/DB/passkeys.sqlite` on every deploy (the file
itself never ships, but the chmod hits whatever exists) — the
ownership/permission fixup below must therefore run after `init.php`, and re-run
manually if a deploy lands before the fixup step exists:
`chmod g+w apps/website/api/DB/passkeys.sqlite*` (SQLITE_READONLY on the token
insert is this exact failure).

PHP file changes take effect without a service reload (opcache revalidates by
mtime, the default `validate_timestamps=1`). If a server ever sets it to 0, a
root-only `systemctl reload php*-fpm` step must be added to the deploy — the
deploy user cannot run systemctl, so the workflow intentionally does not attempt
it.

### Ownership and permissions on the VPS

PHP (www-data) must be able to WRITE `api/DB/` (SQLite + `api-debug.log`) and
the docroot root (atomic tmp+rename of `opening-hours.jsonc`). The deploy
workflow leaves files `644` / dir `700` owned by the deploy user, so a
post-deploy step (after the `init.php` step, so the freshly created schema file
is covered) is required:

```bash
ssh $VPS_USER@$VPS_HOST "
  chown -R ta-cukrarna:www-data ./apps/website
  chmod g+s ./apps/website/api/DB        # new files inherit group www-data
  chmod -R g+rwX ./apps/website/api/DB   # group write: SQLite WAL + log
  chmod g+w ./apps/website               # group write: opening-hours.jsonc saves
"
```

Note `g+s` alone does not grant write access — the workflow's `700`/`644`
defaults leave the group read-only, hence `g+rwX`. Until this runs, the register
API fails its token insert (clean 500) and `api-debug.log` never appears,
because `logEvent()` silently no-ops when unwritable. Conversely, once group
access exists, `api/DB/.htaccess` (`Require all denied`) is what keeps
`passkeys.sqlite` and the log unreachable over HTTP — verify it after any
permission change: `ls -la apps/website/api/DB/` (dotfile!) and
`curl -I https://tacukrarna.cz/api/DB/passkeys.sqlite` must be 403/404.

## 🐞 Debug logging (api/DB/api-debug.log)

`register.php` writes a JSONL audit trail via `logEvent()` (`db.php`) into
`api/DB/api-debug.log` (web-protected by `DB/.htaccess`, 1 MiB rotation). For
IMAP/Dovecot handshake problems run the read-only probe on the VPS:
`sudo bash scripts/vps-imap-probe.sh` (no changes, dummy credentials). Events:
`request`, `rate_limited`, `request_token_parsed`, `maildb_check`,
`maildb_error`, `token_created`, `token_insert_failed`, `mail_attempt`,
`mail_result`, `mail_unavailable`, `mail_skipped_not_found`, `validate_token`,
`token_invalid`, `imap_failed`, `imap_ok`, `reset`. Tokens are logged as 8-char
prefixes only; passwords never. Read it with
`tail -n 50 apps/website/api/DB/api-debug.log` on the VPS.
