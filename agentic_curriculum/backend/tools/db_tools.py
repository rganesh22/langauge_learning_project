"""
Extended tools for database and vocabulary management
"""

import json
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional
from .tools import Tool


class QueryVocabularyTool(Tool):
    """Query the vocabulary database"""
    
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        super().__init__(
            name="query_vocabulary",
            description="Search for vocabulary words in the database by term, definition, or language. Returns word details including translations, SRS data, and usage examples.",
            parameters={
                "type": "object",
                "properties": {
                    "language": {
                        "type": "string",
                        "enum": ["ml", "kn", "ta", "te", "hi", "ur"],
                        "description": "Language code: 'ml' (Malayalam), 'kn' (Kannada), 'ta' (Tamil), 'te' (Telugu), 'hi' (Hindi), 'ur' (Urdu)"
                    },
                    "search_term": {
                        "type": "string",
                        "description": "Term to search for (searches in word, definition, transliteration)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 20)",
                        "default": 20
                    }
                },
                "required": ["language"]
            }
        )
    
    def execute(self, language: str, search_term: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
        """Execute vocabulary query"""
        try:
            if not self.db_path.exists():
                return {
                    "success": False,
                    "error": f"Database not found at {self.db_path}"
                }
            
            conn = sqlite3.connect(str(self.db_path))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            if search_term:
                # Search in word, definition, or transliteration
                query = """
                    SELECT 
                        v.*,
                        ws.level,
                        ws.times_seen,
                        ws.times_correct,
                        ws.last_review_date,
                        ws.next_review_date
                    FROM vocabulary v
                    LEFT JOIN word_states ws ON v.id = ws.word_id
                    WHERE v.language = ?
                    AND (
                        v.word LIKE ?
                        OR v.definition LIKE ?
                        OR v.transliteration LIKE ?
                    )
                    ORDER BY v.word
                    LIMIT ?
                """
                cursor.execute(query, (language, f"%{search_term}%", f"%{search_term}%", f"%{search_term}%", limit))
            else:
                # Get all words for language
                query = """
                    SELECT 
                        v.*,
                        ws.level,
                        ws.times_seen,
                        ws.times_correct,
                        ws.last_review_date,
                        ws.next_review_date
                    FROM vocabulary v
                    LEFT JOIN word_states ws ON v.id = ws.word_id
                    WHERE v.language = ?
                    ORDER BY v.word
                    LIMIT ?
                """
                cursor.execute(query, (language, limit))
            
            rows = cursor.fetchall()
            conn.close()
            
            words = []
            for row in rows:
                words.append({
                    "id": row["id"],
                    "word": row["word"],
                    "definition": row["definition"],
                    "transliteration": row["transliteration"],
                    "part_of_speech": row["part_of_speech"],
                    "example": row["example"],
                    "level": row["level"],
                    "times_seen": row["times_seen"],
                    "times_correct": row["times_correct"],
                    "last_review": row["last_review_date"],
                    "next_review": row["next_review_date"]
                })
            
            return {
                "success": True,
                "count": len(words),
                "words": words,
                "language": language,
                "search_term": search_term
            }
            
        except Exception as e:
            error_msg = str(e)
            if "no such table" in error_msg:
                return {
                    "success": False,
                    "error": f"Database table not found. The vocabulary database may not be set up. Use list_directory and read_file to browse lesson files directly instead.",
                    "suggestion": "Use list_directory to browse ml/unit_1_foundations/ and read_file to read lesson JSON files."
                }
            return {
                "success": False,
                "error": error_msg
            }


class QueryLessonsTool(Tool):
    """Query lessons from the database"""
    
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        super().__init__(
            name="query_lessons",
            description="Query lessons from the database by language, unit, or search term. Returns lesson metadata including completion status.",
            parameters={
                "type": "object",
                "properties": {
                    "language": {
                        "type": "string",
                        "enum": ["Malayalam", "Kannada", "Tamil", "Telugu", "Hindi", "Urdu"],
                        "description": "Language name: 'Malayalam', 'Kannada', 'Tamil', 'Telugu', 'Hindi', or 'Urdu'"
                    },
                    "unit": {
                        "type": "integer",
                        "description": "Unit number to filter by"
                    },
                    "search": {
                        "type": "string",
                        "description": "Search in lesson title or description"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 50)",
                        "default": 50
                    }
                },
                "required": ["language"]
            }
        )
    
    def execute(self, language: str, unit: Optional[int] = None, search: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
        """Execute lesson query"""
        try:
            if not self.db_path.exists():
                return {
                    "success": False,
                    "error": f"Database not found at {self.db_path}"
                }
            
            conn = sqlite3.connect(str(self.db_path))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Build query
            query_parts = ["SELECT * FROM lessons WHERE language = ?"]
            params = [language]
            
            if unit is not None:
                query_parts.append("AND unit = ?")
                params.append(unit)
            
            if search:
                query_parts.append("AND (lesson_title LIKE ? OR description LIKE ?)")
                params.extend([f"%{search}%", f"%{search}%"])
            
            query_parts.append("ORDER BY lesson_number")
            query_parts.append("LIMIT ?")
            params.append(limit)
            
            query = " ".join(query_parts)
            cursor.execute(query, params)
            
            rows = cursor.fetchall()
            conn.close()
            
            lessons = []
            for row in rows:
                lessons.append({
                    "lesson_number": row["lesson_number"],
                    "language": row["language"],
                    "lesson_title": row["lesson_title"],
                    "unit": row["unit"],
                    "description": row["description"],
                    "tags": row["tags"],
                    "file_path": row["file_path"]
                })
            
            return {
                "success": True,
                "count": len(lessons),
                "lessons": lessons,
                "filters": {
                    "language": language,
                    "unit": unit,
                    "search": search
                }
            }
            
        except Exception as e:
            error_msg = str(e)
            if "no such table" in error_msg:
                return {
                    "success": False,
                    "error": f"Database table not found. The lessons database may not be set up. Use list_directory and read_file to browse lesson files directly instead.",
                    "suggestion": "Use list_directory to browse ml/unit_1_foundations/ and read_file to read lesson JSON files."
                }
            return {
                "success": False,
                "error": error_msg
            }


class PlanTaskTool(Tool):
    """Create a structured plan for complex tasks"""
    
    def __init__(self):
        super().__init__(
            name="plan_task",
            description="Create a structured plan with numbered steps for complex tasks. Use this BEFORE starting multi-step operations. Returns a plan ID that can be referenced.",
            parameters={
                "type": "object",
                "properties": {
                    "goal": {
                        "type": "string",
                        "description": "The overall goal of the task"
                    },
                    "steps": {
                        "type": "array",
                        "description": "List of steps to complete the task",
                        "items": {
                            "type": "object",
                            "properties": {
                                "step_number": {"type": "integer"},
                                "description": {"type": "string"},
                                "status": {
                                    "type": "string",
                                    "enum": ["pending", "in_progress", "complete", "blocked"],
                                    "default": "pending"
                                }
                            }
                        }
                    }
                },
                "required": ["goal", "steps"]
            }
        )
        self.plans = {}
    
    def execute(self, goal: str = None, steps: list = None, task: str = None, **kwargs) -> Dict[str, Any]:
        """Create a plan. Accepts 'goal' or 'task' as the plan description."""
        import uuid
        plan_id = str(uuid.uuid4())[:8]
        
        # Accept either 'goal' or 'task' parameter
        plan_goal = goal or task or "Unnamed task"
        
        # Handle steps being None
        if steps is None:
            steps = []
        
        # Normalize steps - handle both string lists and object lists
        normalized_steps = []
        for i, step in enumerate(steps):
            if isinstance(step, str):
                normalized_steps.append({
                    "step_number": i + 1,
                    "description": step,
                    "status": "pending"
                })
            elif isinstance(step, dict):
                if "step_number" not in step:
                    step["step_number"] = i + 1
                if "status" not in step:
                    step["status"] = "pending"
                normalized_steps.append(step)
        
        plan = {
            "plan_id": plan_id,
            "goal": plan_goal,
            "steps": normalized_steps,
            "created_at": str(__import__('datetime').datetime.now()),
            "status": "in_progress"
        }
        
        self.plans[plan_id] = plan
        
        return {
            "success": True,
            "plan_id": plan_id,
            "plan": plan,
            "message": f"Plan created with {len(normalized_steps)} steps. Use mark_step_complete to update progress."
        }


class MarkStepCompleteTool(Tool):
    """Mark a plan step as complete or update its status"""
    
    def __init__(self, plan_tool: PlanTaskTool):
        self.plan_tool = plan_tool
        super().__init__(
            name="mark_step_complete",
            description="Mark a specific step in a plan as complete, in_progress, or blocked. Use this to track progress through multi-step tasks.",
            parameters={
                "type": "object",
                "properties": {
                    "plan_id": {
                        "type": "string",
                        "description": "The plan ID from plan_task"
                    },
                    "step_number": {
                        "type": "integer",
                        "description": "The step number to update"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "complete", "blocked"],
                        "description": "New status for the step"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Optional notes about the step completion"
                    }
                },
                "required": ["plan_id", "step_number", "status"]
            }
        )
    
    def execute(self, plan_id: str, step_number: int, status: str, notes: Optional[str] = None) -> Dict[str, Any]:
        """Mark step status"""
        if plan_id not in self.plan_tool.plans:
            return {
                "success": False,
                "error": f"Plan {plan_id} not found"
            }
        
        plan = self.plan_tool.plans[plan_id]
        
        # Find and update step
        step_found = False
        for step in plan["steps"]:
            if step["step_number"] == step_number:
                step["status"] = status
                if notes:
                    step["notes"] = notes
                step["updated_at"] = str(__import__('datetime').datetime.now())
                step_found = True
                break
        
        if not step_found:
            return {
                "success": False,
                "error": f"Step {step_number} not found in plan"
            }
        
        # Check if all steps are complete
        all_complete = all(s["status"] == "complete" for s in plan["steps"])
        if all_complete:
            plan["status"] = "complete"
            plan["completed_at"] = str(__import__('datetime').datetime.now())
        
        # Count progress
        completed = sum(1 for s in plan["steps"] if s["status"] == "complete")
        total = len(plan["steps"])
        
        return {
            "success": True,
            "plan_id": plan_id,
            "step_number": step_number,
            "new_status": status,
            "progress": f"{completed}/{total} steps complete",
            "plan_complete": all_complete,
            "current_plan": plan
        }


