"""
Tool definitions for the ReAct agent
Each tool is a function that the agent can call with specific parameters
"""

import os
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

class Tool:
    """Base class for agent tools"""
    
    def __init__(self, name: str, description: str, parameters: Dict[str, Any], category: str = "general"):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.category = category
    
    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool with given parameters"""
        raise NotImplementedError
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert tool to dictionary for agent prompt"""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "category": self.category
        }


class ReadFileTool(Tool):
    """Read contents of a file"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        super().__init__(
            name="read_file",
            description="Read the contents of a file. Use this to examine lesson files, README, or any text file.",
            parameters={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the file from lessons directory"
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "Optional: Start reading from this line number"
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "Optional: Stop reading at this line number"
                    }
                },
                "required": ["path"]
            }
        )
    
    def execute(self, path: str, start_line: Optional[int] = None, end_line: Optional[int] = None) -> Dict[str, Any]:
        try:
            file_path = self.base_path / path
            
            if not file_path.exists():
                return {"success": False, "error": f"File not found: {path}"}
            
            with open(file_path, 'r', encoding='utf-8') as f:
                if start_line is not None or end_line is not None:
                    lines = f.readlines()
                    start = (start_line - 1) if start_line else 0
                    end = end_line if end_line else len(lines)
                    content = ''.join(lines[start:end])
                else:
                    content = f.read()
            
            return {
                "success": True,
                "content": content,
                "path": str(file_path),
                "size": len(content)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


class WriteFileTool(Tool):
    """Write content to a file"""
    
    def __init__(self, base_path: str, sandbox_mode: bool = False):
        self.base_path = Path(base_path)
        self.sandbox_mode = sandbox_mode
        super().__init__(
            name="write_file",
            description="Write or create a file with given content. Use this to create new lessons or modify existing files.",
            parameters={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path where to write the file"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to the file"
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["create", "overwrite", "append"],
                        "description": "Write mode: create (fail if exists), overwrite, or append"
                    }
                },
                "required": ["path", "content"]
            }
        )
    
    def execute(self, path: str, content: str, mode: str = "create") -> Dict[str, Any]:
        try:
            file_path = self.base_path / path
            
            if self.sandbox_mode:
                return {
                    "success": True,
                    "sandbox": True,
                    "message": f"[SANDBOX] Would write to {path}",
                    "content_preview": content[:200] + "..." if len(content) > 200 else content
                }
            
            # Check mode
            if mode == "create" and file_path.exists():
                return {"success": False, "error": f"File already exists: {path}"}
            
            # Create parent directories
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write file
            write_mode = 'a' if mode == "append" else 'w'
            with open(file_path, write_mode, encoding='utf-8') as f:
                f.write(content)
            
            return {
                "success": True,
                "path": str(file_path),
                "size": len(content),
                "mode": mode
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


class DeleteFileTool(Tool):
    """Delete a file"""
    
    def __init__(self, base_path: str, sandbox_mode: bool = False):
        self.base_path = Path(base_path)
        self.sandbox_mode = sandbox_mode
        super().__init__(
            name="delete_file",
            description="Delete a file. Use this to remove lesson files or other files that are no longer needed.",
            parameters={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the file to delete"
                    }
                },
                "required": ["path"]
            }
        )
    
    def execute(self, path: str) -> Dict[str, Any]:
        try:
            file_path = self.base_path / path
            
            if self.sandbox_mode:
                return {
                    "success": True,
                    "sandbox": True,
                    "message": f"[SANDBOX] Would delete {path}"
                }
            
            if not file_path.exists():
                return {"success": False, "error": f"File not found: {path}"}
            
            if file_path.is_dir():
                return {"success": False, "error": f"Path is a directory, not a file: {path}. Use run_command with 'rm -r' for directories."}
            
            file_path.unlink()
            
            return {
                "success": True,
                "path": str(file_path),
                "message": f"File deleted: {path}"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


class ListDirectoryTool(Tool):
    """List contents of a directory"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        super().__init__(
            name="list_directory",
            description="List files and directories in a given path. Use this to explore lesson structure.",
            parameters={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to list (default: '.')"
                    },
                    "pattern": {
                        "type": "string",
                        "description": "Optional glob pattern to filter (e.g., '*.json')"
                    }
                }
            }
        )
    
    def execute(self, path: str = ".", pattern: Optional[str] = None) -> Dict[str, Any]:
        try:
            dir_path = self.base_path / path
            
            if not dir_path.exists():
                return {"success": False, "error": f"Directory not found: {path}"}
            
            if pattern:
                items = [str(p.relative_to(dir_path)) for p in dir_path.glob(pattern)]
            else:
                items = [p.name for p in dir_path.iterdir()]
            
            items.sort()
            
            return {
                "success": True,
                "path": str(dir_path),
                "items": items,
                "count": len(items)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


class RunCommandTool(Tool):
    """Execute a shell command"""
    
    def __init__(self, sandbox_mode: bool = False):
        self.sandbox_mode = sandbox_mode
        super().__init__(
            name="run_command",
            description="Execute a shell command. Use carefully - only for safe operations like reloading lessons.",
            parameters={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Command to execute"
                    },
                    "working_dir": {
                        "type": "string",
                        "description": "Working directory for command execution"
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (default: 30)"
                    }
                },
                "required": ["command"]
            }
        )
    
    def execute(self, command: str, working_dir: Optional[str] = None, timeout: int = 30) -> Dict[str, Any]:
        try:
            if self.sandbox_mode:
                return {
                    "success": True,
                    "sandbox": True,
                    "message": f"[SANDBOX] Would execute: {command}"
                }
            
            result = subprocess.run(
                command,
                shell=True,
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": f"Command timed out after {timeout}s"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ValidateLessonTool(Tool):
    """Validate a lesson file against the format specification"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        super().__init__(
            name="validate_lesson",
            description="Validate a lesson JSON file against the format specification from README.md",
            parameters={
                "type": "object",
                "properties": {
                    "lesson_path": {
                        "type": "string",
                        "description": "Path to the lesson JSON file to validate"
                    }
                },
                "required": ["lesson_path"]
            }
        )
    
    def execute(self, lesson_path: str) -> Dict[str, Any]:
        try:
            file_path = self.base_path / lesson_path
            
            if not file_path.exists():
                return {"success": False, "error": f"Lesson file not found: {lesson_path}"}
            
            with open(file_path, 'r', encoding='utf-8') as f:
                lesson = json.load(f)
            
            errors = []
            warnings = []
            
            # Required top-level fields
            required_fields = ["lesson_id", "language", "title", "description", 
                             "estimated_minutes", "cefr_level", "tags", "skills_learned", "steps"]
            
            for field in required_fields:
                if field not in lesson:
                    errors.append(f"Missing required field: {field}")
            
            # Validate tags
            if "tags" in lesson:
                if not isinstance(lesson["tags"], list) or len(lesson["tags"]) < 3:
                    warnings.append("Should have at least 3 tags")
            
            # Validate skills_learned
            if "skills_learned" in lesson:
                if not isinstance(lesson["skills_learned"], list) or len(lesson["skills_learned"]) < 3:
                    warnings.append("Should have at least 3 skills in skills_learned")
            
            # Validate steps
            if "steps" in lesson:
                for i, step in enumerate(lesson["steps"]):
                    if "type" not in step:
                        errors.append(f"Step {i+1}: Missing 'type' field")
                    if "step_title" not in step:
                        errors.append(f"Step {i+1}: Missing 'step_title' field")
                    else:
                        word_count = len(step["step_title"].split())
                        if word_count > 4:
                            warnings.append(f"Step {i+1}: step_title has {word_count} words (recommended: 3-4)")
            
            return {
                "success": len(errors) == 0,
                "valid": len(errors) == 0,
                "errors": errors,
                "warnings": warnings,
                "lesson_id": lesson.get("lesson_id", "unknown")
            }
        except json.JSONDecodeError as e:
            return {"success": False, "error": f"Invalid JSON: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ToolRegistry:
    """Registry of all available tools"""
    
    def __init__(self, config):
        self.tools: Dict[str, Tool] = {}
        self.config = config
        self._register_tools()
    
    def _register_tools(self):
        """Register all available tools"""
        # File system tools
        self.tools["read_file"] = ReadFileTool(self.config.lessons_base_path)
        self.tools["read_file"].category = "filesystem"
        
        self.tools["write_file"] = WriteFileTool(self.config.lessons_base_path, self.config.sandbox_mode)
        self.tools["write_file"].category = "filesystem"
        
        self.tools["delete_file"] = DeleteFileTool(self.config.lessons_base_path, self.config.sandbox_mode)
        self.tools["delete_file"].category = "filesystem"
        
        self.tools["list_directory"] = ListDirectoryTool(self.config.lessons_base_path)
        self.tools["list_directory"].category = "filesystem"
        
        self.tools["run_command"] = RunCommandTool(self.config.sandbox_mode)
        self.tools["run_command"].category = "system"
        
        self.tools["validate_lesson"] = ValidateLessonTool(self.config.lessons_base_path)
        self.tools["validate_lesson"].category = "validation"
        
        # Database and planning tools
        try:
            from .db_tools import QueryVocabularyTool, QueryLessonsTool, PlanTaskTool, MarkStepCompleteTool, GetPlanStatusTool, LoadLessonToDbTool
            
            # Database path is sibling to lessons directory (inside backend/)
            db_path = str(Path(self.config.lessons_base_path).parent / "language_learning.db")
            
            # The main app uses fluo.db for lessons
            fluo_db_path = str(Path(self.config.lessons_base_path).parent / "fluo.db")
            
            self.tools["query_vocabulary"] = QueryVocabularyTool(db_path)
            self.tools["query_vocabulary"].category = "database"
            
            self.tools["query_lessons"] = QueryLessonsTool(fluo_db_path)
            self.tools["query_lessons"].category = "database"
            
            self.tools["load_lesson_to_db"] = LoadLessonToDbTool(self.config.lessons_base_path, fluo_db_path)
            self.tools["load_lesson_to_db"].category = "database"
            
            # Planning tools share state
            plan_tool = PlanTaskTool()
            self.tools["plan_task"] = plan_tool
            self.tools["plan_task"].category = "planning"
            
            self.tools["mark_step_complete"] = MarkStepCompleteTool(plan_tool)
            self.tools["mark_step_complete"].category = "planning"
            
            self.tools["get_plan_status"] = GetPlanStatusTool(plan_tool)
            self.tools["get_plan_status"].category = "planning"
        except ImportError as e:
            print(f"Warning: Could not import database tools: {e}")
    
    def get_tool(self, name: str) -> Optional[Tool]:
        """Get a tool by name"""
        return self.tools.get(name)
    
    def get_all_tools(self) -> List[Dict[str, Any]]:
        """Get all tools as dictionaries for agent prompt"""
        return [tool.to_dict() for tool in self.tools.values()]
    
    def execute_tool(self, name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name with parameters"""
        tool = self.get_tool(name)
        if not tool:
            return {"success": False, "error": f"Tool not found: {name}"}
        
        try:
            return tool.execute(**parameters)
        except Exception as e:
            return {"success": False, "error": f"Tool execution failed: {str(e)}"}
