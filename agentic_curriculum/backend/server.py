"""
FastAPI server for Agentic Curriculum System
Provides REST API and WebSocket endpoints for agent interaction
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import asyncio
import json
import uuid
from datetime import datetime
from pathlib import Path

from .config import settings, get_available_models, MODEL_PRICING
from .agents.react_agent import ReActAgent, AgentState
from .storage.task_store import TaskStore

# Initialize FastAPI
app = FastAPI(
    title="Agentic Curriculum API",
    description="ReAct-based agent system for curriculum generation",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Task storage
task_store = TaskStore(settings.task_storage_path)

# Active agents
active_agents: Dict[str, ReActAgent] = {}


# Request/Response Models
class TaskCreateRequest(BaseModel):
    prompt: str
    config: Optional[Dict[str, Any]] = {}


class TaskResponse(BaseModel):
    task_id: str
    status: str
    prompt: str
    config: Dict[str, Any]
    created_at: str
    completed_at: Optional[str] = None
    iterations: int = 0
    total_cost: float = 0.0
    result: Optional[Dict[str, Any]] = None


class ConfigUpdateRequest(BaseModel):
    model: Optional[str] = None
    max_iterations: Optional[int] = None
    temperature: Optional[float] = None
    sandbox_mode: Optional[bool] = None
    max_cost_per_task: Optional[float] = None


# Endpoints

@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "running",
        "version": "1.0.0",
        "active_tasks": len(active_agents)
    }


@app.get("/api/models")
async def list_models():
    """Get available models with pricing"""
    return {
        "models": get_available_models(),
        "default": settings.default_model
    }


@app.get("/api/config")
async def get_config():
    """Get current configuration"""
    return {
        "model": settings.default_model,
        "max_iterations": settings.max_iterations,
        "temperature": settings.temperature,
        "sandbox_mode": settings.sandbox_mode,
        "require_approval": settings.require_approval,
        "max_cost_per_task": settings.max_cost_per_task
    }


@app.get("/api/tools")
async def list_tools():
    """Get all available tools with their parameters"""
    from .tools.tools import ToolRegistry
    
    registry = ToolRegistry(settings)
    tools = registry.get_all_tools()
    
    return {
        "success": True,
        "count": len(tools),
        "tools": tools
    }


@app.get("/api/readme")
async def get_readme():
    """Get the README content"""
    readme_path = Path(__file__).parent.parent / "README.md"
    
    try:
        if readme_path.exists():
            content = readme_path.read_text(encoding='utf-8')
            return {
                "success": True,
                "content": content,
                "path": str(readme_path)
            }
        else:
            raise HTTPException(status_code=404, detail="README.md not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read README: {str(e)}")


@app.get("/api/system-prompt")
async def get_system_prompt():
    """Get the system prompt content"""
    prompt_path = Path(__file__).parent / "prompting" / "system_prompt.txt"
    
    try:
        if prompt_path.exists():
            content = prompt_path.read_text(encoding='utf-8')
            return {
                "success": True,
                "content": content,
                "path": str(prompt_path)
            }
        else:
            # Return default if file doesn't exist
            from backend.prompting.prompts import SYSTEM_PROMPT_BASE
            return {
                "success": True,
                "content": SYSTEM_PROMPT_BASE,
                "path": str(prompt_path),
                "is_default": True
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read system prompt: {str(e)}")


@app.put("/api/system-prompt")
async def update_system_prompt(content: dict):
    """Update the system prompt file"""
    prompt_path = Path(__file__).parent / "prompting" / "system_prompt.txt"
    
    try:
        prompt_content = content.get("content", "")
        if not prompt_content:
            raise HTTPException(status_code=400, detail="Content is required")
        
        prompt_path.write_text(prompt_content, encoding='utf-8')
        
        return {
            "success": True,
            "message": "System prompt updated successfully",
            "path": str(prompt_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update system prompt: {str(e)}")


@app.put("/api/config")
async def update_config(request: ConfigUpdateRequest):
    """Update configuration"""
    updated = {}
    
    if request.model:
        settings.default_model = request.model
        updated["model"] = request.model
    
    if request.max_iterations is not None:
        settings.max_iterations = request.max_iterations
        updated["max_iterations"] = request.max_iterations
    
    if request.temperature is not None:
        settings.temperature = request.temperature
        updated["temperature"] = request.temperature
    
    if request.sandbox_mode is not None:
        settings.sandbox_mode = request.sandbox_mode
        updated["sandbox_mode"] = request.sandbox_mode
    
    if request.max_cost_per_task is not None:
        settings.max_cost_per_task = request.max_cost_per_task
        updated["max_cost_per_task"] = request.max_cost_per_task
    
    return {"success": True, "updated": updated}


@app.post("/api/tasks/create")
async def create_task(request: TaskCreateRequest):
    """Create and start a new agent task - returns immediately with task_id"""
    
    try:
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Merge config with defaults
        config = {
            "model": settings.default_model,
            "max_iterations": settings.max_iterations,
            "temperature": settings.temperature,
            **request.config
        }
        
        # Create task record
        task_data = {
            "task_id": task_id,
            "status": "running",
            "prompt": request.prompt,
            "config": config,
            "created_at": datetime.utcnow().isoformat(),
            "completed_at": None,
            "iterations": 0,
            "total_cost": 0.0,
            "history": [],
            "result": None
        }
        
        task_store.save_task(task_id, task_data)
        
        # Create status callback
        def status_callback(event: Dict[str, Any]):
            """Update task with real-time events"""
            task_data["history"].append(event)
            
            # Update cost and iterations
            if event["event"] == "cost_update":
                task_data["total_cost"] = event["data"]["total_cost"]
            
            if event["event"] == "iteration":
                task_data["iterations"] = event["data"]["number"]
            
            if event["event"] in ["complete", "max_iterations", "error", "cancelled"]:
                task_data["status"] = event["event"]
                task_data["completed_at"] = datetime.utcnow().isoformat()
                task_data["result"] = event["data"]
            
            task_store.save_task(task_id, task_data)
        
        # Create agent
        agent = ReActAgent(
            task_id=task_id,
            prompt=request.prompt,
            config=config,
            status_callback=status_callback
        )
        
        active_agents[task_id] = agent
        
        # Run agent as a fire-and-forget asyncio task
        # This returns IMMEDIATELY - the agent runs in the background
        async def run_agent_task():
            try:
                result = await agent.run()
            except Exception as e:
                print(f"Agent error: {e}")
                import traceback
                traceback.print_exc()
                task_data["status"] = "failed"
                task_data["result"] = {"error": str(e)}
                task_data["completed_at"] = datetime.utcnow().isoformat()
                task_store.save_task(task_id, task_data)
            finally:
                if task_id in active_agents:
                    del active_agents[task_id]
        
        asyncio.create_task(run_agent_task())
        
        return {
            "task_id": task_id,
            "status": "running",
            "message": "Task started successfully"
        }
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error creating task: {error_details}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create task: {str(e)}"
        )


@app.get("/api/tasks")
async def list_tasks(limit: int = 50, offset: int = 0):
    """List all tasks"""
    tasks = task_store.list_tasks(limit=limit, offset=offset)
    return {
        "tasks": tasks,
        "total": len(tasks)
    }


@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    """Get task details"""
    task = task_store.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task


@app.get("/api/tasks/{task_id}/stream")
async def stream_task(task_id: str):
    """Stream task updates via Server-Sent Events"""
    
    task = task_store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    async def event_generator():
        """Generate SSE events"""
        last_event_idx = 0
        
        while True:
            task = task_store.get_task(task_id)
            
            if not task:
                break
            
            # Send new events
            history = task.get("history", [])
            while last_event_idx < len(history):
                event = history[last_event_idx]
                yield f"data: {json.dumps(event)}\n\n"
                last_event_idx += 1
            
            # Check if task is complete
            if task["status"] in ["complete", "failed", "cancelled", "max_iterations"]:
                yield f"data: {json.dumps({'event': 'done'})}\n\n"
                break
            
            await asyncio.sleep(0.5)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


@app.post("/api/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Cancel a running task"""
    
    if task_id not in active_agents:
        task = task_store.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if task["status"] == "running":
            return {"success": False, "message": "Task is running but agent not found"}
        else:
            return {"success": False, "message": "Task is not running"}
    
    agent = active_agents[task_id]
    agent.cancel()
    
    return {
        "success": True,
        "message": "Task cancelled successfully"
    }


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    
    # Can't delete running tasks
    if task_id in active_agents:
        raise HTTPException(status_code=400, detail="Cannot delete running task")
    
    success = task_store.delete_task(task_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True, "message": "Task deleted"}


