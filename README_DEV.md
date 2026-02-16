# Development Launcher

Use `dev_launcher.sh` to start the backends and frontends for both the Language Learning app and the Agentic Curriculum app.

Quick start examples:

Start everything (both backends + both frontends):

```bash
./dev_launcher.sh --all
```

Start language-learning backend only (default port 8080):

```bash
./dev_launcher.sh --ll-backend
```

Start agentic-curriculum frontend only:

```bash
./dev_launcher.sh --ac-frontend
```

Dry-run to show commands without executing:

```bash
./dev_launcher.sh --all --dry-run
```

Logs are written to `./logs` by default. Override with `--logs /path/to/logs`.

You can also override specific commands via environment variables. For example:

```bash
LL_BACKEND_CMD='python3 -m uvicorn backend.main:app --port 5001 --reload' ./dev_launcher.sh --ll-backend
```

Notes:
- The script assumes repository layout where `agentic_curriculum/` is a sibling directory at the repo root.
- The language-learning backend command runs from the repo root (where `backend/main.py` lives).
- The agentic-curriculum backend is started from `agentic_curriculum/`.
