#!/bin/bash

# Ta Cukrárna VPS Cleanup Script - Root Part
# Configures Apache for static hosting and removes old deployment
# Run as: sudo user or root

set -e

echo "🧹 Ta Cukrárna VPS Cleanup - Root Part"
echo "====================================="

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script should be run as root or with sudo"
    echo "   Run: sudo bash scripts/cleanup-vps-root.sh"
    exit 1
fi

echo "🔍 Checking current Apache configuration..."

# Check if old VirtualHost exists
if [ -f "/etc/apache2/sites-available/ta-cukrarna.conf" ]; then
    echo "🗑️  Removing old Apache VirtualHost..."
    a2dissite ta-cukrarna.conf 2>/dev/null || echo "   Site not enabled"
    rm -f /etc/apache2/sites-available/ta-cukrarna.conf
    echo "   ✅ Old VirtualHost removed"
else
    echo "   ℹ️  No old VirtualHost found"
fi

echo "🔧 Configuring Apache modules..."

# Disable proxy modules (no longer needed)
echo "   Disabling proxy modules..."
a2dismod proxy 2>/dev/null || echo "   proxy already disabled"
a2dismod proxy_http 2>/dev/null || echo "   proxy_http already disabled"

# Enable UserDir module
echo "   Enabling UserDir module..."
a2enmod userdir 2>/dev/null || echo "   userdir already enabled"

# Enable other useful modules for static hosting
echo "   Enabling additional modules..."
a2enmod rewrite 2>/dev/null || echo "   rewrite already enabled"
a2enmod headers 2>/dev/null || echo "   headers already enabled"
a2enmod expires 2>/dev/null || echo "   expires already enabled"

echo "🗂️  Removing old application directory..."
if [ -d "/var/www/ta-cukrarna" ]; then
    rm -rf /var/www/ta-cukrarna
    echo "   ✅ /var/www/ta-cukrarna removed"
else
    echo "   ℹ️  Directory not found"
fi

echo "🔧 Testing Apache configuration..."
if apache2ctl configtest; then
    echo "   ✅ Apache configuration is valid"
else
    echo "   ❌ Apache configuration has errors!"
    exit 1
fi

echo "🔄 Reloading Apache..."
systemctl reload apache2
echo "   ✅ Apache reloaded"

echo ""
echo "✅ Root cleanup completed!"
echo ""
echo "📋 Summary:"
echo "   • Old PM2/Node.js deployment removed"
echo "   • Apache configured for static hosting"
echo "   • UserDir module enabled"
echo "   • Proxy modules disabled"
echo "   • Ready for deployment to ~ta-cukrarna/public_html"
echo ""
echo "🌐 Website will be available at:"
echo "   http://your-domain.com/~ta-cukrarna/"
echo ""
echo "🚀 Next step: Push code to trigger GitHub Actions deployment"