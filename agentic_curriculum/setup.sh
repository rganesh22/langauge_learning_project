#!/bin/bash

# Setup script for Agentic Curriculum System

echo "🤖 Setting up Agentic Curriculum System..."
echo ""

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python version: $python_version"

# Check Node version
node_version=$(node --version 2>&1)
echo "✓ Node version: $node_version"

echo ""
echo "📦 Setting up Python backend..."
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✓ Created virtual environment"
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
echo "✓ Installed Python dependencies"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✓ Created .env file (please add your GOOGLE_API_KEY)"
else
    echo "✓ .env file already exists"
fi

# Create storage directory
mkdir -p storage/tasks
echo "✓ Created storage directories"

cd ..

echo ""
echo "📦 Setting up Electron UI..."
cd ui

# Install npm dependencies
npm install
echo "✓ Installed Node dependencies"

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit backend/.env and add your GOOGLE_API_KEY"
echo "2. Start the backend server:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python3 server.py"
echo ""
echo "3. In a new terminal, start the UI:"
echo "   cd ui"
echo "   npm start"
echo ""
echo "🚀 Happy curriculum building!"
