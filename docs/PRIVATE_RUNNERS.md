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
> **CRITICAL SECURITY MEASURES:**
>
> 1. **Require approval for workflow runs from forks:**
>    - Go to Settings → Actions → General
>    - Set "Fork pull request workflows" to "Require approval for first-time
>      contributors"
>    - Enable "Require approval for all outside collaborators"
> 2. **Restrict self-hosted runners for PRs:**
>    - Use
>      `if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository`
>    - This blocks self-hosted runners for external PRs
> 3. **Use GitHub-hosted runners for PR validation:**
>    - Keep self-hosted runners only for trusted pushes/tags
>    - Use GitHub runners for all PR security/lint checks
>
> For production use, also consider:
>
> - Isolated environments (containers, VMs)
> - Limited network access
> - Regular updates and monitoring
> - Using organization-level runners with restricted access

## Performance Testing Configuration

This setup allows comparing deployment pipeline performance across:

1. **GitHub-hosted runners** (Ubuntu latest)
2. **Mac self-hosted** (M-series or Intel)
3. **VPS self-hosted** (Linux x64)
4. **NAS self-hosted** (Synology Docker)

## Prerequisites

### Security Configuration

Before setting up self-hosted runners, configure repository security:

#### 1. Repository Settings

Go to GitHub → ta-cukrarna → Settings → Actions → General:

```yaml
# Recommended settings:
- Fork pull request workflows: "Require approval for first-time contributors"
- Outside collaborators: "Require approval for all outside collaborators" (private repos only)
- Actions permissions: "Allow OWNER, and select non-OWNER, actions and reusable workflows" + "Allow actions created by GitHub"
- Additional security: "Require actions to be pinned to a full-length commit SHA"
- Workflow permissions: "Read repository contents and packages permissions"
- Pull request creation: Leave "Allow GitHub Actions to create and approve pull requests" unchecked
```

#### 2. Workflow Security Patterns

Add this condition to all self-hosted runner jobs:

```yaml
jobs:
  deploy:
    runs-on: self-hosted
    # 🔒 SECURITY: Only run on trusted events (not external PRs)
    if:
      github.event_name != 'pull_request' ||
      github.event.pull_request.head.repo.full_name == github.repository
    steps:
      # ... your steps
```

#### 3. Dual Runner Strategy

Use different runners for different scenarios:

```yaml
jobs:
  # ✅ Safe: Use GitHub runners for PR validation
  security-pr:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - run: npm audit

  # ✅ Safe: Use self-hosted for trusted deployments
  deploy-prod:
    runs-on: [self-hosted, production]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - run: npm run deploy
```

### Personal Access Token Setup

To manage self-hosted runners, you need a Personal Access Token with appropriate
permissions.

#### Classic Personal Access Token (Recommended)

1. Go to GitHub → Settings → Developer settings → Personal access tokens →
   Tokens (classic)
2. Click "Generate new token" → "Generate new token (classic)"
3. Configure:
   - Note: `Self-hosted runners management`
   - Expiration: `Custom` → maximum 1 year (set calendar reminder for renewal)
   - Scopes for **public repositories**:
     - ✅ `public_repo` (Access to public repositories)
     - ✅ `read:org` (Read org membership - if needed)

   - Scopes for **private repositories**:
     - ✅ `repo` (Full control of private repositories)

   - Scopes for **organization-level runners** (if desired):
     - ✅ `admin:org` (Full control of orgs and teams)
     - ✅ `repo` (if organization has private repositories)

#### Fine-grained Personal Access Token (Beta)

1. Go to GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens
2. Click "Generate new token"
3. Configure:
   - Token name: `Self-hosted runners management`
   - Expiration: `Custom` → maximum 1 year (set calendar reminder for renewal)
   - Resource owner: your account
   - Repository access: "Selected repositories" → select `ta-cukrarna`
   - Repository permissions:
     - Actions: `Read` (for viewing runners)
     - Administration: `Read and Write` (required for self-hosted runners)
     - Metadata: `Read` (basic access - auto-added)
     - Repository security advisories: `Read` (for security scans - optional)

   ![GitHub Fine-grained Token Permissions](github-20251024_permissions.png)

### Generating Registration Token

GitHub requires a **registration token** (short-lived, ~1 hour) for runner
registration, which must be generated using your Personal Access Token.

#### Method 1: Using GitHub API (Recommended)

```bash
# Export your Personal Access Token
export GITHUB_TOKEN="your-fine-grained-pat-here"

# Generate registration token for repository
curl -L \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/jiripech/ta-cukrarna/actions/runners/registration-token

# Response will contain registration token:
# {"token":"A23AA...","expires_at":"2024-10-24T15:30:00Z"}
```

#### Method 2: Using GitHub CLI

```bash
# Login with your PAT
gh auth login --with-token < your-pat-file

# Generate registration token
gh api repos/jiripech/ta-cukrarna/actions/runners/registration-token
```

### Token Security Best Practices