class GetPlanStatusTool(Tool):
    """Get the current status of a plan"""
    
    def __init__(self, plan_tool: PlanTaskTool):
        self.plan_tool = plan_tool
        super().__init__(
            name="get_plan_status",
            description="Retrieve the current status of a plan, including which steps are complete, in progress, or pending.",
            parameters={
                "type": "object",
                "properties": {
                    "plan_id": {
                        "type": "string",
                        "description": "The plan ID to check"
                    }
                },
                "required": ["plan_id"]
            }
        )
    
    def execute(self, plan_id: str) -> Dict[str, Any]:
        """Get plan status"""
        if plan_id not in self.plan_tool.plans:
            return {
                "success": False,
                "error": f"Plan {plan_id} not found"
            }
        
        plan = self.plan_tool.plans[plan_id]
        
        # Count statuses
        status_counts = {
            "pending": 0,
            "in_progress": 0,
            "complete": 0,
            "blocked": 0
        }
        
        for step in plan["steps"]:
            status_counts[step["status"]] += 1
        
        return {
            "success": True,
            "plan": plan,
            "summary": {
                "total_steps": len(plan["steps"]),
                "completed": status_counts["complete"],
                "in_progress": status_counts["in_progress"],
                "pending": status_counts["pending"],
                "blocked": status_counts["blocked"],
                "overall_status": plan["status"]
            }
        }


