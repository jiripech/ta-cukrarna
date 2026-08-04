#!/bin/bash

# Release script for ta-cukrarna
# Creates new patch version and deploys to production

set -e

echo "🚀 Ta Cukrárna Release Script"
echo "============================"

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: Must be on main branch for release"
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: Working directory is not clean"
    echo "Please commit or stash changes before releasing"
    git status --short
    exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Increment patch version
NEW_VERSION=$(npm version patch --no-git-tag-version)
echo "📦 New version: $NEW_VERSION"

# Write version file (release version)
echo "📝 Writing public/version.txt..."
bash ./scripts/write-version.sh "$NEW_VERSION"

# Run all checks
echo "🔍 Running security and quality checks..."
npm run check-all

# Commit version bump
echo "💾 Committing version bump..."
# Include generated public/version.txt so deployed site shows the released version
git add package.json package-lock.json public/version.txt
git commit -s -S -m "🔖 Release $NEW_VERSION

- Automated patch version bump
- public/version.txt updated to $NEW_VERSION
- Ready for production deployment"

# Create and push tag
echo "🏷️  Creating release tag..."
git tag -s "$NEW_VERSION" -m "Release $NEW_VERSION"
git push origin main
git push origin "$NEW_VERSION"

echo ""
echo "✅ Release $NEW_VERSION completed!"
echo "🚀 GitHub Actions will deploy to production automatically"
echo "📊 Monitor deployment: https://github.com/jiripech/ta-cukrarna/actions"
echo ""
