#!/bin/bash
set -e

# Load .env file
if [ -f .env ]; then
  echo "📖 Loading .env file..."
  # This approach handles basic .env files (key=value)
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$VPS_USER" ] || [ -z "$VPS_HOST" ]; then
  echo "❌ Error: VPS_USER or VPS_HOST not found in .env"
  echo "Please ensure your .env file contains VPS_USER and VPS_HOST."
  exit 1
fi

echo "🚀 Starting manual deployment to $VPS_HOST as $VPS_USER..."

# Clean and Build
echo "🧹 Cleaning and building..."
npm run clean
npm run build

# Deploy
echo "📤 Deploying to VPS (public_html/)..."
rsync -avz --delete -e "ssh" --exclude-from='.rsyncignore' ./out/ $VPS_USER@$VPS_HOST:public_html/

# Permissions
echo "🔒 Setting remote file permissions..."
ssh $VPS_USER@$VPS_HOST "find ./public_html -type f -exec chmod 644 {} \;"

echo "✅ Manual deployment finished successfully!"
