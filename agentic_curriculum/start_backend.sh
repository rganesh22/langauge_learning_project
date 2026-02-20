#!/bin/bash

# Start backend server

cd "$(dirname "$0")"

# Install dependencies if needed (silently)
pip3 install -q fastapi uvicorn pydantic pydantic-settings python-dotenv google-generativeai aiofiles 2>/dev/null

# Export the directory to Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Run uvicorn from the agentic_curriculum directory
python3 -m uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload
