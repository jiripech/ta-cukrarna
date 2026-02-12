# Ta Cukrárna - PWA Website

> Custom-made confectionery producing unique, traditional and luxurious elegant
> pastries, cakes, desserts, cookies, and sweet baked goods.

A modern Progressive Web App (PWA) for Ta Cukrárna bakery, built with Next.js
16, React 19, and TypeScript.

## 🚀 Features

- **📱 Progressive Web App** - Installable on mobile devices
- **🎨 Responsive Design** - Optimized for all screen sizes
- **⚡ Fast Performance** - Next.js 16 with Turbopack
- **🔄 Offline Support** - Service worker caching
- **🇨🇿 Czech Language** - Localized content and metadata
- **🎯 SEO Optimized** - Comprehensive meta tags
- **🍰 Bakery Focus** - Tailored for food business

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Icons & Images**: SVG + PNG assets
- **PWA**: Web App Manifest + Service Worker
- **Development**: Screen session for persistent server

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
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

### Installation

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
