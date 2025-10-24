#!/bin/bash
# Build script for GitHub Actions Runner Docker image

set -e

echo "🐳 Building ta-cukrarna GitHub Actions Runner Docker image"
echo "=========================================================="

# Build the Docker image
docker build \
    --tag ta-cukrarna-runner:latest \
    --file Dockerfile \
    .

echo ""
echo "✅ Docker image built successfully!"
echo ""
echo "🚀 Usage examples:"
echo ""
echo "1. Run on Mac (development):"
echo "   docker run -d --name ta-cukrarna-runner-mac \\"
echo "     -e RUNNER_NAME=\"mac-runner\" \\"
echo "     -e RUNNER_TOKEN=\"your-github-token\" \\"
echo "     -e RUNNER_REPOSITORY=\"jiripech/ta-cukrarna\" \\"
echo "     -e RUNNER_LABELS=\"mac,docker,self-hosted\" \\"
echo "     ta-cukrarna-runner:latest"
echo ""
echo "2. Run on VPS:"
echo "   docker run -d --name ta-cukrarna-runner-vps \\"
echo "     -e RUNNER_NAME=\"vps-runner\" \\"
echo "     -e RUNNER_TOKEN=\"your-github-token\" \\"
echo "     -e RUNNER_REPOSITORY=\"jiripech/ta-cukrarna\" \\"
echo "     -e RUNNER_LABELS=\"vps,docker,self-hosted\" \\"
echo "     ta-cukrarna-runner:latest"
echo ""
echo "3. Run on other machine:"
echo "   docker run -d --name ta-cukrarna-runner-other \\"
echo "     -e RUNNER_NAME=\"other-runner\" \\"
echo "     -e RUNNER_TOKEN=\"your-github-token\" \\"
echo "     -e RUNNER_REPOSITORY=\"jiripech/ta-cukrarna\" \\"
echo "     -e RUNNER_LABELS=\"other,docker,self-hosted\" \\"
echo "     ta-cukrarna-runner:latest"
echo ""
echo "📊 To get a GitHub token:"
echo "   Settings → Developer settings → Personal access tokens → Tokens (classic)"
echo "   Required scopes: repo, workflow"
echo ""
echo "🔍 Monitor logs:"
echo "   docker logs -f ta-cukrarna-runner-<name>"
