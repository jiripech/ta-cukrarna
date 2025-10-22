# Release Notes v1.1

## 🎉 Ta Cukrárna v1.1 - Quality & Deployment Edition

**Release Date**: 22. října 2025

### ✨ Nové funkce

#### 🔧 Development Tools & Quality Control

- **Markdown linting** s markdownlint-cli2 pro konzistentní dokumentaci
- **Prettier formátování** pro jednotný styl kódu
- **Pre-commit hooks** s Husky + lint-staged pro automatické kontroly
- **Kompletní npm scripty** pro quality control

#### 🚀 Production Deployment Ready

- **GitHub Actions CI/CD** pipeline pro automatické deployments
- **Apache web server** konfigurace s bezpečnostními hlavičkami
- **Dedikovaný uživatelský účet** setup pro VPS security
- **PM2 process manager** integrace pro stabilní provoz
- **SSL automation** s Let's Encrypt certifickáty

### 🛠️ Technické vylepšení

#### Code Quality

- Automatická oprava markdown chyb (MD031, MD022, MD040)
- Konzistentní formátování všech souborů před commitem
- ESLint + Prettier integrace pro TypeScript/JavaScript
- Lint-staged pro rychlé kontroly pouze změněných souborů

#### Deployment Infrastructure

- SSH key authentication pro bezpečné deployments
- Apache virtual host s security headers
- Dedicated `ta-cukrarna` user s omezenými oprávněními
- Comprehensive deployment dokumentace

### 📝 Dokumentace

#### Nové soubory

- `DEVELOPMENT_TOOLS.md` - Návod na použití dev tools
- `DEPLOYMENT.md` - Kompletní deployment guide pro VPS
- `.markdownlint-cli2.jsonc` - Markdown linting konfigurace
- `.prettierrc.json` - Code formatting rules

#### Aktualizované

- `README.md` - Opravené markdown formátování
- `package.json` - Nové npm scripty pro quality control
- `.github/workflows/deploy.yml` - Production-ready CI/CD

### 🎯 Npm Scripts

```bash
# Quality Control
npm run lint:md          # Kontrola markdown souborů
npm run lint:md:fix      # Auto-oprava markdown
npm run format           # Formátování všech souborů
npm run format:check     # Ověření formátování
npm run check-all        # Kompletní kontrola

# Development
npm run dev              # Development server
npm run build            # Production build
npm run start            # Production server
```

### 🔄 Migration Notes

Pro existující vývojáře:

1. **Nainstalovat nové dependencies**:

   ```bash
   npm install
   ```

2. **Inicializovat pre-commit hooks**:

   ```bash
   npm run prepare
   ```

3. **Zkontrolovat formátování**:

   ```bash
   npm run check-all
   ```

### 🚀 Deployment Checklist

Pro production deployment:

- [ ] VPS uživatel `ta-cukrarna` vytvořen
- [ ] SSH klíče nastaveny v GitHub Secrets
- [ ] Apache virtual host nakonfigurován
- [ ] PM2 ecosystem připraven
- [ ] DNS A records nastaveny
- [ ] SSL certifikáty připraveny

### 💡 Breaking Changes

Žádné breaking changes - všechny změny jsou zpětně kompatibilní.

### 🙏 Credits

- PWA foundation z v1.0
- Automated quality control system
- Production-ready deployment pipeline

---

**Upgrade z v1.0**: Jednoduché `git pull` + `npm install`

**Next version preview**: v1.2 bude zaměřena na content management a další PWA
funkce.
