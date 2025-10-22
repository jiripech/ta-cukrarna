#!/bin/bash

# Ta Cukrárna VPS - Fix UserDir Configuration
# Updates UserDir configuration to work with static files
# Run as: root user

set -e

echo "🔧 Ta Cukrárna VPS - UserDir Configuration Fix"
echo "=============================================="
echo "👤 Running as user: $USER (UID: $EUID)"

echo "📋 Current UserDir configuration:"
cat /etc/apache2/mods-enabled/userdir.conf

echo ""
echo "🔧 Updating UserDir configuration..."

# Backup current configuration
cp /etc/apache2/mods-enabled/userdir.conf /etc/apache2/mods-enabled/userdir.conf.backup

# Create updated configuration
cat > /etc/apache2/mods-enabled/userdir.conf << 'EOF'
<IfModule mod_userdir.c>
	UserDir public_html
	UserDir disabled root

	<Directory /home/*/public_html>
		AllowOverride FileInfo AuthConfig Limit Indexes
		Options MultiViews Indexes SymLinksIfOwnerMatch IncludesNoExec
		Require method GET HEAD POST OPTIONS
		DirectoryIndex index.html index.htm
	</Directory>
</IfModule>
EOF

echo "✅ UserDir configuration updated"

echo "📋 New configuration:"
cat /etc/apache2/mods-enabled/userdir.conf

echo "🔧 Testing Apache configuration..."
if apache2ctl configtest; then
    echo "   ✅ Apache configuration is valid"
else
    echo "   ❌ Apache configuration has errors!"
    echo "   Restoring backup..."
    mv /etc/apache2/mods-enabled/userdir.conf.backup /etc/apache2/mods-enabled/userdir.conf
    exit 1
fi

echo "🔄 Reloading Apache..."
systemctl reload apache2
echo "   ✅ Apache reloaded"

echo ""
echo "✅ UserDir configuration fix completed!"
echo ""
echo "📋 Changes made:"
echo "   • Added HEAD method support"
echo "   • Added DirectoryIndex for index.html"
echo "   • Backup saved as userdir.conf.backup"
echo ""
echo "🧪 Test commands:"
echo "   curl -I http://localhost/~ta-cukrarna/"
echo "   curl -I http://yourdomain.com/~ta-cukrarna/"