# Development Tools Setup

## 🔧 Nástroje pro kvalitu kódu

Tento projekt nyní obsahuje kompletní setup pro automatickou kontrolu kvality
kódu:

### Markdown Linting

- **markdownlint-cli2** - kontroluje markdown soubory podle standardních
  pravidel
- Automaticky opravuje co se dá (např. mezery, formátování)
- Varuje před problémy jako MD031, MD022 atd.

### Code Formatting

- **Prettier** - jednotné formátování všech souborů
- Konfigurace v `.prettierrc.json`
- Ignoruje `node_modules`, `.next` atd.

### Pre-commit Hooks

- **Husky** + **lint-staged** - automatické spuštění před každým commitem
- Kontroluje pouze změněné soubory (rychlé)
- Automaticky opravuje co se dá

## 📝 Dostupné příkazy

```bash
# Kontrola markdown souborů
npm run lint:md
npm run lint:md:fix

# Formátování souborů
npm run format
npm run format:check
npm run format:md

# ESLint (TypeScript/JavaScript)
npm run lint

# Kompletní kontrola
npm run check-all
```

## 🚀 Automatické opravy

Při každém `git commit` se automaticky:

1. Spustí ESLint s auto-fix na .js/.ts/.tsx soubory
2. Spustí markdownlint s auto-fix na .md soubory
3. Zformátuje všechny soubory pomocí Prettier
4. Commitne pouze pokud vše prošlo

## 🎯 Výhody

- **Konzistentní kvalita**: Všechny soubory mají jednotný styl
- **Méně chyb**: Automatická detekce problémů před commitem
- **Rychlé opravy**: Většina problémů se opraví automaticky
- **Čistá historie**: Commity obsahují pouze správně formátovaný kód

## 🔍 Resolved Issues

Opraveno v této aktualizaci:

- MD040: Všechny code blocky nyní mají specifikovaný jazyk
- MD031: Správné mezery okolo seznamů
- MD022: Správné mezery okolo headingů
- Konzistentní formátování napříč všemi soubory

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
