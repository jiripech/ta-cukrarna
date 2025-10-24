# Privátní GitHub Actions Runner Setup

Tento guide vás provede nastavením privátních runnerů pro ta-cukrarna projekt na
třech strojích pro porovnání výkonu.

## Příprava

### 1. Získání GitHub tokenu

1. Jděte na GitHub → Settings → Developer settings → Personal access tokens →
   Tokens (classic)
2. Vytvořte nový token s oprávněními:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
3. Uložte token - použijete ho v dalších krocích

### 2. Build Docker image

```bash
# V ta-cukrarna projektu
cd docker/runner
./build.sh
```

## Deployment na jednotlivé stroje

### Mac (lokální development)

```bash
docker run -d --name ta-cukrarna-runner-mac \
  -e RUNNER_NAME="mac-runner" \
  -e RUNNER_TOKEN="your-github-token" \
  -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
  -e RUNNER_LABELS="mac,docker,self-hosted" \
  ta-cukrarna-runner:latest
```

### VPS (produkční server)

```bash
# Přenos image na VPS
docker save ta-cukrarna-runner:latest | gzip > ta-cukrarna-runner.tar.gz
scp ta-cukrarna-runner.tar.gz user@vps-server:~/
ssh user@vps-server

# Na VPS
gunzip -c ta-cukrarna-runner.tar.gz | docker load

docker run -d --name ta-cukrarna-runner-vps \
  -e RUNNER_NAME="vps-runner" \
  -e RUNNER_TOKEN="your-github-token" \
  -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
  -e RUNNER_LABELS="vps,docker,self-hosted" \
  ta-cukrarna-runner:latest
```

### Třetí stroj (další testovací prostředí)

```bash
# Podobně jako VPS
docker run -d --name ta-cukrarna-runner-other \
  -e RUNNER_NAME="other-runner" \
  -e RUNNER_TOKEN="your-github-token" \
  -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
  -e RUNNER_LABELS="other,docker,self-hosted" \
  ta-cukrarna-runner:latest
```

## Monitoring

### Kontrola běžících runnerů

```bash
# Logs
docker logs -f ta-cukrarna-runner-<name>

# Status
docker ps | grep ta-cukrarna-runner
```

### GitHub UI

1. Jděte na GitHub → ta-cukrarna → Settings → Actions → Runners
2. Měli byste vidět všechny registrované runnery s jejich statusy

## Performance Benchmarking

### Testovací workflow

Pro porovnání výkonu vytvoříme testovací tags:

```bash
# GitHub hosted (current)
git tag v1.1.6-github-hosted
git push origin v1.1.6-github-hosted

# Mac runner test
git tag v1.1.7-mac-runner
git push origin v1.1.7-mac-runner

# VPS runner test
git tag v1.1.8-vps-runner
git push origin v1.1.8-vps-runner

# Other runner test
git tag v1.1.9-other-runner
git push origin v1.1.9-other-runner
```

### Metriky k porovnání

1. **Celkový čas pipeline** (start → finish)
2. **Security scan** (secretlint)
3. **Code quality** (lint, format, markdown)
4. **Build time** (npm ci + Next.js build)
5. **Deploy time** (rsync na VPS)
6. **Verification time** (curl testy)

### Analýza výsledků

Po spuštění na všech runnerech porovnáme:

- Rychlost jednotlivých kroků
- Paralelizace vs sekvenční běh
- Celkový deployment čas
- Stabilita a spolehlivost

## Cleanup

```bash
# Zastavení a smazání runnerů
docker stop ta-cukrarna-runner-<name>
docker rm ta-cukrarna-runner-<name>

# Smazání image
docker rmi ta-cukrarna-runner:latest
```

## Optimalizace

Na základě výsledků můžeme optimalizovat:

- Cache strategii pro rychlejší buildy
- Paralelizaci kroků
- Resource limity pro kontejnery
- - Network optimalizace pro rsync
