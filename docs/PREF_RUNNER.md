# PREF_RUNNER — Preferred self-hosted runner

This document explains how to configure the preferred self‑hosted runner for CI
workflows.

## What it does

- If you set the repository variable `PREF_RUNNER` to a runner label (for
  example `hq-runner-x64`), the production workflows will probe the GitHub
  Actions API for an **online** and **not busy** runner with that label and
  prefer it.
- If `PREF_RUNNER` is not set or is empty, the workflows will **not** attempt to
  use any self-hosted runner and will use **GitHub-hosted** runners instead.

## How to set it

- GitHub UI: Repository → Settings → Actions → Variables → **New repository
  variable**
  - Name: `PREF_RUNNER`
  - Value: `hq-runner-x64`
- CLI example (gh):

```bash
gh api repos/:owner/:repo/actions/variables -f name='PREF_RUNNER' -f value='hq-runner-x64'
```

## Important notes

- Use a _repository variable_ (not a secret) — the label is not sensitive data.
- This configuration stops workflows from falling back to any hard-coded runner
  label — which matches the requested behavior.
- If you want to temporarily test a different runner, use the manual
  `Check self-hosted runner` workflow and provide a `label` input.

---
