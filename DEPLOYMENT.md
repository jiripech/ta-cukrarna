# Ta Cukrárna - Deployment Setup

## SSH Key Setup for GitHub Actions

### 1. SSH Keys Generated
- **Private key**: `ta-cukrarna-deploy-key` (for GitHub Secrets)
- **Public key**: `ta-cukrarna-deploy-key.pub` (for VPS)

### 2. VPS Setup Instructions

#### Add public key to VPS:
```bash
# On your VPS (Debian 12)
mkdir -p ~/.ssh
cat >> ~/.ssh/authorized_keys << 'EOF'
# Copy content from ta-cukrarna-deploy-key.pub here
EOF

# Set proper permissions
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

#### Install Node.js on VPS:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/ta-cukrarna
sudo chown $USER:$USER /var/www/ta-cukrarna
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
your-vps-username
```

#### `VPS_PATH`
```
/var/www/ta-cukrarna
```

### 4. VPS Web Server Setup

#### Option A: Nginx (recommended)
```bash
# Install Nginx
sudo apt install nginx -y

# Create site configuration
sudo tee /etc/nginx/sites-available/ta-cukrarna << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/ta-cukrarna /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Option B: PM2 Ecosystem
```bash
# Create PM2 ecosystem file
cat > /var/www/ta-cukrarna/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'ta-cukrarna',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/ta-cukrarna/current',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. SSL Certificate (Optional)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
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
- **VPS logs**: `sudo journalctl -u nginx -f`
- **Application logs**: `pm2 logs ta-cukrarna`
- **Nginx config test**: `sudo nginx -t`