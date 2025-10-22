# Ta Cukrárna - Static Deployment Setup

## SSH Key Setup for GitHub Actions

### 1. SSH Keys Generated

- **Private key**: `ta-cukrarna-deploy-key` (for GitHub Secrets)
- **Public key**: `ta-cukrarna-deploy-key.pub` (for VPS)

## Cleanup from Previous PM2 Deployment

If you previously had PM2/Node.js setup, clean it up before using static
deployment:

```bash
# Stop and remove PM2 processes
pm2 stop all
pm2 delete all
pm2 kill

# Remove PM2 startup service
pm2 unstartup
# This will show a command to run as sudo, execute it

# Remove PM2 globally (optional)
sudo npm uninstall -g pm2

# Remove old application directory
sudo rm -rf /var/www/ta-cukrarna

# Remove old Apache VirtualHost if it exists
sudo a2dissite ta-cukrarna.conf
sudo rm -f /etc/apache2/sites-available/ta-cukrarna.conf

# Remove proxy modules (no longer needed)
sudo a2dismod proxy
sudo a2dismod proxy_http

# Test Apache configuration
sudo apache2ctl configtest
sudo systemctl reload apache2

# Optional: Remove Node.js entirely if not used elsewhere
# sudo apt remove nodejs npm
# sudo apt autoremove
```

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

# Create public_html directory for static files
mkdir -p ~/public_html
chmod 755 ~/public_html
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

#### No Node.js installation needed

Since we're deploying static files, Node.js is only needed for the build process
on GitHub Actions runners, not on the VPS itself.

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

**Note**: VPS_PATH is no longer needed as we deploy to ~/public_html

### 4. VPS Web Server Setup

#### Apache Configuration with UserDir

```bash
# Install Apache
sudo apt install apache2 -y

# Enable UserDir module for serving user directories
sudo a2enmod userdir
sudo a2enmod rewrite
sudo a2enmod ssl
sudo a2enmod headers
sudo a2enmod expires

# Verify UserDir configuration
sudo nano /etc/apache2/mods-enabled/userdir.conf
```

Make sure the UserDir configuration allows serving from public_html:

```apache
<IfModule mod_userdir.c>
    UserDir public_html
    UserDir disabled root

    <Directory /home/*/public_html>
        AllowOverride FileInfo AuthConfig Limit Indexes
        Options MultiViews Indexes SymLinksIfOwnerMatch IncludesNoExec
        Require method GET HEAD POST OPTIONS
    </Directory>
</IfModule>
```

The website will be available at: `http://yourdomain.com/~ta-cukrarna/`

#### Optional: Create custom VirtualHost for direct domain access

```bash
sudo nano /etc/apache2/sites-available/ta-cukrarna.conf
```

Add configuration:

```apache
<VirtualHost *:80>
    ServerName tacukrarna.cz
    ServerAlias www.tacukrarna.cz

    DocumentRoot /home/ta-cukrarna/public_html

    <Directory /home/ta-cukrarna/public_html>
        AllowOverride All
        Require all granted
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

    ErrorLog ${APACHE_LOG_DIR}/ta-cukrarna_error.log
    CustomLog ${APACHE_LOG_DIR}/ta-cukrarna_access.log combined
</VirtualHost>
```

Enable the site:

````bash
sudo a2ensite ta-cukrarna.conf
sudo a2dissite 000-default.conf
sudo systemctl reload apache2
```### 5. SSL Certificate (Optional)

```bash
# Install Certbot for Apache
sudo apt install certbot python3-certbot-apache -y

# Get SSL certificate
sudo certbot --apache -d your-domain.com -d www.your-domain.com

# Certbot will automatically update Apache configuration for HTTPS
# Test automatic renewal
sudo certbot renew --dry-run
````

### 6. Testing Static Deployment

1. **Push to main branch** triggers automatic static site generation and
   deployment
2. **Check GitHub Actions** tab for deployment status
3. **Visit website**: `http://yourdomain.com/~ta-cukrarna/` or your custom
   domain

**Note**: Static deployment is much simpler and more secure than Node.js
applications. No runtime dependencies or process management needed on the VPS.

### 7. Manual Deployment Commands

```bash
# Manual deployment is NOT needed with GitHub Actions
# But if you need to manually deploy for debugging:

# Option A: Trigger GitHub Actions deployment
# Just push to main branch - this is the recommended way

# Option B: Manual rsync from local machine (for emergency)
# From your local development machine:
npm run build
rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" out/ ta-cukrarna@your-vps-ip:~/public_html/

# Option C: Manual build and upload (emergency only)
# Build locally: npm run build
# Upload out/ directory contents to ~/public_html on VPS
```

### 8. Rollback Instructions

```bash
# Since files are static, rollback is simple:
# 1. Keep backup of previous deployment
# 2. Replace current files with backup

# Example manual rollback:
ssh ta-cukrarna@your-vps-ip
cd ~
mv public_html public_html_current
mv public_html_backup public_html
```

## Security Notes

### Static Site Security Benefits

1. **No runtime vulnerabilities**: Static files cannot execute server-side code
2. **Reduced attack surface**: No Node.js process running, no database
   connections
3. **Simple updates**: Just replace files, no service restarts needed
4. **Performance**: Served directly by Apache, faster than proxy setup
5. **Reliability**: No application crashes, memory leaks, or process management

### General VPS Security

1. **Change default SSH port** (recommended)
2. **Disable password authentication** in SSH
3. **Configure firewall** (ufw)
4. **Regular security updates**: `sudo apt update && sudo apt upgrade`
5. **Monitor logs** for suspicious activity
6. **Use fail2ban** for SSH brute force protection

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

Simple Apache static file serving:

```bash
# Only Apache needs to be running
sudo systemctl status apache2

# Apache serves static files directly from ~/public_html
# No Node.js processes or PM2 needed
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
- **Apache config test**: `sudo apache2ctl configtest`
- **SSL certificate status**: `sudo certbot certificates`
- **Static files**: Check `~/public_html` directory on VPS
