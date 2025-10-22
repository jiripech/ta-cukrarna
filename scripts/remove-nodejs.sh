#!/bin/bash

# Ta Cukrárna VPS - Remove Node.js after Static Migration
# Removes Node.js and related packages since we no longer need them
# Run as: root user

set -e

echo "🗑️  Ta Cukrárna VPS - Node.js Cleanup"
echo "===================================="
echo "👤 Running as user: $USER (UID: $EUID)"

echo "🔍 Checking current Node.js installation..."

# Check if Node.js is installed
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node -v 2>/dev/null || echo "unknown")
    echo "   Found Node.js: $NODE_VERSION"
else
    echo "   Node.js not found"
fi

# Check if npm is installed
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm -v 2>/dev/null || echo "unknown")
    echo "   Found npm: $NPM_VERSION"
else
    echo "   npm not found"
fi

# Check for global packages
echo "📦 Global npm packages:"
npm list -g --depth=0 2>/dev/null || echo "   No global packages or npm not available"

echo ""
echo "⚠️  WARNING: This will remove Node.js completely from the VPS."
echo "   Static deployment no longer needs Node.js on the server."
echo "   Build process happens in GitHub Actions."
echo ""
read -p "🔄 Continue with Node.js removal? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Node.js removal cancelled"
    exit 1
fi

echo "🛑 Removing Node.js and related packages..."

# Remove Node.js packages (different methods depending on installation)
if dpkg -l | grep -q nodejs; then
    echo "   Removing nodejs packages via apt..."
    apt remove --purge -y nodejs npm
    apt autoremove -y
    echo "   ✅ APT packages removed"
fi

# Remove NodeSource repository if present
if [ -f "/etc/apt/sources.list.d/nodesource.list" ]; then
    echo "   Removing NodeSource repository..."
    rm -f /etc/apt/sources.list.d/nodesource.list
    apt update
    echo "   ✅ NodeSource repository removed"
fi

# Clean up any remaining Node.js files
echo "🧹 Cleaning up remaining files..."

# Remove global npm directory
if [ -d "/usr/lib/node_modules" ]; then
    rm -rf /usr/lib/node_modules
    echo "   ✅ Global node_modules removed"
fi

# Remove npm cache directories
rm -rf /root/.npm 2>/dev/null || true
rm -rf /home/*/. npm 2>/dev/null || true
echo "   ✅ npm caches cleared"

# Remove Node.js binaries if they exist
rm -f /usr/bin/node /usr/bin/nodejs /usr/bin/npm /usr/bin/npx 2>/dev/null || true
echo "   ✅ Node.js binaries removed"

echo "🔍 Verification..."
if command -v node >/dev/null 2>&1; then
    echo "   ⚠️  Node.js still found: $(which node)"
    echo "   This might be from nvm or other installation method"
else
    echo "   ✅ Node.js successfully removed"
fi

if command -v npm >/dev/null 2>&1; then
    echo "   ⚠️  npm still found: $(which npm)"
else
    echo "   ✅ npm successfully removed"
fi

echo ""
echo "✅ Node.js cleanup completed!"
echo ""
echo "📋 Summary:"
echo "   • Node.js packages removed from system"
echo "   • Global modules and caches cleared"
echo "   • NodeSource repository removed (if present)"
echo "   • VPS now optimized for static hosting only"
echo ""
echo "💡 Note: If you need Node.js in the future, you can reinstall it."
echo "   The build process for ta-cukrarna happens in GitHub Actions."
echo ""
echo "🚀 VPS is now lean and optimized for static content serving!"
