#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Agentic Curriculum — unified start script
# Usage:
#   ./start.sh            # start both backend and frontend
#   ./start.sh --backend  # backend only  (port 8000)
#   ./start.sh --frontend # frontend only (Electron)
#   ./start.sh --setup    # one-time: install all dependencies
#   ./start.sh --stop     # kill both processes
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR"

START_BACKEND=0
START_FRONTEND=0
STOP=0
SETUP=0

if [[ $# -eq 0 ]]; then
  START_BACKEND=1; START_FRONTEND=1
fi

for arg in "$@"; do
  case "$arg" in
    --backend)  START_BACKEND=1 ;;
    --frontend) START_FRONTEND=1 ;;
    --stop)     STOP=1 ;;
    --setup)    SETUP=1 ;;
    *)          echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

if [[ $STOP -eq 1 ]]; then
  echo "Stopping agentic-curriculum backend (port 8000)..."
  lsof -ti:8000 | xargs kill -9 2>/dev/null || true
  pkill -f "uvicorn backend.server" 2>/dev/null || true
  echo "Stopping agentic-curriculum frontend (Electron)..."
  pkill -f "electron" 2>/dev/null || true
  echo "Done."
  exit 0
fi

if [[ $SETUP -eq 1 ]]; then
  echo "=== Setting up Agentic Curriculum ==="
  echo "1/3  Python dependencies..."
  cd "$SCRIPT_DIR/backend"
  python3 -m venv venv 2>/dev/null || true
  source venv/bin/activate
  pip install -q -r requirements.txt
  deactivate
  echo "2/3  Node dependencies..."
  cd "$SCRIPT_DIR/frontend"
  npm install
  echo "3/3  Creating .env from example..."
  if [[ ! -f "$SCRIPT_DIR/backend/.env" ]]; then
    cp "$SCRIPT_DIR/backend/.env.example" "$SCRIPT_DIR/backend/.env"
    echo "     Created backend/.env — add your GOOGLE_API_KEY"
  fi
  echo "Setup complete."
  exit 0
fi

if [[ $START_BACKEND -eq 1 ]]; then
  echo "Starting agentic-curriculum backend on port 8000..."
  echo "  Logs → $LOG_DIR/ac-backend.log"
  (
    cd "$SCRIPT_DIR"
    if [[ -f backend/venv/bin/activate ]]; then
      source backend/venv/bin/activate
    fi
    export PYTHONPATH="$SCRIPT_DIR:${PYTHONPATH:-}"
    nohup python3 -m uvicorn backend.server:app \
      --host 0.0.0.0 --port 8000 --reload \
      >> "$LOG_DIR/ac-backend.log" 2>&1 &
    echo "  Backend PID: $!"
  )
fi

if [[ $START_FRONTEND -eq 1 ]]; then
  echo "Starting agentic-curriculum frontend (Electron)..."
  echo "  Logs → $LOG_DIR/ac-frontend.log"
  (
    cd "$SCRIPT_DIR/frontend"
    nohup npm start \
      >> "$LOG_DIR/ac-frontend.log" 2>&1 &
    echo "  Frontend PID: $!"
  )
fi

echo ""
echo "Use './start.sh --stop' to stop all processes."
echo "Logs are in: $LOG_DIR"