> **🔒 SECURITY: Token Management**
>
> 1. **Expiration Policy:**
>    - Set maximum 1 year expiration
>    - Add calendar reminder 1 month before expiration
>    - Never use "No expiration" tokens
> 2. **Token Rotation:**
>    - When token expires, generate new one following steps above
>    - Update all runners with new token:
>
>      ```bash
>      # Stop all runners
>      docker stop ta-cukrarna-runner-mac ta-cukrarna-runner-vps ta-cukrarna-runner-nas
>      # Remove old containers
>      docker rm ta-cukrarna-runner-mac ta-cukrarna-runner-vps ta-cukrarna-runner-nas
>      # Start with new token (see deployment sections below)
>      ```
>
>    - Revoke old token immediately after successful update
>
> 3. **Token Storage:**
>    - Store securely (password manager recommended)
>    - Never commit to git or share in plain text
>    - Use environment variables for deployment scripts

### 2. Build Docker Image

```bash
# In ta-cukrarna project
cd docker/runner

# For Intel Mac / VPS / NAS (x86-64)
./build.sh

# For Apple Silicon Mac (ARM64)
./build-arm64.sh
```

## Deployment to Individual Machines

### Machine 1: Mac (Local Development)

```bash
# Create cache directories on host
mkdir -p docker/cache/{tmp,npm}

docker run -d --name ta-cukrarna-runner-mac \
  -e RUNNER_NAME="mac-runner" \
  -e RUNNER_TOKEN="your-github-token" \
  -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
  -e RUNNER_LABELS="mac,docker,self-hosted,arm64" \
  -v $(pwd)/docker/cache/tmp:/tmp \
  -v $(pwd)/docker/cache/npm:/home/runner/.npm \
  ta-cukrarna-runner:arm64
```

### Machine 2: VPS (Production Server)

```bash
# Transfer image to VPS
docker save ta-cukrarna-runner:latest | gzip > ta-cukrarna-runner.tar.gz
scp ta-cukrarna-runner.tar.gz user@vps-server:~/
ssh user@vps-server

# On VPS
gunzip -c ta-cukrarna-runner.tar.gz | docker load

# Create cache directories
mkdir -p cache/{tmp,npm}

docker run -d --name ta-cukrarna-runner-vps \
  -e RUNNER_NAME="vps-runner" \
  -e RUNNER_TOKEN="your-github-token" \
  -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
  -e RUNNER_LABELS="vps,docker,self-hosted" \
  -v $(pwd)/cache/tmp:/tmp \
  -v $(pwd)/cache/npm:/home/runner/.npm \
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

# Create cache directories
mkdir -p cache/{tmp,npm}

docker run -d --name ta-cukrarna-runner-nas \
  -e RUNNER_NAME="nas-runner" \
  -e RUNNER_TOKEN="your-github-token" \
  -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
  -e RUNNER_LABELS="nas,docker,self-hosted" \
  -v $(pwd)/cache/tmp:/tmp \
  -v $(pwd)/cache/npm:/home/runner/.npm \
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

## Troubleshooting

### Common Issues

#### 1. 404 Not Found during runner registration

**Symptoms:**

```text
Http response code: NotFound from 'POST https://api.github.com/actions/runner-registration'
Response status code does not indicate success: 404 (Not Found).
```

**Root Cause:** Using Personal Access Token instead of registration token

**Solution:**

1. Generate registration token using your PAT:

   ```bash
   ~/.local/bin/create-registration-token.sh
   ```

2. Use the short-lived registration token (not PAT) in `RUNNER_TOKEN`
   environment variable
3. Registration tokens expire in ~1 hour, regenerate as needed

#### 2. Manual config.sh works but Docker entrypoint fails

**Symptoms:** Manual `./config.sh` succeeds but automated script fails with same
404 error

**Root Cause:** Environment variable mismatch between startup script and
container

**Solution:**

- Ensure startup script uses `RUNNER_TOKEN` (not `GITHUB_TOKEN`)
- Verify registration token is fresh (not expired)
- Check token is passed correctly to container environment

#### 3. .NET Core dependency errors on ARM64

**Symptoms:**

```text
Error loading shared library ld-linux-aarch64.so.1: No such file or directory
Libicu's dependencies is missing for Dotnet Core 6.0
```

**Root Cause:** Alpine Linux lacks proper .NET Core support on ARM64

**Solution:** Use Ubuntu 22.04 base image instead of Alpine:

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y curl git nodejs npm ca-certificates sudo
```

#### 4. Runner appears offline in GitHub UI

**Check these steps:**

1. Verify container is running: `docker ps | grep runner`
2. Check container logs: `docker logs ta-cukrarna-runner-<name>`
3. Ensure registration token hasn't expired
4. Verify network connectivity to GitHub

#### 5. Performance issues

**Optimization tips:**

- Use cache volumes for `/tmp` and `~/.npm`
- Ensure adequate CPU/memory allocation
- Consider native architecture (ARM64 on M1, x86-64 on Intel)
- Monitor container resource usage: `docker stats`

### Architecture-Specific Notes

#### Ubuntu ARM64 Runner (Mac M1 Max)

- **Image size:** 1.83GB
- **Build time:** ~2-3 minutes
- **Performance:** Native ARM64 execution, optimal for M1 Max
- **Dependencies:** Full Ubuntu package ecosystem

#### Alpine x86-64 Runner (VPS/NAS)

- **Image size:** ~255MB (smaller)
- **Build time:** ~1 minute
- **Performance:** Good for Intel/AMD processors
- **Compatibility:** May have .NET Core limitations on some architectures
