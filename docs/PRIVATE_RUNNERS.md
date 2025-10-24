# Private GitHub Actions Runner Setup

This guide walks you through setting up private runners for the ta-cukrarna
project on three machines for performance comparison.

## Overview

Self-hosted runners allow you to run GitHub Actions on your own machines. This
is useful for:

- Control over hardware resources
- Access to internal systems
- Specific software configurations
- Performance comparison across different platforms

> **⚠️ SECURITY WARNING**
>
> GitHub recommends using self-hosted runners only with **private
> repositories**. Public repositories can run dangerous code from forks through
> pull requests.
>
> For production use, consider:
>
> - Isolated environments (containers, VMs)
> - Limited network access
> - Regular updates and monitoring
> - Using organization-level runners with restricted access

### Performance Testing Configuration

This setup allows comparing deployment pipeline performance across:

1. **GitHub-hosted runners** (Ubuntu latest)
2. **Mac self-hosted** (M-series or Intel)
3. **VPS self-hosted** (Linux x64)
4. **NAS self-hosted** (Synology Docker)

## Prerequisites

### Personal Access Token Setup

To manage self-hosted runners, you need a Personal Access Token with appropriate
permissions.

#### Classic Personal Access Token (Recommended)

1. Go to GitHub → Settings → Developer settings → Personal access tokens →
   Tokens (classic)
2. Click "Generate new token" → "Generate new token (classic)"
3. Configure:
   - Note: `Self-hosted runners management`
   - Expiration: `No expiration` (or as preferred)
   - Scopes for **repository-level runners**:
     - ✅ `repo` (Full control of private repositories)
     - For public repositories, only `public_repo` is sufficient

   - Scopes for **organization-level runners** (if desired):
     - ✅ `admin:org` (Full control of orgs and teams)
     - ✅ `repo` (if organization has private repositories)

#### Fine-grained Personal Access Token (Beta)

1. Go to GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens
2. Click "Generate new token"
3. Configure:
   - Token name: `Self-hosted runners management`
   - Expiration: as preferred
   - Resource owner: your account
   - Repository access: "Selected repositories" → select `ta-cukrarna`
   - Repository permissions:
     - Administration: `Write` (required for self-hosted runners)
     - Actions: `Read` (for viewing runners)
     - Metadata: `Read` (basic access)

### 2. Build Docker Image

````bash
```bash
# In ta-cukrarna project
cd docker/runner
./build.sh
````

## Deployment to Individual Machines

### Machine 1: Mac (Local Development)

```bash
docker run -d --name ta-cukrarna-runner-mac \
  -e RUNNER_NAME="mac-runner" \
  -e RUNNER_TOKEN="your-github-token" \
  -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
  -e RUNNER_LABELS="mac,docker,self-hosted" \
  ta-cukrarna-runner:latest
```

### Machine 2: VPS (Production Server)

```bash
# Transfer image to VPS
docker save ta-cukrarna-runner:latest | gzip > ta-cukrarna-runner.tar.gz
scp ta-cukrarna-runner.tar.gz user@vps-server:~/
ssh user@vps-server

# On VPS
gunzip -c ta-cukrarna-runner.tar.gz | docker load

docker run -d --name ta-cukrarna-runner-vps \
  -e RUNNER_NAME="vps-runner" \
  -e RUNNER_TOKEN="your-github-token" \
  -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
  -e RUNNER_LABELS="vps,docker,self-hosted" \
  ta-cukrarna-runner:latest
```

### Machine 3: NAS (Synology HQ.lan)

```bash
# Transfer image to NAS
docker save ta-cukrarna-runner:latest | gzip > ta-cukrarna-runner.tar.gz
scp ta-cukrarna-runner.tar.gz root@HQ.lan:~/
ssh root@HQ.lan

# On NAS
gunzip -c ta-cukrarna-runner.tar.gz | docker load

docker run -d --name ta-cukrarna-runner-nas \
  -e RUNNER_NAME="nas-runner" \
  -e RUNNER_TOKEN="your-github-token" \
  -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
  -e RUNNER_LABELS="nas,docker,self-hosted" \
  ta-cukrarna-runner:latest
```

## Monitoring

### Checking Running Runners

```bash
# Logs
docker logs -f ta-cukrarna-runner-<name>

# Status
docker ps | grep ta-cukrarna-runner
```

### GitHub UI

1. Go to GitHub → ta-cukrarna → Settings → Actions → Runners
2. You should see all registered runners with their statuses

## Performance Benchmarking

### Test Workflow

To compare performance, we'll create test tags:

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

# NAS runner test
git tag v1.1.9-nas-runner
git push origin v1.1.9-nas-runner
```

### Metrics to Compare

### Metrics to Compare

1. **Total pipeline time** (start → finish)
2. **Security scan** (secretlint)
3. **Code quality** (lint, format, markdown)
4. **Build time** (npm ci + Next.js build)
5. **Deploy time** (rsync to VPS)
6. **Verification time** (curl tests)

### Results Analysis

After running on all runners, we'll compare:

- Speed of individual steps
- Parallelization vs sequential execution
- Total deployment time
- Stability and reliability

## Cleanup

```bash
# Stop and remove runners
docker stop ta-cukrarna-runner-<name>
docker rm ta-cukrarna-runner-<name>

# Remove image
docker rmi ta-cukrarna-runner:latest
```

## Optimization

Based on results, we can optimize:

- Cache strategy for faster builds
- Step parallelization
- Resource limits for containers
- Network optimization for rsync
