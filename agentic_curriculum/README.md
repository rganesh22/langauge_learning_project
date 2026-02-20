# Agentic Curriculum Studio

A ReAct-based agentic system for creating and modifying language learning curriculum using Google Gemini models. Features a full Electron UI for managing agent tasks.

## Architecture

```
agentic_curriculum/
├── backend/
│   ├── agents/              # ReAct agent implementation
│   ├── tools/               # Tool definitions & execution
│   │   ├── tools.py         # File, system, validation tools
│   │   └── db_tools.py      # Database & planning tools
│   ├── prompting/           # System prompt & templates
│   ├── services/            # Gemini API service
│   ├── storage/             # Task history & checkpoints
│   ├── server.py            # FastAPI server (port 8000)
│   └── config.py            # Config (models, paths, pricing)
├── ui/
│   ├── src/app.js           # Main UI application
│   ├── index.html           # HTML shell
│   ├── main.js              # Electron main process
│   └── package.json         # Node dependencies
├── storage/tasks/           # Persisted task results
├── setup.sh                 # One-time setup
├── start_backend.sh         # Start backend server
└── start_ui.sh              # Start Electron UI
```

## Features

### Agent
- **ReAct Framework** — Reasoning + Action loop for complex curriculum tasks
- **Multi-Model** — Gemini 2.5 Flash/Flash-Lite/Pro, Gemini 3 Flash/Pro
- **Cost Tracking** — Real-time token usage and dollar cost per task
- **Checkpointing** — Full task history with retry/resume

### Tools (18 total)
| Category   | Tools |
|------------|-------|
| Filesystem | `read_file`, `write_file`, `delete_file`, `list_directory` |
| System     | `run_command` |
| Validation | `validate_lesson` |
| Database   | `query_vocabulary`, `query_lessons`, `load_lesson_to_db`, `delete_lesson`, `delete_unit`, `list_units`, `get_lesson_detail`, `update_lesson_in_db` |
| Planning   | `plan_task`, `mark_step_complete`, `get_plan_status` |

### UI
- Task dashboard with real-time streaming
- Configurable models, tools, system prompt, and context summarization
- Profile management (save/load settings presets)
- Collapsible toolbox browser
- Cost analytics and stats

## Quick Start

### 1. Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Add your GOOGLE_API_KEY
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 2. UI
```bash
cd ui
npm install
npm start
```

Or use the root dev launcher:
```bash
cd ../..
./dev_launcher.sh --ac-backend --ac-frontend
```

## Configuration

Create `backend/.env`:
```env
GOOGLE_API_KEY=your-api-key-here
DEFAULT_MODEL=gemini-2.5-flash
MAX_ITERATIONS=15
MAX_COST_PER_TASK=10.0
LESSONS_BASE_PATH=../language_learning_app/backend/lessons
```

## Ports

| Service              | Port |
|----------------------|------|
| Agentic Curriculum   | 8000 |
| Language Learning App| 8080 |
