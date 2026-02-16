# Agentic Curriculum Studio

A ReAct-based agentic system for creating and modifying language learning curriculum using Gemini models.

## 🎉 What's New (v2.0.0 - Feb 14, 2026)

### Visual Redesign
- ✨ **Complete UI overhaul** with dark gradient theme and glassmorphism
- 🎨 **Modern animations** with smooth transitions and hover effects
- 📱 **Better typography** using Inter font with improved hierarchy
- 🎭 **Custom scrollbars** matching the design system

### New Features
- 📖 **README Toggle**: Choose whether to include lesson format spec in context (saves ~50K tokens)
- ⚙️ **Settings Modal**: Beautiful configuration dialog replacing browser prompts
- 🎯 **Updated Models**: Gemini 2.5 and 3.0 Flash/Pro (removed `-exp` suffix)
- 🍞 **Toast Notifications**: Success feedback instead of alerts

### See Also
- `UI_IMPROVEMENTS_FEB14.md` - Complete changelog
- `VISUAL_COMPARISON.md` - Before/after design comparison
- `NEW_FEATURES_GUIDE.md` - How to use new features

---

## 🏗️ Architecture

```
agentic_curriculum/
├── backend/                 # Python backend
│   ├── agents/             # ReAct agent implementation
│   ├── tools/              # Tool execution system
│   ├── storage/            # Task history and state
│   ├── server.py           # FastAPI server
│   └── config.py           # Configuration management
├── ui/                     # Electron frontend
│   ├── src/               # React components
│   ├── main.js            # Electron main process
│   └── package.json       # Node dependencies
└── README.md              # This file
```

## 🚀 Features

### Agent System
- **ReAct Framework**: Reasoning + Action loop for complex tasks
- **Multi-Model Support**: Gemini 2.5 Flash/Pro, Gemini 3.0 Flash/Pro
- **Tool Execution**: File operations, command execution, lesson generation
- **Cost Tracking**: Real-time token usage and cost estimation
- **State Management**: Full task history and checkpointing

### UI Features
- **Task Dashboard**: View all agent runs and their status
- **Real-time Monitoring**: Watch agent reasoning and actions live
- **Configuration**: Set max iterations, model choice, temperature, etc.
- **Cost Analytics**: Track spending per task and over time
- **History Browser**: Review past tasks and their outcomes

## 🛠️ Tools Available to Agent

1. **File Operations**
   - `read_file`: Read lesson files or curriculum
   - `write_file`: Create/modify lesson JSON files
   - `list_directory`: Browse lesson structure

2. **Lesson Generation**
   - `create_lesson`: Generate new lesson following README format
   - `modify_lesson`: Update existing lesson content
   - `validate_lesson`: Check lesson format compliance

3. **Command Execution**
   - `run_command`: Execute shell commands
   - `reload_lessons`: Reload lessons into database

4. **Curriculum Analysis**
   - `analyze_curriculum`: Evaluate existing lessons
   - `suggest_improvements`: Get enhancement recommendations
   - `check_skills_coverage`: Ensure comprehensive skill teaching

## 📦 Installation

### Backend Setup

