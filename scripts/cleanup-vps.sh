#!/bin/bash

# Ta Cukrárna VPS Cleanup Script - User Part
# Removes PM2 processes and prepares user directory for static hosting
# Run as: ta-cukrarna user

set -e

echo "🧹 Ta Cukrárna VPS Cleanup - User Part"
echo "====================================="

# Check if running as ta-cukrarna user
if [ "$USER" != "ta-cukrarna" ]; then
    echo "❌ This script should be run as 'ta-cukrarna' user"
    echo "   Switch user: sudo su - ta-cukrarna"
    exit 1
fi

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
echo "📝 Please run this command as sudo user to remove PM2 startup:"
pm2 unstartup 2>/dev/null || echo "   No startup configuration found"

echo ""
echo "🏠 Creating public_html directory..."
mkdir -p ~/public_html
chmod 755 ~/public_html

echo ""
echo "✅ User cleanup completed!"
echo ""
echo "🔄 Next step: Run as sudo user:"
echo "   bash scripts/cleanup-vps-root.sh"