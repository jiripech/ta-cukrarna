# Security Examples for Self-hosted Runners

This document shows secure patterns for using self-hosted runners.

## Repository Settings

### Required GitHub Settings

Go to `Settings → Actions → General`:

**For Public Repositories:**

1. **Fork pull request workflows from outside collaborators:**
   - ✅ "Require approval for first-time contributors"
2. **Actions permissions:** Choose one of these options (from most to least
   secure):
   - ✅ "Allow OWNER, and select non-OWNER, actions and reusable workflows" +
     specify only needed actions
   - ✅ OR "Allow actions created by GitHub" (allows `actions/*` and `github/*`
     organizations only)
   - ✅ OR "Allow Marketplace actions by verified creators"
     ([Browse verified creators](https://github.com/marketplace?type=actions&verification=verified_creator))
   - ❌ "Allow all actions and reusable workflows" (least secure, avoid if
     possible)

   **Note:** For "Allow actions by Marketplace verified creators" - this allows
   actions from creators who have been verified by GitHub. You can explore the
   verified creators marketplace when you're ready for a deep dive into
   available actions.

3. **Additional security:**
   - ✅ "Require actions to be pinned to a full-length commit SHA" (strongly
     recommended)
4. **Workflow permissions:**
   - ✅ Set "Read repository contents and packages permissions" to restrict
     default GITHUB_TOKEN access
   - ✅ Configure specific permissions in workflow files using `permissions:`
     key
   - ❌ Leave "Allow GitHub Actions to create and approve pull requests"
     unchecked (security risk)
   - 📖
     [Learn more about GITHUB_TOKEN permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token#modifying-the-permissions-for-the-github_token)

**For Private Repositories (additional setting):**

1. **Fork pull request workflows in private repositories:**
   - ✅ "Require approval for all outside collaborators"

### Branch Protection Rules

For `main` branch:

```yaml
# Settings → Branches → Add rule
- Require pull request reviews before merging: ✅
- Dismiss stale reviews when new commits are pushed: ✅
- Require review from code owners: ✅
- Require status checks to pass before merging: ✅
  - Required checks: security, lint
- Require branches to be up to date before merging: ✅
- Include administrators: ✅
```

## Workflow Security Patterns

### Pattern 1: Dual Runner Strategy

```yaml
name: Secure CI/CD

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

# 🔒 SECURITY: Define minimal permissions for GITHUB_TOKEN
permissions:
  contents: read # Allow checkout
  actions: read # Allow download artifacts

jobs:
  # ✅ SAFE: GitHub runners for PR validation
  pr-checks:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    permissions:
      contents: read # Only read access needed
    steps:
      - uses: actions/checkout@v4
      - name: Security scan
        run: npm audit
      - name: Lint code
        run: npm run lint

  # ✅ SAFE: Self-hosted only for trusted events
  deploy:
    runs-on: [self-hosted, production]
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
    permissions:
      contents: read # Read repository
      actions: read # Download artifacts
      deployments: write # Create deployment status
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: ./deploy.sh
```

### Pattern 2: Conditional Runner Selection

```yaml
jobs:
  build:
    runs-on:
      ${{ github.event_name == 'pull_request' && 'ubuntu-latest' ||
      'self-hosted' }}
    # Only use self-hosted for trusted events
    if:
      github.event_name != 'pull_request' ||
      github.event.pull_request.head.repo.full_name == github.repository
    steps:
      - uses: actions/checkout@v4
      - name: Build application
        run: npm run build
```

### Pattern 3: Environment-based Protection

```yaml
jobs:
  deploy-staging:
    runs-on: [self-hosted, staging]
    if: github.ref == 'refs/heads/main'
    environment: staging # Requires manual approval
    steps:
      - name: Deploy to staging
        run: ./deploy-staging.sh

  deploy-production:
    runs-on: [self-hosted, production]
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production # Requires manual approval + reviews
    steps:
      - name: Deploy to production
        run: ./deploy-production.sh
```

## Runner Isolation Strategies

### 1. Container-based Runners

```dockerfile
# Minimal Alpine runner with restricted permissions
FROM alpine:3.18

RUN adduser -D -s /bin/sh runner
USER runner
WORKDIR /home/runner

# Only install necessary tools
RUN apk add --no-cache git nodejs npm

# Runner with no network access to internal systems
# Use Docker networks to isolate
```

### 2. VM-based Runners

```bash
# Create isolated VM for each runner
# Reset VM state after each job
# No persistent storage
# Limited network access
```

### 3. Runner Labels for Access Control

```yaml
# Tag runners with security levels
runs-on: [self-hosted, trusted, production]  # High security
runs-on: [self-hosted, isolated, testing]    # Medium security
runs-on: ubuntu-latest                       # Public (GitHub)
```

## Network Security

### Firewall Rules for Self-hosted Runners

```bash
# Allow only necessary outbound connections
sudo ufw default deny incoming
sudo ufw default deny outgoing

# Allow GitHub API access
sudo ufw allow out 443/tcp to api.github.com
sudo ufw allow out 443/tcp to github.com

# Allow package registries
sudo ufw allow out 443/tcp to registry.npmjs.org
sudo ufw allow out 443/tcp to registry.docker.io

# Block internal network access
sudo ufw deny out to 10.0.0.0/8
sudo ufw deny out to 172.16.0.0/12
sudo ufw deny out to 192.168.0.0/16

sudo ufw enable
```

### Docker Network Isolation

```bash
# Create isolated network for runners
docker network create --driver bridge \
  --subnet=172.20.0.0/16 \
  --opt com.docker.network.bridge.enable_icc=false \
  runner-network

# Run runner in isolated network
docker run --network runner-network \
  --name secure-runner \
  ta-cukrarna-runner:latest
```

## Monitoring and Alerting

### Log Monitoring

```bash
# Monitor runner logs for suspicious activity
docker logs -f ta-cukrarna-runner-* | grep -E "(curl|wget|ssh|nc)"

# Alert on unexpected network connections
netstat -tulpn | grep docker | mail -s "Runner network activity" admin@company.com
```

### Resource Monitoring

```yaml
# GitHub Action to monitor runner resources
name: Runner Health Check

on:
  schedule:
    - cron: '*/15 * * * *' # Every 15 minutes

jobs:
  health-check:
    runs-on: [self-hosted, monitoring]
    steps:
      - name: Check disk space
        run: |
          df -h | awk '$5 > 80 {print "ALERT: " $0}'

      - name: Check memory usage
        run: |
          free -m | awk 'NR==2{printf "Memory: %s/%sMB (%.2f%%)\n", $3,$2,$3*100/$2}'
```

## Incident Response

### Runner Compromise Response

1. **Immediate Actions:**

   ```bash
   # Stop all runners
   docker stop $(docker ps -q --filter "name=ta-cukrarna-runner")

   # Remove runners from GitHub
   # Go to Settings → Actions → Runners → Remove

   # Check logs for malicious activity
   docker logs ta-cukrarna-runner-* 2>&1 | grep -E "(download|curl|wget|ssh)"
   ```

2. **Investigation:**

   ```bash
   # Check file system changes
   find /var/lib/docker -name "*runner*" -mtime -1

   # Check network connections
   netstat -tulpn | grep docker

   # Review GitHub Action logs
   # Check for unexpected workflow runs
   ```

3. **Recovery:**

   ```bash
   # Rebuild runners from scratch
   docker rmi ta-cukrarna-runner:latest
   ./build.sh

   # Rotate all secrets
   # Update GitHub Personal Access Tokens
   # Update VPS SSH keys
   ```

## Best Practices Summary

✅ **DO:**

- Use GitHub runners for all PR validation
- Require approval for external contributors
- Use environment protection rules
- Monitor runner logs and resources
- Isolate runners with containers/VMs
- Limit network access from runners
- Use conditional runner selection
- Rotate tokens and keys regularly
- Define minimal GITHUB_TOKEN permissions
- Set workflow-level and job-level permissions

❌ **DON'T:**

- Run self-hosted runners on PRs from forks
- Give runners access to internal networks
- Store secrets in runner environments
- Run multiple jobs on same runner simultaneously
- Use persistent runner storage
- Skip security scans on runner builds

---

_Remember: Security is about defense in depth. Use multiple layers of
protection._
