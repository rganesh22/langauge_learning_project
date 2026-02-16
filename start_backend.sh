#!/bin/bash
# Quick script to reload lessons and start backend
# Usage: ./start_backend.sh

echo "════════════════════════════════════════════════════════"
echo "🔄 Step 1: Reloading lessons into database..."
echo "════════════════════════════════════════════════════════"
echo ""

python3 reload_lessons.py

if [ $? -eq 0 ]; then
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo "🚀 Step 2: Starting backend server..."
    echo "════════════════════════════════════════════════════════"
    echo ""
    python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 5001 --reload
else
    echo ""
    echo "❌ Lesson reload failed. Backend not started."
    exit 1
fi
