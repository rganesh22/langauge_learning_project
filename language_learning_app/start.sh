#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Language Learning App — unified start script
# Usage:
#   ./start.sh            # start both backend and frontend
#   ./start.sh --backend  # backend only  (port 8080)
#   ./start.sh --frontend # frontend only (Expo)
#   ./start.sh --stop     # kill both processes
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR"

# ── load .env if present (GEMINI_API_KEY, etc.) ───────────────────────────────
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

# ── ensure nvm / node is available ────────────────────────────────────────────
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
fi

START_BACKEND=0
START_FRONTEND=0
STOP=0

if [[ $# -eq 0 ]]; then
  START_BACKEND=1; START_FRONTEND=1
fi

for arg in "$@"; do
  case "$arg" in
    --backend)  START_BACKEND=1 ;;
    --frontend) START_FRONTEND=1 ;;
    --stop)     STOP=1 ;;
    *)          echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

if [[ $STOP -eq 1 ]]; then
  echo "Stopping language-learning backend (port 8080)..."
  pkill -f "uvicorn backend.main" 2>/dev/null || true
  lsof -ti:8080 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo "Stopping language-learning frontend (Expo)..."
  pkill -f "expo start" 2>/dev/null || true
  pkill -f "npm exec expo" 2>/dev/null || true
  lsof -ti:8081 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo "Done."
  exit 0
fi

if [[ $START_BACKEND -eq 1 ]]; then
  echo "Starting language-learning backend on port 8080..."
  echo "  Logs → $LOG_DIR/ll-backend.log"

  # Auto-create venv and install requirements if venv is missing
  if [[ ! -f "$SCRIPT_DIR/backend/venv/bin/activate" ]]; then
    echo "  No venv found — creating one and installing requirements..."
    python3 -m venv "$SCRIPT_DIR/backend/venv"
    "$SCRIPT_DIR/backend/venv/bin/pip" install -q -r "$SCRIPT_DIR/backend/requirements.txt"
  fi

  (
    cd "$SCRIPT_DIR"
    # shellcheck disable=SC1091
    source backend/venv/bin/activate
    nohup python3 -m uvicorn backend.main:app \
      --host 0.0.0.0 --port 8080 --reload \
      >> "$LOG_DIR/ll-backend.log" 2>&1 &
    echo "  Backend PID: $!"
  )
fi

if [[ $START_FRONTEND -eq 1 ]]; then
  echo "Starting language-learning frontend (Expo web)..."
  echo "  Logs → $LOG_DIR/ll-frontend.log"

  # Auto-install node_modules if missing
  if [[ ! -d "$SCRIPT_DIR/frontend/node_modules" ]]; then
    echo "  node_modules missing — running npm install..."
    (cd "$SCRIPT_DIR/frontend" && npm install)
  fi

  (
    cd "$SCRIPT_DIR/frontend"
    # Re-source nvm inside the subshell so nohup can find npx/node
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
    nohup npx expo start --web \
      >> "$LOG_DIR/ll-frontend.log" 2>&1 &
    echo "  Frontend PID: $!"
  )
fi

echo ""
echo "Use './start.sh --stop' to stop all processes."
echo "Logs are in: $LOG_DIR"
