#!/bin/bash

# Ta Cukrárna VPS Cleanup Script - User Part
# Removes PM2 processes and prepares user directory for static hosting
# Run in terminal as: ta-cukrarna user

set -e

echo "🧹 Ta Cukrárna VPS Cleanup - User Part"
echo "====================================="
echo "👤 Running as user: $USER"

echo "📋 Current PM2 processes:"
pm2 list 2>/dev/null || echo "   No PM2 processes found"

echo ""
read -p "🔄 Continue with PM2 cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

echo "🛑 Stopping PM2 processes..."
pm2 stop all 2>/dev/null || echo "   No processes to stop"

echo "🗑️  Deleting PM2 processes..."
pm2 delete all 2>/dev/null || echo "   No processes to delete"

echo "💀 Killing PM2 daemon..."
pm2 kill 2>/dev/null || echo "   PM2 daemon not running"

echo "🔧 Getting PM2 unstartup command..."
echo "📝 Copy this command and run it in your root terminal:"
echo "=================================================="
pm2 unstartup 2>/dev/null || echo "   No startup configuration found"
echo "=================================================="

echo ""
echo "🏠 Creating public_html directory..."
mkdir -p ~/public_html
chmod 755 ~/public_html

echo ""
echo "✅ User cleanup completed!"
echo ""
echo "🔄 Now run cleanup-vps-root.sh in your root terminal"
