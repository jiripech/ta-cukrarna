# Ta Cukrárna - Deployment Setup

## SSH Key Setup for GitHub Actions

### 1. SSH Keys Generated
- **Private key**: `ta-cukrarna-deploy-key` (for GitHub Secrets)
- **Public key**: `ta-cukrarna-deploy-key.pub` (for VPS)

### 2. VPS Setup Instructions

#### Create dedicated user for application:
```bash
# On your VPS (Debian 12) as root or sudo user
# Create user for ta-cukrarna
sudo adduser ta-cukrarna --disabled-password --gecos "Ta Cukrarna Application User"

# Add user to www-data group for web server permissions
sudo usermod -a -G www-data ta-cukrarna

# Switch to the new user
sudo su - ta-cukrarna

# Create SSH directory and set permissions
mkdir -p ~/.ssh
chmod 700 ~/.ssh
```

#### Add public key to VPS:
```bash
# As ta-cukrarna user
cat >> ~/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOceUKQ2F/O//4D2oPMmRlD85Zllko+CywHTPDjxhW46 ta-cukrarna-github-actions
EOF

# Set proper permissions
chmod 600 ~/.ssh/authorized_keys
```

#### Install Node.js and dependencies:
```bash
# Update system (as root/sudo user)
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/ta-cukrarna
sudo chown ta-cukrarna:www-data /var/www/ta-cukrarna
sudo chmod 755 /var/www/ta-cukrarna
```

### 3. GitHub Secrets Configuration

Go to: https://github.com/jiripech/ta-cukrarna/settings/secrets/actions

Add these secrets:

#### `VPS_SSH_KEY`
```
# Copy ENTIRE content of ta-cukrarna-deploy-key (private key)
-----BEGIN OPENSSH PRIVATE KEY-----
[content here]
-----END OPENSSH PRIVATE KEY-----
```

#### `VPS_HOST`
```
your-vps-ip-address-or-domain.com
```

#### `VPS_USER`
```
ta-cukrarna
```

#### `VPS_PATH`
```
/var/www/ta-cukrarna
```

### 4. VPS Web Server Setup

#### Apache Configuration (recommended)
```bash
# Install Apache
sudo apt install apache2 -y

# Enable required modules
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod rewrite
sudo a2enmod ssl

# Create site configuration
sudo tee /etc/apache2/sites-available/ta-cukrarna.conf << 'EOF'
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    DocumentRoot /var/www/ta-cukrarna/current
    
    # Proxy to Node.js application
    ProxyPreserveHost On
    ProxyPass /.well-known/ !
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # Security headers
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/ta-cukrarna_error.log
    CustomLog ${APACHE_LOG_DIR}/ta-cukrarna_access.log combined
    
    # Static files optimization
    <LocationMatch "\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
        Header append Cache-Control "public, immutable"
    </LocationMatch>
</VirtualHost>
EOF

# Enable site and disable default
sudo a2ensite ta-cukrarna.conf
sudo a2dissite 000-default.conf

# Test configuration and restart
sudo apache2ctl configtest
sudo systemctl restart apache2
sudo systemctl enable apache2
```

#### PM2 Ecosystem for dedicated user
```bash
# As ta-cukrarna user
cat > /var/www/ta-cukrarna/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'ta-cukrarna',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/ta-cukrarna/current',
    user: 'ta-cukrarna',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/www/ta-cukrarna/logs/error.log',
    out_file: '/var/www/ta-cukrarna/logs/out.log',
    log_file: '/var/www/ta-cukrarna/logs/combined.log'
  }]
};
EOF

# Create logs directory
mkdir -p /var/www/ta-cukrarna/logs

# Start application with PM2
pm2 start ecosystem.config.js
pm2 save

# Setup PM2 startup for ta-cukrarna user
pm2 startup
# Follow the instructions shown by the command above
```

### 5. SSL Certificate (Optional)
```bash
# Install Certbot for Apache
sudo apt install certbot python3-certbot-apache -y

# Get SSL certificate
sudo certbot --apache -d your-domain.com -d www.your-domain.com

# Certbot will automatically update Apache configuration for HTTPS
# Test automatic renewal
sudo certbot renew --dry-run
```

### 6. Testing Deployment

1. **Push to main branch** triggers automatic deployment
2. **Check GitHub Actions** tab for deployment status
3. **Monitor VPS logs**: `journalctl -f` or `pm2 logs`

### 7. Manual Deployment Commands

```bash
# On VPS - manual deployment
cd /var/www/ta-cukrarna/current
git pull origin main
npm ci --only=production
npm run build
pm2 restart ta-cukrarna
```

### 8. Rollback Instructions

```bash
# List backups
ls -la /var/www/ta-cukrarna/backup-*

# Rollback to previous version
cp -r /var/www/ta-cukrarna/backup-YYYYMMDD-HHMMSS /var/www/ta-cukrarna/current
pm2 restart ta-cukrarna
```

## Security Notes

1. **Change default SSH port** (recommended)
2. **Disable password authentication** in SSH
3. **Configure firewall** (ufw)
4. **Regular security updates**
5. **Monitor logs** for suspicious activity

## Domain Configuration

Point your domain DNS A record to your VPS IP:
```
A record: @ -> your-vps-ip
A record: www -> your-vps-ip
```

## Support

- **GitHub Actions logs**: Check Actions tab in repository
- **VPS logs**: `sudo journalctl -u apache2 -f`
- **Application logs**: `pm2 logs ta-cukrarna`
- **Apache config test**: `sudo apache2ctl configtest`
- **SSL certificate status**: `sudo certbot certificates`