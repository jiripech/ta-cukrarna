# Ta Cukrárna - PWA Website

> Custom-made confectionery producing unique, traditional and luxurious elegant
> pastries, cakes, desserts, cookies, and sweet baked goods.

A modern Progressive Web App (PWA) for Ta Cukrárna bakery, built with Next.js
16, React 19, and TypeScript. Includes a lightweight PHP chatbot backend that
sends a PDF link via email with tri-lingual support.

## 🚀 Features

- **📱 Progressive Web App** - Installable on mobile devices
- **🎨 Responsive Design** - Optimized for all screen sizes
- **⚡ Fast Performance** - Next.js 16 with Turbopack
- **🔄 Offline Support** - Service worker caching
- **📧 Chatbot Email Catalog** - tri-lingual chatbot sends a PDF link via email,
  with fallback to Czech
- **🇨🇿 Czech Language** - Localized content and metadata
- **🎯 SEO Optimized** - Comprehensive meta tags
- **🍰 Bakery Focus** - Tailored for food business
- **⏰ Opening Hours** - Admin-configurable weekly schedule with date exceptions
  (holidays, special days). Stored in `public/holiday.jsonc`, editable via admin
  form at `/admin/`. Supports summer/winter schedules and exact-date exceptions
  that override the weekly schedule.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Icons & Images**: SVG + PNG assets
- **PWA**: Web App Manifest + Service Worker
- **Backend**: Simple PHP chatbot endpoint at `public/api/chatbot.php`
- **Email Config**: SMTP variables stored in `.env` for chatbot email delivery
- **Chatbot Flag**: Set `USE_CHATBOT=1` or `USE_CHATBOT=0` in `.env` and keep
  the same value in the GitHub `production` environment to include or exclude
  the chatbot from builds and E2E tests.
- **Development**: Screen session for persistent server

## 🚀 Getting Started

### Prerequisites

- Node.js 20.9+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/jiripech/ta-cukrarna.git
cd ta-cukrarna

# Install dependencies
npm install

# Start development server
npm run dev
```

### Using Screen Session (Recommended)

For persistent development server that survives terminal sessions:

```bash
# Start server in screen session
screen -S ta-cukrarna-dev -dm npm run dev

# List active sessions
screen -list

# Attach to session
screen -r ta-cukrarna-dev

# Detach from session (Ctrl+A, D)
# Server keeps running in background
```

The application will be available at
[http://localhost:3000](http://localhost:3000)

## 🐳 Docker E2E Testing

A Docker test environment with Apache + PHP 8.5 (+ msmtp for real registration
e-mails) mirrors production for E2E tests. The image contains no application
code — the app is bind-mounted at run time, so build the static export on the
host first.

```bash
# 1. Build the static export (NEXT_PUBLIC_* flags come from .env;
#    NEXT_PUBLIC_USE_ADMIN=1 is required for the admin sign-in test)
npm run build

# 2. Build the image (tiny: Apache + PHP + msmtp + entrypoint, no app inside)
scripts/docker-build.sh build

# 3. Start the container on http://localhost:80
scripts/docker-build.sh run

# 4. Run Playwright tests against the container
npm run test:e2e:docker

# 5. Stop the container
scripts/docker-build.sh stop
```

At container start the entrypoint seeds the SQLite database (schema + one
signable test passkey + a pre-inserted registration token) and starts Apache.
The client credentials land in `public/api/DB/test-credentials.json`
(gitignored) and are used by `e2e/admin-login.spec.ts` for a real
server-verified sign-in. The passkey's signature counter is reset on every
container start (and before each login test).

### Real registration flow in Docker

Copy `.env.docker.example` to `.env.docker` (gitignored) and fill in your
values; it is mounted at `/var/www/.env` (the path `loadEnv()` reads, same
layout as the VPS):

- `ADMIN_USERS=you@example.cz` — registration works without MariaDB/IMAP:
  `request-token` accepts only these addresses and `verify-password` skips the
  IMAP password proof for them.
- `SMTP_*` — the entrypoint generates `/etc/msmtprc` from them, so the
  registration e-mail is really delivered through your external mail server.
- `WEBAUTHN_RP_ID=localhost` — enables **real browser ceremonies** on
  `http://localhost` (Touch ID, Windows Hello, ...). Without it a browser cannot
  run WebAuthn against the production RP ID on a localhost origin.
- `APP_BASE_URL=http://localhost` — makes the e-mailed registration link point
  at the container instead of production.

Then open `http://localhost/admin/register/`, enter the address from
`ADMIN_USERS` and walk the flow like a real user (e-mail link → passkey
ceremony; the password step is skipped automatically when `ADMIN_USERS` covers
the user). The seeded token path skips the e-mail: the registration URL is
printed to the container log at start and stored as `registerUrl` in
`public/api/DB/test-credentials.json` (valid 24 hours; older tokens of the
seeded user are removed at container start, so a restart always yields a fresh
URL). The automated counterpart is `e2e/admin-register-docker.spec.ts` (register
with a fresh passkey → sign in with it).

> **Security**: `ADMIN_USERS` disables the IMAP password proof and
> `WEBAUTHN_RP_ID` changes the passkey binding. **Never set them in the VPS
> `.env`** — production keeps the MariaDB account check, IMAP verification and
> RP ID `tacukrarna.cz`.

## ✉️ Backend Email Configuration

The chatbot backend sends catalog links by email. For production and local
backend configuration, define these SMTP variables in `.env`:

