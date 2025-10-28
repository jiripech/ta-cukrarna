# Copilot Instructions for Ta Cukrárna

## Project Overview

- **Type**: Static PWA for a Czech bakery, built with Next.js 16, React 19,
  TypeScript, and Tailwind CSS v4.
- **Purpose**: Fast, installable, offline-capable site with bakery branding and
  Czech localization.
- **Structure**: All app logic in `src/`, static assets in `public/`, deployment
  scripts in `scripts/`, and CI/CD in `.github/workflows/`.

## Key Architecture & Patterns

- **App Router**: Uses Next.js 16 App Router (`src/app/`).
- **PWA**: Service worker (`public/sw.js`) and manifest (`public/manifest.json`)
  enable install/offline features. Register via `PWARegistration.tsx`.
- **Sections**: Homepage and content split into modular React components in
  `src/components/sections/`.
- **Styling**: Tailwind CSS v4, configured in `postcss.config.mjs` and
  `globals.css`.
- **Branding**: SVG for logos, PNG for icons. Colors and fonts defined in README
  and CSS.

## Developer Workflows

- **Dev Server**: `npm run dev` (use `screen` for persistent sessions).
- **Build**: `npm run build` → outputs to `out/` for static deployment.
- **Lint/Format**: `npm run lint`, `npm run format:check`, plus
  secret/HTML/Markdown checks (`lint:secrets`, `lint:html`, `lint:md`).
- **Release**: Tag a commit (`v*`) to trigger GitHub Actions deployment to VPS.
  See `.github/workflows/deploy.yml`.
- **Manual Deploy**: Use `rsync` to `~/public_html` on VPS if needed (see
  DEPLOYMENT.md).

## CI/CD & Deployment

- **Static Only**: No Node.js runtime on VPS; all builds are static.
- **GitHub Actions**: Security scan, lint, build, deploy, verify, and cleanup
  jobs. SSH key and VPS details in repo secrets.
- **Rollback**: Restore from `public_html-backup-*` on VPS (see DEPLOYMENT.md).

## Conventions & Gotchas

- **Viewport**: Export viewport config separately in `layout.tsx` to avoid PWA
  warnings.
- **Image Sizing**: Always set `width: auto; height: auto` for images to avoid
  aspect ratio issues.
- **Service Worker**: Bump `CACHE_NAME` in `sw.js` to force cache updates.
- **Feature Branches**: Use atomic commits and update docs with each change.
- **Logs**: Save browser console logs to `log/` for debugging (ignored by Git).

## External Integrations

- **Vercel/Netlify/Firebase**: Supported for static hosting, but main deployment
  is to custom VPS via GitHub Actions.
- **Apache**: VPS serves static files from `~/public_html` (see DEPLOYMENT.md
  for config).

## Example File References

- `src/app/layout.tsx`: Root layout, PWA config, viewport export.
- `public/manifest.json`: PWA manifest.
- `public/sw.js`: Service worker logic.
- `src/components/PWARegistration.tsx`: Registers service worker.
- `.github/workflows/deploy.yml`: CI/CD pipeline.
- `DEPLOYMENT.md`: VPS setup, manual deploy, rollback.

---

**For new agents:**

- Always check README.md and DEPLOYMENT.md for current conventions.
- Follow atomic commit and feature branch workflow.
- Use provided scripts for linting, formatting, and deployment.
- Reference `.github/workflows/` for CI/CD logic and secrets.

---

_Update this file if project structure or workflows change. Ask for feedback if
any section is unclear or incomplete._
