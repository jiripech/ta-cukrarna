# Ta Cukrárna - Deployment Setup

## SSH Key Setup for GitHub Actions

### 1. SSH Keys Generated

- **Private key**: `ta-cukrarna-deploy-key` (for GitHub Secrets)
- **Public key**: `ta-cukrarna-deploy-key.pub` (for VPS)

### 2. VPS Setup Instructions

#### Create dedicated user for application

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

#### Add public key to VPS

```bash
# As ta-cukrarna user
cat >> ~/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOceUKQ2F/O//4D2oPMmRlD85Zllko+CywHTPDjxhW46 ta-cukrarna-github-actions
EOF

# Set proper permissions
chmod 600 ~/.ssh/authorized_keys
```

#### Install Node.js and dependencies (Node 20 required)

We now require Node.js >= 20.9.0 (Next.js 16 and several deps need Node 20+).
Use the Nodesource installer or nvm.

**Option A — Install Node 20 from Nodesource (system-wide):**

```bash
# Update system (as root/sudo user)
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (Nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v  # should be v20.x
npm -v

# Install PM2 globally
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/ta-cukrarna
sudo chown ta-cukrarna:www-data /var/www/ta-cukrarna
sudo chmod 755 /var/www/ta-cukrarna
```

**Option B — Install Node 20 using nvm (per-user, safe):**

```bash
# Install nvm (if not present)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node 20 and set default
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node -v
npm -v

# Install PM2 globally for the user (if desired)
npm install -g pm2

# Create application directory
mkdir -p /var/www/ta-cukrarna
sudo chown ta-cukrarna:www-data /var/www/ta-cukrarna
sudo chmod 755 /var/www/ta-cukrarna
```

### 3. GitHub Secrets Configuration

Go to: <https://github.com/jiripech/ta-cukrarna/settings/secrets/actions>

Add these secrets:

#### `VPS_SSH_KEY`

```text
# Copy ENTIRE content of ta-cukrarna-deploy-key (private key)
-----BEGIN OPENSSH PRIVATE KEY-----
[content here]
-----END OPENSSH PRIVATE KEY-----
```

#### `VPS_HOST`

```text
your-vps-ip-address-or-domain.com
```

#### `VPS_USER`

```text
ta-cukrarna
```

#### `VPS_PATH`

```text
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
sudo a2enmod headers
sudo a2enmod expires

# Create site configuration
sudo tee /etc/apache2/sites-available/ta-cukrarna.conf << 'EOF'
# HTTP VirtualHost - redirects to HTTPS
<VirtualHost *:80>
    ServerName tacukrarna.cz
    ServerAlias www.tacukrarna.cz
    DocumentRoot /var/www/ta-cukrarna/current

    # Allow Let's Encrypt challenges
    ProxyPass /.well-known/ !

    # Redirect all other traffic to HTTPS
    Redirect permanent / https://tacukrarna.cz/

    # Logging
    ErrorLog ${APACHE_LOG_DIR}/ta-cukrarna_error.log
    CustomLog ${APACHE_LOG_DIR}/ta-cukrarna_access.log combined
</VirtualHost>

# HTTPS VirtualHost - main configuration
<VirtualHost *:443>
    ServerName tacukrarna.cz
    ServerAlias www.tacukrarna.cz
    DocumentRoot /var/www/ta-cukrarna/current

    # SSL Configuration (will be auto-configured by Certbot)
    SSLEngine on
    # SSLCertificateFile and SSLCertificateKeyFile will be added by Certbot

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
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Logging
    ErrorLog ${APACHE_LOG_DIR}/ta-cukrarna_ssl_error.log
    CustomLog ${APACHE_LOG_DIR}/ta-cukrarna_ssl_access.log combined

    # Static files optimization
    <LocationMatch "\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
        Header append Cache-Control "public, immutable"
    </LocationMatch>
</VirtualHost>
EOF

# Set global security directives (outside VirtualHost)
# Note: If you already have ServerTokens/ServerSignature in global config, skip this:
sudo tee /etc/apache2/conf-available/security-headers.conf << 'EOF'
# Global security settings (only if not already configured)
ServerTokens Prod
ServerSignature Off
EOF

# Enable security configuration (only if created above)
sudo a2enconf security-headers

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

# Start application with PM2 (will be done by deployment, but for initial setup)
# pm2 start ecosystem.config.js
# pm2 save

# Setup PM2 startup for ta-cukrarna user (IMPORTANT)
pm2 startup
# This will show a command like:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ta-cukrarna --hp /home/ta-cukrarna
# Copy and run that command as root/sudo user

# After first deployment, save PM2 process list
# pm2 save
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

**Note**: The deployment process installs all dependencies (including
devDependencies like TypeScript, Tailwind, Husky) on the VPS because they're
needed for the build process. After build completes, these dev tools remain
available but don't affect production runtime.

### 7. Manual Deployment Commands

```bash
# Manual deployment is NOT needed with GitHub Actions
# But if you need to manually deploy for debugging:

# Option A: Trigger GitHub Actions deployment
# Just push to main branch - this is the recommended way

# Option B: Manual rsync from local machine (for emergency)
# From your local development machine:
rsync -avz --delete --exclude 'node_modules' --exclude '.git' --exclude '.next' -e "ssh -o StrictHostKeyChecking=no" ./ ta-cukrarna@revofab:/var/www/ta-cukrarna/current/

# Then on VPS:
ssh ta-cukrarna@your-vps-ip
cd /var/www/ta-cukrarna/current
npm ci --only=production
npm run build
pm2 restart ta-cukrarna

# Option C: Manual file upload and build (emergency only)
# Upload files manually, then on VPS:
cd /var/www/ta-cukrarna/current
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

### PM2 Security Best Practices

1. **Keep PM2 updated**: `sudo npm update -g pm2`
2. **Run as dedicated user**: We use `ta-cukrarna` user (non-root)
3. **Disable PM2 web interface**: Don't expose PM2 Plus/Keymetrics in production
4. **Monitor process limits**: Set memory/CPU limits in ecosystem.config.js
5. **Regular security audits**: `npm audit` on dependencies

### General VPS Security

1. **Change default SSH port** (recommended)
2. **Disable password authentication** in SSH
3. **Configure firewall** (ufw)
4. **Regular security updates**: `sudo apt update && sudo apt upgrade`
5. **Monitor logs** for suspicious activity
6. **Use fail2ban** for SSH brute force protection

### PM2 Security Configuration

```bash
# Disable PM2 web interface (if accidentally enabled)
pm2 set pm2:web-interface false

# Set process limits in ecosystem.config.js (already configured)
# max_memory_restart: '1G' prevents memory leaks
# instances: 1 limits resource usage

# Monitor PM2 security
pm2 monit  # Check resource usage
pm2 logs   # Monitor for errors/attacks
```

### Optional: Install fail2ban for SSH protection

```bash
# Install fail2ban
sudo apt install fail2ban -y

# Create custom jail for SSH
sudo tee /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
EOF

# Start and enable fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status sshd
```

## Boot Sequence & Dependencies

PM2 will automatically start after Apache thanks to the startup script:

```bash
# Check PM2 service status
sudo systemctl status pm2-ta-cukrarna

# PM2 service should start after network and apache2
# This is configured automatically by pm2 startup command

# Verify boot sequence:
# 1. Apache2 starts first (port 80/443)
# 2. PM2 starts ta-cukrarna app (port 3000)
# 3. Apache proxies requests to Node.js app
```

## Domain Configuration

Point your domain DNS A record to your VPS IP:

```text
A record: @ -> your-vps-ip
A record: www -> your-vps-ip
```

## Support

- **GitHub Actions logs**: Check Actions tab in repository
- **VPS logs**: `sudo journalctl -u apache2 -f`
- **Application logs**: `pm2 logs ta-cukrarna`
- **Apache config test**: `sudo apache2ctl configtest`
- **SSL certificate status**: `sudo certbot certificates`
