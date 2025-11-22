#!/bin/bash

# Quick deployment script for Render.com
# This script helps you prepare and deploy to Render

set -e

echo "🚀 DWIGO Deployment to Render.com"
echo "=================================="
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
  echo "⚠️  Git not initialized. Initializing..."
  git init
  git add .
  git commit -m "Initial commit for Render deployment"
fi

# Check if render.yaml exists
if [ ! -f render.yaml ]; then
  echo "❌ render.yaml not found!"
  exit 1
fi

echo "✅ Files ready for deployment"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Push to GitHub:"
echo "   git remote add origin <your-github-repo-url>"
echo "   git push -u origin main"
echo ""
echo "2. Go to https://render.com"
echo ""
echo "3. Click 'New +' → 'Blueprint'"
echo ""
echo "4. Connect your GitHub repository"
echo ""
echo "5. Render will detect render.yaml automatically"
echo ""
echo "6. Click 'Apply' to deploy"
echo ""
echo "7. After deployment, initialize the database:"
echo "   psql <DATABASE_URL> -f server/schema.sql"
echo ""
echo "📱 Your app will be available at: https://dwigo-app.onrender.com"
echo ""
echo "💡 Tip: Render free tier spins down after 15 min of inactivity"
echo "   First request after spin-down may take 30-60 seconds"

