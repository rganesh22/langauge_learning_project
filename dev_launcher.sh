#!/usr/bin/env bash
# Global launcher for Language Learning Project
#
# Usage:
#   ./dev_launcher.sh --all          Start all 4 processes
#   ./dev_launcher.sh --ll-backend   LL backend  (port 8080)
#   ./dev_launcher.sh --ll-frontend  LL frontend (Expo)
#   ./dev_launcher.sh --ac-backend   AC backend  (port 8000)
#   ./dev_launcher.sh --ac-frontend  AC frontend (Electron)
#   ./dev_launcher.sh --stop         Kill all running processes
#   ./dev_launcher.sh --status       Show what is running
#   ./dev_launcher.sh --dry-run --all  Preview commands without running

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"

# ── load root .env if present (for GEMINI_API_KEY etc.) ──────────────────────
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi

# ── defaults (override via env vars) ──────────────────────────────────────────
# Use the venv Python if available, otherwise fall back to system python3
LL_BACKEND_CMD="${LL_BACKEND_CMD:-if [ -f backend/venv/bin/python3 ]; then PYTHON=backend/venv/bin/python3; else PYTHON=python3; fi && \$PYTHON -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload}"
LL_FRONTEND_CMD="${LL_FRONTEND_CMD:-export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"; npx expo start --web}"
AC_BACKEND_CMD="${AC_BACKEND_CMD:-if [ -f backend/venv/bin/python3 ]; then PYTHON=backend/venv/bin/python3; else PYTHON=python3; fi && \$PYTHON -m uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload --reload-exclude 'frontend/node_modules/*' --reload-exclude 'node_modules/*'}"
AC_FRONTEND_CMD="${AC_FRONTEND_CMD:-export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"; npm start}"

# ── flags ─────────────────────────────────────────────────────────────────────
DO_LL_BACKEND=0; DO_LL_FRONTEND=0
DO_AC_BACKEND=0; DO_AC_FRONTEND=0
DO_STOP=0; DO_STATUS=0; DRY_RUN=0

# Default: start everything if no args given
if [[ $# -eq 0 ]]; then
  DO_LL_BACKEND=1; DO_LL_FRONTEND=1; DO_AC_BACKEND=1; DO_AC_FRONTEND=1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all|-all)    DO_LL_BACKEND=1; DO_LL_FRONTEND=1; DO_AC_BACKEND=1; DO_AC_FRONTEND=1 ;;
    --ll-backend)  DO_LL_BACKEND=1 ;;
    --ll-frontend) DO_LL_FRONTEND=1 ;;
    --ac-backend)  DO_AC_BACKEND=1 ;;
    --ac-frontend) DO_AC_FRONTEND=1 ;;
    --stop|-stop)  DO_STOP=1 ;;
    --status)      DO_STATUS=1 ;;
    --dry-run)     DRY_RUN=1 ;;
    --logs)        LOG_DIR="$2"; shift ;;
    *) echo "Unknown option: $1"; echo "Usage: $0 [--all] [--ll-backend] [--ll-frontend] [--ac-backend] [--ac-frontend] [--stop] [--status] [--dry-run]"; exit 1 ;;
  esac
  shift
done

mkdir -p "${LOG_DIR}"

# ── helpers ───────────────────────────────────────────────────────────────────
launch() {
  local name="$1" workdir="$2" cmd="$3"
  local logfile="${LOG_DIR}/${name}.log"
  if [[ ${DRY_RUN} -eq 1 ]]; then
    echo "[dry-run] cd ${workdir} && ${cmd}"
    return
  fi
  # Auto-install node_modules if missing and package.json is present
  if [[ -f "${workdir}/package.json" && ! -d "${workdir}/node_modules" ]]; then
    echo "▶  ${name}: node_modules missing, running npm install..."
    (cd "${workdir}" && npm install)
  fi
  # Auto-install Python deps if venv missing and requirements.txt is present
  if [[ -f "${workdir}/backend/requirements.txt" && ! -f "${workdir}/backend/venv/bin/activate" ]]; then
    echo "▶  ${name}: Python venv missing, creating and installing requirements..."
    python3 -m venv "${workdir}/backend/venv"
    "${workdir}/backend/venv/bin/pip" install -q -r "${workdir}/backend/requirements.txt"
  fi
  # Load per-project .env if present (root level only — backend/.env is loaded
  # by the application itself via pydantic_settings env_file, so sourcing it
  # here would mangle complex values like CORS_ORIGINS=["*"])
  if [[ -f "${workdir}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${workdir}/.env"
    set +a
  fi
  echo "▶  ${name}"
  echo "   dir : ${workdir}"
  echo "   cmd : ${cmd}"
  echo "   log : ${logfile}"
  # cd into dir, background with nohup, capture PID — all in one shell level
  pushd "${workdir}" > /dev/null
  # shellcheck disable=SC2086
  nohup bash -c "${cmd}" >> "${logfile}" 2>&1 &
  echo "   pid : $!"
  popd > /dev/null
  echo ""
}

# ── --stop ────────────────────────────────────────────────────────────────────
if [[ ${DO_STOP} -eq 1 ]]; then
  echo "Stopping all processes..."
  pkill -f "uvicorn backend.main"   2>/dev/null && echo "  stopped LL backend"  || echo "  LL backend not running"
  pkill -f "uvicorn backend.server" 2>/dev/null && echo "  stopped AC backend"  || echo "  AC backend not running"
  pkill -f "expo start"             2>/dev/null && echo "  stopped LL frontend" || echo "  LL frontend not running"
  pkill -f "npm exec expo"          2>/dev/null || true   # also catch npm wrapper
  pkill -f "electron"               2>/dev/null && echo "  stopped AC frontend" || echo "  AC frontend not running"
  # Free any lingering ports
  lsof -ti:8080 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:8081 2>/dev/null | xargs kill -9 2>/dev/null || true
  exit 0
fi

# ── --status ──────────────────────────────────────────────────────────────────
if [[ ${DO_STATUS} -eq 1 ]]; then
  echo "Running processes:"
  pgrep -fl "uvicorn backend.main"   && echo "  LL backend  :8080" || echo "  LL backend  — not running"
  pgrep -fl "uvicorn backend.server" && echo "  AC backend  :8000" || echo "  AC backend  — not running"
  pgrep -fl "expo start"             && echo "  LL frontend — running" || echo "  LL frontend — not running"
  pgrep -fl "electron"               && echo "  AC frontend — running" || echo "  AC frontend — not running"
  exit 0
fi

# ── launch ────────────────────────────────────────────────────────────────────
[[ ${DO_LL_BACKEND}  -eq 1 ]] && launch "ll-backend"  "${SCRIPT_DIR}/language_learning_app"          "${LL_BACKEND_CMD}"
[[ ${DO_LL_FRONTEND} -eq 1 ]] && launch "ll-frontend" "${SCRIPT_DIR}/language_learning_app/frontend"  "${LL_FRONTEND_CMD}"
[[ ${DO_AC_BACKEND}  -eq 1 ]] && launch "ac-backend"  "${SCRIPT_DIR}/agentic_curriculum"              "${AC_BACKEND_CMD}"
[[ ${DO_AC_FRONTEND} -eq 1 ]] && launch "ac-frontend" "${SCRIPT_DIR}/agentic_curriculum/frontend"     "${AC_FRONTEND_CMD}"

if [[ ${DRY_RUN} -eq 0 ]]; then
  echo "Logs: ${LOG_DIR}"
  echo "Stop: $0 --stop"
fi
