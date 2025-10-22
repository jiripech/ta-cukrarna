#!/bin/bash

# Ta Cukrárna VPS - Create VirtualHost for Direct Domain Access
# Creates Apache VirtualHost to serve tacukrarna.cz directly from ~/public_html
# Run as: root user

set -e

echo "🌐 Ta Cukrárna VPS - VirtualHost Setup"
echo "======================================"
echo "👤 Running as user: $USER (UID: $EUID)"

# Domain configuration
DOMAIN="tacukrarna.cz"
USER_HOME="/home/ta-cukrarna"
PUBLIC_HTML="$USER_HOME/public_html"

echo "🔧 Creating VirtualHost for direct domain access..."
echo "   Domain: $DOMAIN"
echo "   DocumentRoot: $PUBLIC_HTML"

# Create VirtualHost configuration
cat > /etc/apache2/sites-available/ta-cukrarna.conf << 'EOF'
<VirtualHost *:80>
    ServerName tacukrarna.cz
    ServerAlias www.tacukrarna.cz
    
    DocumentRoot /home/ta-cukrarna/public_html
    
    <Directory /home/ta-cukrarna/public_html>
        AllowOverride All
        Require all granted
        Options -Indexes
    </Directory>
    
    # Security headers
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Static files optimization
    <LocationMatch "\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
        Header append Cache-Control "public, immutable"
    </LocationMatch>
    
    # Redirect to HTTPS (uncomment after SSL setup)
    # Redirect permanent / https://tacukrarna.cz/
    
    ErrorLog ${APACHE_LOG_DIR}/ta-cukrarna_error.log
    CustomLog ${APACHE_LOG_DIR}/ta-cukrarna_access.log combined
</VirtualHost>

# HTTPS VirtualHost (for SSL certificate)
<VirtualHost *:443>
    ServerName tacukrarna.cz
    ServerAlias www.tacukrarna.cz
    
    DocumentRoot /home/ta-cukrarna/public_html
    
    <Directory /home/ta-cukrarna/public_html>
        AllowOverride All
        Require all granted
        Options -Indexes
    </Directory>
    
    # SSL Configuration (will be added by Certbot)
    SSLEngine on
    # SSLCertificateFile and SSLCertificateKeyFile will be added by Certbot
    
    # Security headers
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Static files optimization
    <LocationMatch "\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
        Header append Cache-Control "public, immutable"
    </LocationMatch>
    
    ErrorLog ${APACHE_LOG_DIR}/ta-cukrarna_ssl_error.log
    CustomLog ${APACHE_LOG_DIR}/ta-cukrarna_ssl_access.log combined
</VirtualHost>
EOF

echo "✅ VirtualHost configuration created"

echo "🔧 Enabling site and configuring Apache..."

# Enable the site
a2ensite ta-cukrarna.conf

# Disable default site if enabled
a2dissite 000-default.conf 2>/dev/null || echo "   Default site already disabled"

# Enable SSL module (needed for HTTPS VirtualHost)
a2enmod ssl 2>/dev/null || echo "   SSL module already enabled"

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
echo "✅ VirtualHost setup completed!"
echo ""
echo "📋 Configuration summary:"
echo "   • VirtualHost created: $DOMAIN"
echo "   • DocumentRoot: $PUBLIC_HTML"
echo "   • HTTP VirtualHost ready"
echo "   • HTTPS VirtualHost prepared for SSL"
echo "   • Security headers configured"
echo "   • Static file optimization enabled"
echo ""
echo "🌐 Website will be available at:"
echo "   http://$DOMAIN (after DNS points to this server)"
echo ""
echo "🔒 For SSL certificate, run:"
echo "   sudo certbot --apache -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "🚀 Ready for deployment to $PUBLIC_HTML"