#!/bin/bash

# Update scripts on VPS from repository
# Run locally to sync latest scripts to VPS

set -e

echo "📡 Updating VPS scripts from repository..."

# Check if SSH key exists
if [ ! -f "ta-cukrarna-deploy-key" ]; then
    echo "❌ SSH key 'ta-cukrarna-deploy-key' not found in current directory"
    exit 1
fi

# Upload scripts
echo "📤 Uploading scripts to VPS..."
scp -i ta-cukrarna-deploy-key scripts/*.sh ta-cukrarna@revofab.cz:~/scripts/

# Make executable
echo "🔧 Making scripts executable..."
ssh -i ta-cukrarna-deploy-key ta-cukrarna@revofab.cz "chmod +x ~/scripts/*.sh"

# List uploaded scripts
echo "📋 Scripts on VPS:"
ssh -i ta-cukrarna-deploy-key ta-cukrarna@revofab.cz "ls -la ~/scripts/"

echo ""
echo "✅ Scripts updated on VPS!"
echo ""
echo "🚀 Available scripts to run on VPS:"
echo "   As ta-cukrarna user:"
echo "     ~/scripts/cleanup-vps.sh"
echo ""
echo "   As root user:"
echo "     bash /home/ta-cukrarna/scripts/cleanup-vps-root.sh"
echo "     bash /home/ta-cukrarna/scripts/setup-virtualhost.sh"
echo "     bash /home/ta-cukrarna/scripts/remove-nodejs.sh"
