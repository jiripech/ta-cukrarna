# Performance Testing Workflow for Private Runners

## Workflow Labels

Pro testování různých runnerů můžeme upravit workflow aby podporoval labels:

```yaml
# V .github/workflows/deploy.yml - přidat na začátek každého job:
runs-on:
  ${{ contains(github.ref, 'mac-runner') && 'self-hosted' ||
  contains(github.ref, 'vps-runner') && 'self-hosted' || contains(github.ref,
  'other-runner') && 'self-hosted' || 'ubuntu-latest' }}
```

Nebo vytvořit separátní workflow pro privátní runnery.

## Test Tags pro Benchmark

```bash
# GitHub hosted (baseline)
git tag v1.1.6-github-hosted && git push origin v1.1.6-github-hosted

# Mac runner
git tag v1.1.7-mac-runner && git push origin v1.1.7-mac-runner

# VPS runner
git tag v1.1.8-vps-runner && git push origin v1.1.8-vps-runner

# Other machine runner
git tag v1.1.9-other-runner && git push origin v1.1.9-other-runner
```

## Metriky k sledování

1. **Total Pipeline Time**: Start → Complete
2. **Security Job**: secretlint duration
3. **Lint Job**: ESLint + validation duration
4. **Build Job**: npm ci + Next.js build duration
5. **Deploy Job**: rsync deployment duration
6. **Verify Job**: curl tests duration
7. **Queue Time**: Waiting for runner availability

## Očekávané výsledky

- **GitHub hosted**: Nejrychlejší start (žádná queue), standardní build časy
- **Mac runner**: Rychlý build (M1/M2), pomalé network pro deploy
- **VPS runner**: Nejrychlejší deploy (localhost), pomalejší build
- **Other machine**: Závisí na HW specs a network

Po testech budeme vědět který runner je nejefektivnější pro jaký typ práce!
