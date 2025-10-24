#!/bin/bash
set -e

# GitHub Actions Runner Entrypoint
# This script configures and starts the runner

echo "🚀 Starting GitHub Actions Runner for ta-cukrarna"
echo "=================================================="

# Validate required environment variables
if [[ -z "$RUNNER_NAME" ]]; then
    echo "❌ Error: RUNNER_NAME environment variable is required"
    exit 1
fi

if [[ -z "$RUNNER_TOKEN" ]]; then
    echo "❌ Error: RUNNER_TOKEN environment variable is required"
    exit 1
fi

if [[ -z "$RUNNER_REPOSITORY" ]]; then
    echo "❌ Error: RUNNER_REPOSITORY environment variable is required"
    exit 1
fi

# Configure GitHub API URL (default to github.com)
GITHUB_URL="${GITHUB_URL:-https://github.com}"
RUNNER_URL="${GITHUB_URL}/${RUNNER_REPOSITORY}"

echo "🔧 Configuring runner..."
echo "   Name: $RUNNER_NAME"
echo "   Repository: $RUNNER_REPOSITORY"
echo "   Labels: ${RUNNER_LABELS:-docker,self-hosted}"

cd /home/runner

# Remove any existing runner configuration
if [ -f .runner ]; then
    echo "🧹 Removing existing runner configuration..."
    ./config.sh remove --token "$RUNNER_TOKEN" || true
fi

# Configure the runner
./config.sh \
    --url "$RUNNER_URL" \
    --token "$RUNNER_TOKEN" \
    --name "$RUNNER_NAME" \
    --labels "${RUNNER_LABELS:-docker,self-hosted}" \
    --work "_work" \
    --replace \
    --unattended

echo "✅ Runner configured successfully!"

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down runner..."
    ./config.sh remove --token "$RUNNER_TOKEN" || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

echo "🏃 Starting runner..."
exec ./run.sh
