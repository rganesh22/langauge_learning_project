#!/usr/bin/env bash
# Dev launcher for starting backends and frontends for both apps
# Usage: ./dev_launcher.sh [--all] [--ll-backend] [--ll-frontend] [--ac-backend] [--ac-frontend] [--logs DIR] [--dry-run]

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
DRY_RUN=0

# Capture environment-provided command strings (if any) before we set default arrays
LL_BACKEND_CMD_ENV="${LL_BACKEND_CMD:-}"
LL_FRONTEND_CMD_ENV="${LL_FRONTEND_CMD:-}"
AC_BACKEND_CMD_ENV="${AC_BACKEND_CMD:-}"
AC_FRONTEND_CMD_ENV="${AC_FRONTEND_CMD:-}"

# Default commands (can be overridden via env or flags)
LL_BACKEND_CMD_DEFAULT=(python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload)
LL_FRONTEND_CMD_DEFAULT=(npm start)
AC_BACKEND_CMD_DEFAULT=(python3 -m uvicorn agentic_curriculum/backend.main:app --host 0.0.0.0 --port 8000 --reload)
AC_FRONTEND_CMD_DEFAULT=(bash -c "cd agentic_curriculum/ui && npm start")

LL_BACKEND_CMD=(${LL_BACKEND_CMD_DEFAULT[@]})
LL_FRONTEND_CMD=(${LL_FRONTEND_CMD_DEFAULT[@]})
AC_BACKEND_CMD=(${AC_BACKEND_CMD_DEFAULT[@]})
AC_FRONTEND_CMD=(${AC_FRONTEND_CMD_DEFAULT[@]})

START_LL_BACKEND=0
START_LL_FRONTEND=0
START_AC_BACKEND=0
START_AC_FRONTEND=0

print_help(){
  cat <<EOF
dev_launcher.sh - start dev servers for language-learning and agentic-curriculum

Usage:
  ./dev_launcher.sh [options]

Options:
  --all               Start all four processes (both backends and frontends)
  --ll-backend        Start language-learning backend (default port 8080)
  --ll-frontend       Start language-learning frontend (runs in repo root)
  --ac-backend        Start agentic-curriculum backend (default port 8000)
  --ac-frontend       Start agentic-curriculum frontend (agentic_curriculum/ui)
  --logs DIR          Write logs to DIR (default: ./logs)
  --dry-run           Print commands instead of executing them
  -h, --help          Show this help

Environment overrides (optional):
  LL_BACKEND_CMD, LL_FRONTEND_CMD, AC_BACKEND_CMD, AC_FRONTEND_CMD

Examples:
  ./dev_launcher.sh --all
  ./dev_launcher.sh --ll-backend --logs /tmp/devlogs
  LL_BACKEND_CMD='python3 -m uvicorn backend.main:app --port 5001 --reload' ./dev_launcher.sh --ll-backend

EOF
}

parse_args(){
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --all)
        START_LL_BACKEND=1; START_LL_FRONTEND=1; START_AC_BACKEND=1; START_AC_FRONTEND=1; shift;;
      --ll-backend) START_LL_BACKEND=1; shift;;
      --ll-frontend) START_LL_FRONTEND=1; shift;;
      --ac-backend) START_AC_BACKEND=1; shift;;
      --ac-frontend) START_AC_FRONTEND=1; shift;;
      --logs) LOG_DIR="$2"; shift 2;;
      --dry-run) DRY_RUN=1; shift;;
      -h|--help) print_help; exit 0;;
      *) echo "Unknown arg: $1"; print_help; exit 1;;
    esac
  done
}

ensure_logs(){
  mkdir -p "${LOG_DIR}"
}

run_cmd(){
  local name="$1"; shift
  local -a cmd=("$@")
  local logfile="${LOG_DIR}/${name}.log"
  if [[ ${DRY_RUN} -eq 1 ]]; then
    echo "[DRY-RUN] ${name}: ${cmd[*]}  > ${logfile} 2>&1 &"
    return 0
  fi
  echo "Starting ${name}; logs -> ${logfile}"
  nohup ${cmd[*]} > "${logfile}" 2>&1 &
  sleep 0.1
}

main(){
  parse_args "$@"
  ensure_logs

    # allow env overrides (use captured env vars to avoid clobbering array defaults)
    if [[ -n "${LL_BACKEND_CMD_ENV}" ]]; then
      read -r -a LL_BACKEND_CMD <<< "${LL_BACKEND_CMD_ENV}"
    fi
    if [[ -n "${LL_FRONTEND_CMD_ENV}" ]]; then
      read -r -a LL_FRONTEND_CMD <<< "${LL_FRONTEND_CMD_ENV}"
    fi
    if [[ -n "${AC_BACKEND_CMD_ENV}" ]]; then
      read -r -a AC_BACKEND_CMD <<< "${AC_BACKEND_CMD_ENV}"
    fi
    if [[ -n "${AC_FRONTEND_CMD_ENV}" ]]; then
      read -r -a AC_FRONTEND_CMD <<< "${AC_FRONTEND_CMD_ENV}"
    fi

  # Start selected services
  if [[ ${START_LL_BACKEND} -eq 1 ]]; then
    run_cmd ll-backend "${LL_BACKEND_CMD[@]}"
  fi
  if [[ ${START_LL_FRONTEND} -eq 1 ]]; then
    # run from repo root
    (cd "${SCRIPT_DIR}" && run_cmd ll-frontend "${LL_FRONTEND_CMD[@]}")
  fi
  if [[ ${START_AC_BACKEND} -eq 1 ]]; then
    # agentic curriculum backend runs from agentic_curriculum/
    (cd "${SCRIPT_DIR}/agentic_curriculum" && run_cmd ac-backend "${AC_BACKEND_CMD[@]}")
  fi
  if [[ ${START_AC_FRONTEND} -eq 1 ]]; then
    (cd "${SCRIPT_DIR}/agentic_curriculum/ui" && run_cmd ac-frontend "${AC_FRONTEND_CMD[@]}")
  fi

  if [[ ${DRY_RUN} -eq 1 ]]; then
    echo "\nDry-run complete. No processes started."
  else
    echo "\nLaunched requested processes. Use 'ps aux | grep -E "ll-backend|ac-backend|node|uvicorn"' to inspect."
    echo "Logs are in: ${LOG_DIR}"
  fi
}

main "$@"