```bash
cd agentic_curriculum/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### UI Setup

```bash
cd agentic_curriculum/ui
npm install
```

## 🔑 Configuration

Create `.env` file in `backend/`:

```bash
GOOGLE_API_KEY=your_gemini_api_key_here
DEFAULT_MODEL=gemini-2.0-flash-exp
MAX_ITERATIONS=10
TASK_STORAGE_PATH=./storage/tasks
```

## 🎯 Usage

### Start Backend Server

```bash
cd agentic_curriculum/backend
python3 server.py
# Server runs on http://localhost:8000
```

### Start UI

```bash
cd agentic_curriculum/ui
npm start
# Electron app launches
```

### API Endpoints

- `POST /api/tasks/create` - Create new agent task
- `GET /api/tasks` - List all tasks
- `GET /api/tasks/{task_id}` - Get task details
- `GET /api/tasks/{task_id}/stream` - SSE stream for real-time updates
- `POST /api/tasks/{task_id}/cancel` - Cancel running task
- `GET /api/models` - List available models with pricing
- `GET /api/config` - Get current configuration
- `PUT /api/config` - Update configuration

## 🤖 Example Tasks

### Create New Lesson

```json
{
  "prompt": "Create a new Malayalam lesson teaching the letter ഴ (zha), including examples and questions following the README format",
  "config": {
    "model": "gemini-2.0-flash-exp",
    "max_iterations": 5,
    "temperature": 0.7
  }
}
```

### Modify Existing Curriculum

```json
{
  "prompt": "Review lesson 15 and add 3 more vocabulary examples with native script and transliteration",
  "config": {
    "model": "gemini-2.0-pro-exp",
    "max_iterations": 3
  }
}
```

### Generate Unit

```json
{
  "prompt": "Create a complete unit of 5 lessons teaching basic Kannada conversation phrases for travelers",
  "config": {
    "model": "gemini-2.0-pro-exp",
    "max_iterations": 15
  }
}
```

## 💰 Cost Tracking

The system tracks:
- Input tokens per model call
- Output tokens per model call
- Total cost per task
- Running cost estimate
- Historical spending analytics

### Pricing (as of Feb 2025)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Gemini 2.0 Flash | $0.075 | $0.30 |
| Gemini 2.0 Pro | $1.25 | $5.00 |
| Gemini 3.0 Flash | TBD | TBD |
| Gemini 3.0 Pro | TBD | TBD |

## 🔄 ReAct Loop

```
1. Thought: Agent reasons about what to do next
2. Action: Agent chooses a tool and parameters
3. Observation: Tool executes and returns result
4. Repeat until task complete or max iterations reached
```

Example trace:

```
Thought: I need to read the lesson README to understand the format
Action: read_file("backend/lessons/README.md")
Observation: [README content]

Thought: Now I'll create a lesson following this format
Action: create_lesson(...)
Observation: Lesson created at backend/lessons/ml/...

Thought: I should validate the lesson format
Action: validate_lesson("ml_31_...")
Observation: Validation passed ✓

Thought: Task complete!
```

## 🎨 UI Mockup

```
┌─────────────────────────────────────────────────────┐
│  Agentic Curriculum                        ⚙️ Config │
├─────────────────────────────────────────────────────┤
│  📝 New Task                                         │
│  ┌───────────────────────────────────────────────┐  │
│  │ Prompt: Create lesson teaching letter ള      │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│  Model: Gemini 2.0 Flash ▼  Max Iter: [5]          │
│  [Start Task]                                        │
├─────────────────────────────────────────────────────┤
│  📊 Recent Tasks                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ ✅ Create lesson 31 - ള letter                │  │
│  │    Cost: $0.12 | 3 iterations | 2 min ago     │  │
│  │                                               │  │
│  │ ⏳ Generate Kannada unit 2                    │  │
│  │    Running... | Est: $0.45 | 5/10 iterations │  │
│  │                                               │  │
│  │ ✅ Fix lesson 10 table formatting             │  │
│  │    Cost: $0.03 | 2 iterations | 1 hour ago   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## 🔒 Safety Features

- **Sandbox Mode**: Test mode that doesn't write to actual files
- **Approval Gates**: Optional human approval before file modifications
- **Rollback**: Undo changes from failed tasks
- **Rate Limiting**: Prevent API quota exhaustion
- **Cost Caps**: Stop task if cost exceeds threshold

## 📈 Future Enhancements

- [ ] Multi-agent collaboration (planner + executor)
- [ ] Voice input for task creation
- [ ] Auto-scheduling of curriculum improvements
- [ ] Integration with main app for testing
- [ ] Fine-tuned models for lesson generation
- [ ] Template library for common tasks
- [ ] A/B testing of generated lessons

## 🤝 Contributing

This is a personal project but suggestions welcome!

## 📄 License

MIT License - see LICENSE file

---

**Built with**: Python, FastAPI, Google Gemini AI, Electron, React, WebSockets
