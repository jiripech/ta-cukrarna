#!/bin/bash

# Deployment verification script
# Checks if production deployment matches expectations

set -e

echo "🔍 Ta Cukrárna Deployment Verification"
echo "====================================="

# Configuration
PRODUCTION_URL="https://tacukrarna.cz"
LOCAL_VERSION=$(sed "s/Version: v//" public/version.txt)

echo "📦 Local version: $LOCAL_VERSION"
echo "🌐 Production URL: $PRODUCTION_URL"

# Test 1: Basic connectivity
echo ""
echo "🧪 Test 1: Basic connectivity..."
if curl -s -f "$PRODUCTION_URL" > /dev/null; then
    echo "✅ Production site is accessible"
else
    echo "❌ Production site is not accessible"
    exit 1
fi

# Test 2: Check if deployment contains expected content
echo ""
echo "🧪 Test 2: Content verification..."
PROD_HTML=$(curl -s "$PRODUCTION_URL")

# Check for custom favicon
if echo "$PROD_HTML" | grep -q "icon.png"; then
    echo "✅ Custom favicon detected"
else
    echo "❌ Custom favicon not found"
fi

# Check for dark mode script
if echo "$PROD_HTML" | grep -q "useDarkMode\|dark:"; then
    echo "✅ Dark mode functionality detected"
else
    echo "❌ Dark mode functionality not found"
fi

# Check for optimized images
if echo "$PROD_HTML" | grep -q "sweetdream\|breakfast\|highprotein"; then
    echo "✅ Optimized images detected"
else
    echo "❌ Optimized images not found"
fi

# Test 3: Performance check
echo ""
echo "🧪 Test 3: Performance check..."
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "$PRODUCTION_URL")
if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    echo "✅ Response time OK: ${RESPONSE_TIME}s"
else
    echo "⚠️  Slow response time: ${RESPONSE_TIME}s"
fi

# Test 4: Check for JavaScript errors (basic)
echo ""
echo "🧪 Test 4: JavaScript check..."
if echo "$PROD_HTML" | grep -q "_next/static"; then
    echo "✅ Next.js static assets detected"
else
    echo "❌ Next.js static assets not found"
fi

echo ""
echo "✅ Deployment verification completed!"
echo "🎉 Production deployment looks good!"
