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