class LoadLessonToDbTool(Tool):
    """Load a lesson JSON file into the language learning database"""
    
    def __init__(self, base_path: str, db_path: str):
        self.base_path = Path(base_path)
        self.db_path = Path(db_path)
        super().__init__(
            name="load_lesson_to_db",
            description=(
                "Load a lesson JSON file into the language learning database. "
                "Use this AFTER creating and validating a lesson file. "
                "Reads the JSON file, validates required fields, and inserts/updates it in the database. "
                "If the lesson already exists (same lesson_id), it will be updated."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "lesson_path": {
                        "type": "string",
                        "description": "Relative path to the lesson JSON file (e.g., 'ml/unit_1_foundations/31_daily_routines.json')"
                    }
                },
                "required": ["lesson_path"]
            }
        )
    
    def execute(self, lesson_path: str) -> Dict[str, Any]:
        """Load a lesson file into the database"""
        try:
            file_path = self.base_path / lesson_path
            
            if not file_path.exists():
                return {"success": False, "error": f"Lesson file not found: {lesson_path}"}
            
            # Read and parse the lesson JSON
            with open(file_path, 'r', encoding='utf-8') as f:
                lesson_data = json.load(f)
            
            # Validate required fields
            required_fields = ['lesson_id', 'title', 'language', 'steps']
            missing = [f for f in required_fields if f not in lesson_data]
            if missing:
                return {
                    "success": False,
                    "error": f"Missing required fields: {', '.join(missing)}"
                }
            
            # Handle cefr_level vs level
            level = lesson_data.get('level') or lesson_data.get('cefr_level')
            if not level:
                return {
                    "success": False,
                    "error": "Missing 'level' or 'cefr_level' field"
                }
            
            # Extract optional fields
            unit_id = lesson_data.get('unit_id')
            lesson_number = lesson_data.get('lesson_number')
            
            # Try to infer unit_id from the file path if not in JSON
            # e.g., ml/unit_1_foundations/31_daily_routines.json -> "unit_1_foundations"
            if not unit_id:
                path_parts = Path(lesson_path).parts
                if len(path_parts) >= 2:
                    unit_id = path_parts[-2]  # e.g., "unit_1_foundations"
            
            # Try to infer lesson_number from filename if not in JSON
            # e.g., 31_daily_routines.json -> 31
            if lesson_number is None:
                filename = Path(lesson_path).stem
                try:
                    lesson_number = int(filename.split('_')[0])
                except (ValueError, IndexError):
                    pass
            
            # Connect to database and insert/update
            if not self.db_path.exists():
                return {
                    "success": False,
                    "error": f"Database not found at {self.db_path}"
                }
            
            conn = sqlite3.connect(str(self.db_path), timeout=10.0)
            cursor = conn.cursor()
            
            from datetime import datetime
            now = datetime.now().isoformat()
            steps_json = json.dumps(lesson_data['steps'])
            
            try:
                cursor.execute('''
                    INSERT INTO lessons (lesson_id, title, language, level, unit_id, lesson_number, steps_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    lesson_data['lesson_id'],
                    lesson_data['title'],
                    lesson_data['language'],
                    level,
                    unit_id,
                    lesson_number,
                    steps_json,
                    now,
                    now
                ))
                action = "inserted"
            except sqlite3.IntegrityError:
                # Lesson already exists, update it
                cursor.execute('''
                    UPDATE lessons 
                    SET title = ?, language = ?, level = ?, unit_id = ?, lesson_number = ?, steps_json = ?, updated_at = ?
                    WHERE lesson_id = ?
                ''', (
                    lesson_data['title'],
                    lesson_data['language'],
                    level,
                    unit_id,
                    lesson_number,
                    steps_json,
                    now,
                    lesson_data['lesson_id']
                ))
                action = "updated"
            
            conn.commit()
            conn.close()
            
            return {
                "success": True,
                "action": action,
                "lesson_id": lesson_data['lesson_id'],
                "title": lesson_data['title'],
                "language": lesson_data['language'],
                "level": level,
                "steps_count": len(lesson_data['steps']),
                "message": f"Lesson '{lesson_data['title']}' ({lesson_data['lesson_id']}) {action} in database"
            }
            
        except json.JSONDecodeError as e:
            return {"success": False, "error": f"Invalid JSON in lesson file: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to load lesson: {str(e)}"}