@app.post("/api/tasks/{task_id}/retry")
async def retry_task(task_id: str):
    """Retry a failed or completed task with the same prompt and config"""
    
    # Get original task
    original_task = task_store.get_task(task_id)
    if not original_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Can't retry running tasks
    if task_id in active_agents or original_task["status"] == "running":
        raise HTTPException(status_code=400, detail="Cannot retry running task")
    
    # Create new task with same prompt and config
    new_task_id = str(uuid.uuid4())
    
    # Prepare task data
    task_data = {
        "task_id": new_task_id,
        "prompt": original_task["prompt"],
        "config": original_task["config"],
        "status": "running",
        "created_at": datetime.utcnow().isoformat(),
        "completed_at": None,
        "history": [],
        "result": None,
        "total_cost": 0.0,
        "iterations": 0,
        "retried_from": task_id  # Track that this is a retry
    }
    
    task_store.save_task(new_task_id, task_data)
    
    # Status callback
    def status_callback(event):
        """Update task with real-time events"""
        task_data["history"].append(event)
        
        # Update cost and iterations
        if event["event"] == "cost_update":
            task_data["total_cost"] = event["data"]["total_cost"]
        
        if event["event"] == "iteration":
            task_data["iterations"] = event["data"]["number"]
        
        if event["event"] in ["complete", "max_iterations", "error", "cancelled"]:
            task_data["status"] = event["event"]
            task_data["completed_at"] = datetime.utcnow().isoformat()
            task_data["result"] = event["data"]
        
        task_store.save_task(new_task_id, task_data)
    
    # Create agent
    agent = ReActAgent(
        task_id=new_task_id,
        prompt=original_task["prompt"],
        config=original_task["config"],
        status_callback=status_callback
    )
    
    active_agents[new_task_id] = agent
    
    # Run agent as a fire-and-forget asyncio task
    async def run_agent_task():
        try:
            result = await agent.run()
        except Exception as e:
            print(f"Agent error: {e}")
            task_data["status"] = "failed"
            task_data["result"] = {"error": str(e)}
            task_data["completed_at"] = datetime.utcnow().isoformat()
            task_store.save_task(new_task_id, task_data)
        finally:
            if new_task_id in active_agents:
                del active_agents[new_task_id]
    
    asyncio.create_task(run_agent_task())
    
    return {
        "task_id": new_task_id,
        "original_task_id": task_id,
        "status": "running",
        "message": "Task retry started successfully"
    }


@app.get("/api/stats")
async def get_stats():
    """Get usage statistics"""
    tasks = task_store.list_tasks(limit=1000)
    
    total_cost = sum(t.get("total_cost", 0) for t in tasks)
    completed_tasks = sum(1 for t in tasks if t["status"] == "complete")
    failed_tasks = sum(1 for t in tasks if t["status"] == "failed")
    
    return {
        "total_tasks": len(tasks),
        "completed_tasks": completed_tasks,
        "failed_tasks": failed_tasks,
        "running_tasks": len(active_agents),
        "total_cost": total_cost,
        "average_cost": total_cost / len(tasks) if tasks else 0
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
