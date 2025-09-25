#!/bin/bash

# README Stats Update Script
# Updates README.md with current domain statistics

set -e

echo "🚀 Starting README statistics update..."

# Check if required files exist
if [ ! -f "data/stats.json" ]; then
    echo "❌ Error: stats.json not found. Please run domain sync first."
    exit 1
fi

if [ ! -f "README.md" ]; then
    echo "❌ Error: README.md not found."
    exit 1
fi

# Create scripts directory if it doesn't exist
mkdir -p scripts

# Run the TypeScript update script
echo "📊 Updating README with latest statistics..."
bun run scripts/update-readme-stats.ts "$@"

echo "✅ README statistics update completed successfully!"

# If running in CI, show git diff
if [ "$CI" = "true" ] && [ "$GITHUB_ACTIONS" = "true" ]; then
    echo ""
    echo "📋 Changes made to README.md:"
    git diff --no-index /dev/null README.md | head -20 || git diff README.md | head -20 || echo "No changes detected"
fi
