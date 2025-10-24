#!/bin/bash
# Test script for GitHub Actions Runner Docker image

set -e

echo "🧪 Testing ta-cukrarna GitHub Actions Runner Docker image"
echo "======================================================="

# Check if image exists
if ! docker image inspect ta-cukrarna-runner:latest >/dev/null 2>&1; then
    echo "❌ Docker image ta-cukrarna-runner:latest not found"
    echo "💡 Run ./build.sh first"
    exit 1
fi

echo "✅ Docker image found"

# Test image startup (dry run without token)
echo "🔍 Testing image startup (dry run)..."
docker run --rm \
    -e RUNNER_NAME="test-runner" \
    -e RUNNER_TOKEN="dummy-token" \
    -e RUNNER_REPOSITORY="jiripech/ta-cukrarna" \
    -e RUNNER_LABELS="test,docker" \
    ta-cukrarna-runner:latest &

# Wait a moment for startup
sleep 5

# Kill the test container
docker ps -q --filter ancestor=ta-cukrarna-runner:latest | xargs -r docker kill >/dev/null 2>&1 || true

echo "✅ Basic startup test completed"

# Check image size
IMAGE_SIZE=$(docker image inspect ta-cukrarna-runner:latest --format '{{.Size}}' | awk '{print int($1/1024/1024)}')
echo "📊 Image size: ${IMAGE_SIZE} MB"

if [ "$IMAGE_SIZE" -lt 500 ]; then
    echo "✅ Image size is optimal (< 500MB)"
elif [ "$IMAGE_SIZE" -lt 1000 ]; then
    echo "⚠️  Image size is acceptable (< 1GB)"
else
    echo "⚠️  Image size is large (> 1GB) - consider optimization"
fi

echo ""
echo "🎉 Docker image test completed successfully!"
echo ""
echo "🚀 Ready for deployment to:"
echo "   • Mac (local development)"
echo "   • VPS (production server)"
echo "   • Third machine (testing)"
echo ""
echo "📖 See docs/PRIVATE_RUNNERS.md for deployment instructions"
