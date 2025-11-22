#!/bin/bash

# DWIGO Setup Script
echo "🚀 Setting up DWIGO - Deals Where I Go"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL 12+ first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm run install-all

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your database credentials"
fi

# Create database
echo "🗄️  Setting up database..."
echo "Please enter your PostgreSQL password when prompted:"
createdb dwigo 2>/dev/null || echo "Database 'dwigo' already exists or error occurred"

# Run database schema
echo "📊 Running database schema..."
psql -d dwigo -f server/schema.sql

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database credentials"
echo "2. Run 'npm run dev' to start the development servers"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "Happy coding! 🚀"