- `SMTP_HOST` — SMTP server hostname
- `SMTP_PORT` — SMTP server port
- `SMTP_USER` — SMTP login username
- `SMTP_PASS` — SMTP login password
- `SMTP_FROM` — sender address, e.g. `"Ta Cukrárna <info@tacukrarna.cz>"`
- `USE_CHATBOT` — set to `1` to render and test the chatbot, or `0` to build and
  test the site without it

> Note: `scripts/manual-deploy.sh` intentionally excludes `SMTP_*` variables
> from export to keep email credentials private during deployment.

## 🏗️ Project Structure

```text
ta-cukrarna/
├── public/
│   ├── img/
│   │   ├── favicon.png      # PWA app icon
│   │   ├── logo.svg         # Header branding
│   │   └── header_bg.png    # Hero background
│   ├── manifest.json        # PWA manifest
│   └── sw.js               # Service worker
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout with PWA config
│   │   ├── page.tsx        # Homepage
│   │   └── globals.css     # Global styles
│   └── components/
│       └── PWARegistration.tsx
└── .copilotnotes           # Development notes
```

## 🔧 Development

### PWA Testing

1. **Chrome DevTools**: Application tab → Manifest / Service Workers
2. **Install Test**: Look for "Install Ta Cukrárna" prompt
3. **Offline Test**: Go offline and refresh - should still work

### Debug Console Errors

To save Chrome console output for debugging:

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Right-click → "Save as..." or copy output
4. Save to `log/` directory (automatically ignored by Git)

Example console log filename: `log/localhost-[timestamp].log`

### CI — preferred self-hosted runner

- To prefer a self-hosted runner for CI, set the repository variable
  `PREF_RUNNER` (e.g., `hq-runner-x64`) via: Repository → Settings → Actions →
  Variables. See `DEVELOPMENT_TOOLS.md` for details.

## 🤖 GitHub Actions Workflows

### Deployment Workflow (`deploy.yml`)

Automated deployment pipeline that runs on:

- Push to `main` branch with version tags (`v*`)
- Pull requests to `main` (lint and build only)

Pipeline stages:

1. **Security Scan** - Checks for secrets and vulnerabilities
2. **Code Quality** - Runs ESLint, HTML validation, Markdown lint, and format
   checks
3. **Build** - Creates static production build
4. **Deploy** - Deploys to VPS via rsync (tags only)
5. **Verify** - Validates deployment (tags only)

### Lint and Create Issues Workflow (`lint-and-create-issues.yml`)

Automatically creates GitHub issues for TypeScript linting warnings and errors:

- **Triggers**: Push to `main` branch or pull requests
- **Features**:
  - Runs ESLint with JSON output
  - Creates GitHub issues for each file with warnings/errors
  - Prevents duplicates by updating existing issues
  - Includes commit SHA, file name, line numbers, and rule IDs
  - Auto-applies labels: `linting`, `automated`, `bug`

Example issue format:

```markdown
## Linting warnings found in `src/app/page.tsx`

**Commit:** abc1234 **Branch:** main

### Warnings:

1. **⚠️ Warning** (Line 8:9)
   - **Rule:** `@typescript-eslint/no-unused-vars`
   - **Message:** 'isDarkMode' is assigned a value but never used.
```

### Common PWA Issues

- **Viewport warnings**: Use separate `viewport` export in layout.tsx
- **Image aspect ratios**: Add explicit `width: 'auto', height: 'auto'` styles
- **Cache updates**: Increment service worker `CACHE_NAME` version
- **Icon formats**: Use PNG for app icons, SVG for scalable graphics

## 📱 PWA Features

### PWA Installation

- Appears in Chrome's "Install app" prompt
- Works on iOS Safari with "Add to Home Screen"
- Standalone app experience

### Offline Support

- Caches essential assets (HTML, CSS, images)
- Service worker handles offline requests
- Progressive enhancement approach

### Mobile Optimization

- Apple PWA meta tags
- Theme color configuration
- Proper viewport handling
- Touch-friendly interface

## 🎨 Branding

### Colors

- **Theme**: `#000000` (black)
- **Background**: `#ffffff` (white)
- **Overlay**: `rgba(0,0,0,0.4)` (hero section)

### Typography

- **Primary Font**: Geist Sans
- **Mono Font**: Geist Mono
- **Responsive scales**: Mobile-first approach

### Images

- **Logo**: SVG format for scalability
- **Icons**: PNG format for PWA compatibility
- **Backgrounds**: High-quality photography

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm run start
```

### Deployment Platforms

- **Vercel** (recommended for Next.js)
- **Netlify**
- **Firebase Hosting**
- **Static hosting** with `npm run build && npm run export`

## 📋 Version History

### v1.0 (2025-10-22)

🎉 **First Release**

- ✅ Responsive homepage with hero section
- ✅ Professional bakery branding and copy
- ✅ Full PWA capabilities (installable, offline)
- ✅ Mobile-optimized experience
- ✅ Czech language support
- ✅ SEO optimization
- ✅ Service worker caching
- ✅ Clean, systematic Git history

## 🤝 Contributing

This project follows systematic Git practices:

1. **Feature branches** for new functionality
2. **Atomic commits** with clear messages
3. **Documentation updates** with each change
4. **Version tags** for releases

## 📄 License

Private project for Ta Cukrárna bakery.

## 🔗 Links

- **Repository**:
  [https://github.com/jiripech/ta-cukrarna](https://github.com/jiripech/ta-cukrarna)
- **Live Demo**: [Coming Soon]
- **Business**: Ta Cukrárna
