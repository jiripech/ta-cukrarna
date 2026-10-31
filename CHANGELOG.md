# Changelog

## v1.3.7

### Fixed

- Fixed GitHub Actions `lint-check` startup failure by checking out the
  repository before loading the local composite action
- **Playwright base URL regression** (`playwright.config.ts`): normal E2E runs
  now target the static harness at `http://127.0.0.1:3001`, while Docker E2E
  mode keeps `http://localhost/`. This prevents non-Docker suites from
  accidentally hitting port 80 and failing in CI when no Docker container is
  running.

### Changed

- Documented in `AGENTS.md` that version bumps must use
  `scripts/write-version.sh`
