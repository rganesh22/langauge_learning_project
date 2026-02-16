"""
ReAct (Reasoning + Acting) Agent Implementation
Follows the ReAct framework: Thought -> Action -> Observation loop
"""

import asyncio
import json
import re
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from enum import Enum
import google.generativeai as genai

from ..config import settings, get_model_cost
from ..tools.tools import ToolRegistry
from ..prompting.prompts import (
    SYSTEM_PROMPT_TEMPLATE,
    FALLBACK_README_SECTION
)
from ..services.context_summarization import ContextSummarizer


class AgentState(Enum):
    """Agent execution states"""
    IDLE = "idle"
    THINKING = "thinking"
    ACTING = "acting"
    OBSERVING = "observing"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ReActAgent:
    """
    ReAct Agent that reasons about tasks and executes actions using tools
    """
    
    def __init__(
        self,
        task_id: str,
        prompt: str,
        config: Dict[str, Any],
        status_callback: Optional[Callable] = None
    ):
        self.task_id = task_id
        self.prompt = prompt
        self.config = config
        self.status_callback = status_callback
        
        # Initialize Gemini
        genai.configure(api_key=settings.google_api_key)
        self.model = genai.GenerativeModel(config.get("model", settings.default_model))
        
        # Initialize tools
        self.tool_registry = ToolRegistry(settings)
        
        # Initialize context summarization with config
        context_config = config.get("context_summarization", {})
        self.context_summarizer = ContextSummarizer(
            model_name=context_config.get("model", "gemini-2.5-flash"),
            token_threshold=context_config.get("token_threshold", 100000),
            target_token_count=context_config.get("target_token_count", 50000),
            min_messages=context_config.get("min_messages_before_summarize", 15),
            compression_ratio=context_config.get("compression_ratio", 50)
        )
        self.enable_context_summarization = config.get("enable_context_summarization", True)
        
        # State
        self.state = AgentState.IDLE
        self.iterations = 0
        self.max_iterations = config.get("max_iterations", settings.max_iterations)
        self.history: List[Dict[str, Any]] = []
        self.total_cost = 0.0
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self._finish_verification_done = False  # Track if we've already prompted for verification
        
    def _emit_status(self, event_type: str, data: Dict[str, Any]):
        """Emit status update to callback"""
        if self.status_callback:
            self.status_callback({
                "task_id": self.task_id,
                "event": event_type,
                "timestamp": datetime.utcnow().isoformat(),
                "data": data
            })
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt with ReAct instructions and tools"""
        # Get custom system prompt or use default
        from backend.prompting.prompts import SYSTEM_PROMPT_BASE, SYSTEM_PROMPT_TEMPLATE
        
        system_prompt = self.config.get("system_prompt", SYSTEM_PROMPT_BASE)
        
        tools_desc = "\n\n".join([
            f"**{tool['name']}**\n{tool['description']}\nParameters: {json.dumps(tool['parameters'], indent=2)}"
            for tool in self.tool_registry.get_all_tools()
        ])
        
        # Check if we should include README
        include_readme = self.config.get("include_readme", True)
        readme_section = ""
        
        if include_readme:
            # Try to read the optimized lesson format spec
            try:
                from backend.prompting.prompts import FALLBACK_README_SECTION
                readme_section = f"""

LESSON FORMAT SPECIFICATION:

{FALLBACK_README_SECTION}

---

"""
            except Exception as e:
                # If spec can't be loaded, provide minimal guidance
                print(f"Warning: Could not load lesson format spec: {e}")
                readme_section = """

LESSON FORMAT SPECIFICATION:

Lessons must be valid JSON with required fields: lesson_id, language, title, description, estimated_minutes, cefr_level, tags, skills_learned, steps.
Mobile-first design: Keep step titles short (3-4 words), tables max 3 columns.

---

"""
        
        return SYSTEM_PROMPT_TEMPLATE.format(
            system_prompt=system_prompt,
            task=self.prompt,
            tools_description=tools_desc,
            readme_section=readme_section
        )
    
    def _parse_response(self, text: str) -> Dict[str, Any]:
        """Parse agent's response to extract thought, action(s), or finish"""
        # Check for finish - MUST be at start of line (not in middle of thought)
        finish_match = re.search(r'(?:^|\n)\s*Finish:\s*(.+?)(?:\n|$)', text, re.IGNORECASE | re.DOTALL)
        if finish_match:
            return {
                "type": "finish",
                "content": finish_match.group(1).strip()
            }
        
        # Extract thought - look for "Thought:" at start of line
        thought_match = re.search(r'(?:^|\n)\s*Thought:\s*(.+?)(?=\n\s*Action:|\n\s*Finish:|$)', text, re.IGNORECASE | re.DOTALL)
        thought = thought_match.group(1).strip() if thought_match else ""
        
        # Extract all actions - NEW FORMAT: Action: {"tool_name": "...", "params": {...}}
        # Use a bracket-balancing approach to handle nested JSON properly
        action_pattern = re.compile(r'(?:^|\n)\s*Action:\s*(\{)', re.IGNORECASE)
        
        actions = []
        for action_start in action_pattern.finditer(text):
            # Find the matching closing brace using bracket counting
            start_pos = action_start.start(1)
            depth = 0
            in_string = False
            escape_next = False
            end_pos = start_pos
            
            for i in range(start_pos, len(text)):
                char = text[i]
                if escape_next:
                    escape_next = False
                    continue
                if char == '\\' and in_string:
                    escape_next = True
                    continue
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if char == '{':
                    depth += 1
                elif char == '}':
                    depth -= 1
                    if depth == 0:
                        end_pos = i + 1
                        break
            
            if depth != 0:
                print(f"Warning: Unbalanced braces in action JSON")
                continue
            
            json_str = text[start_pos:end_pos].strip()
            
            # Try to parse as JSON, with escape-fixing fallback
            action_obj = None
            parse_error = None
            try:
                action_obj = json.loads(json_str)
            except json.JSONDecodeError:
                # Fix invalid escape sequences from LLM output
                # Replace invalid \X escapes with \\X (except valid ones: \n \t \r \b \f \\ \" \/ \uXXXX)
                def _fix_escapes(s):
                    return re.sub(r'\\(?![ntrfbu"\\/])', r'\\\\', s)
                fixed_json = _fix_escapes(json_str)
                try:
                    action_obj = json.loads(fixed_json)
                    print(f"Info: Fixed invalid escape sequences in action JSON")
                except json.JSONDecodeError as e2:
                    parse_error = e2
            
            if action_obj is None:
                # JSON parsing completely failed - try fallback
                print(f"Warning: Failed to parse action JSON: {json_str[:200]}\nError: {parse_error}")
                
                # FALLBACK: Try old format for backwards compatibility
                # Action: tool_name {"param": "value"}
                old_format_match = re.match(r'(\w+)\s*(\{.+\})', json_str, re.DOTALL)
                if old_format_match:
                    tool_name = old_format_match.group(1)
                    params_str = old_format_match.group(2)
                    try:
                        parameters = json.loads(params_str)
                        actions.append({
                            "tool": tool_name,
                            "parameters": parameters
                        })
                        print(f"Warning: Used fallback parsing for old format: {tool_name}")
                    except:
                        print(f"Error: Could not parse even with fallback: {json_str[:200]}")
                continue
                
            # Validate structure: must have "tool_name" and "params"
            if not isinstance(action_obj, dict):
                print(f"Warning: Action is not a dict: {action_obj}")
                continue
            
            if "tool_name" not in action_obj:
                print(f"Warning: Action missing 'tool_name': {action_obj}")
                continue
            
            # "params" is optional - default to empty dict if not present
            params = action_obj.get("params", {})
            if not isinstance(params, dict):
                print(f"Warning: params is not a dict: {params}")
                params = {}
            
            actions.append({
                "tool": action_obj["tool_name"],
                "parameters": params
            })
        
        if actions:
            return {
                "type": "action",
                "thought": thought,
                "actions": actions  # Now supports multiple actions
            }
        
        # Default: just thought
        return {
            "type": "thought",
            "content": thought if thought else text
        }
    
    def _execute_action(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool action (synchronous - called from thread when needed)"""
        self.state = AgentState.ACTING
        self._emit_status("action", {
            "tool": tool_name,
            "parameters": parameters
        })
        
        result = self.tool_registry.execute_tool(tool_name, parameters)
        
        self.state = AgentState.OBSERVING
        self._emit_status("observation", {
            "result": result
        })
        
        return result
    
    async def _execute_action_async(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool action asynchronously (wraps sync tool in thread)"""
        self.state = AgentState.ACTING
        self._emit_status("action", {
            "tool": tool_name,
            "parameters": parameters
        })
        
        # Run synchronous tool execution in thread pool to not block event loop
        result = await asyncio.to_thread(
            self.tool_registry.execute_tool, tool_name, parameters
        )
        
        self.state = AgentState.OBSERVING
        self._emit_status("observation", {
            "result": result
        })
        
        return result
    
    async def run(self) -> Dict[str, Any]:
        """Run the ReAct loop"""
        try:
            self.state = AgentState.THINKING
            
            # Build initial conversation
            system_prompt = self._build_system_prompt()
            
            self._emit_status("start", {
                "prompt": self.prompt,
                "config": self.config,
                "max_iterations": self.max_iterations,
                "system_prompt": system_prompt
            })
            
            conversation_history = [system_prompt]
            
            while self.iterations < self.max_iterations:
                # Check if cancelled
                if self.state == AgentState.CANCELLED:
                    self._emit_status("cancelled", {
                        "iterations": self.iterations,
                        "total_cost": self.total_cost
                    })
                    return {
                        "success": False,
                        "state": "cancelled",
                        "message": "Task was cancelled",
                        "iterations": self.iterations,
                        "total_cost": self.total_cost,
                        "history": self.history
                    }
                
                self.iterations += 1
                    
                self._emit_status("iteration", {
                    "number": self.iterations,
                    "max": self.max_iterations
                })
                
                # Add iteration context to conversation
                iteration_context = f"\n[Iteration {self.iterations} of {self.max_iterations}]\n"
                
                # Generate response
                self.state = AgentState.THINKING
                
                # Run the synchronous generate_content in a thread pool
                # so it doesn't block the asyncio event loop
                prompt_text = "\n\n".join(conversation_history) + iteration_context
                gen_config = {
                    "temperature": self.config.get("temperature", settings.temperature),
                    "max_output_tokens": self.config.get("max_tokens", settings.max_tokens)
                }
                response = await asyncio.to_thread(
                    self.model.generate_content,
                    prompt_text,
                    generation_config=gen_config
                )
                
                # Track tokens and cost
                if hasattr(response, 'usage_metadata'):
                    input_tokens = response.usage_metadata.prompt_token_count
                    output_tokens = response.usage_metadata.candidates_token_count
                    self.total_input_tokens += input_tokens
                    self.total_output_tokens += output_tokens
                    
                    cost = get_model_cost(
                        self.config.get("model", settings.default_model),
                        input_tokens,
                        output_tokens
                    )
                    self.total_cost += cost
                    
                    self._emit_status("cost_update", {
                        "iteration_cost": cost,
                        "total_cost": self.total_cost,
                        "input_tokens": self.total_input_tokens,
                        "output_tokens": self.total_output_tokens
                    })
                
                response_text = response.text
                
                # Parse response
                try:
                    parsed = self._parse_response(response_text)
                except Exception as parse_error:
                    print(f"ERROR parsing response: {parse_error}")
                    print(f"Response text: {response_text[:500]}")
                    parsed = {
                        "type": "thought",
                        "content": response_text
                    }
                
                # CRITICAL: Prevent first-iteration hallucination
                # If this is iteration 1 and the model outputs "Finish:" without any actions, REJECT it
                if self.iterations == 1 and parsed.get("type") == "finish":
                    observation_text = f"""\nObservation: ❌ REJECTED - You cannot finish on the first iteration without executing any actions.

You MUST start by creating a plan. Use this EXACT format:

Thought: I need to break down this task into actionable steps.
Action: {{"tool_name": "plan_task", "params": {{"task": "your task description", "steps": ["step 1", "step 2", "step 3"]}}}}

Then wait for my Observation before proceeding."""
                    
                    conversation_history.append(response_text)
                    conversation_history.append(observation_text)
                    continue
                
                # Emit thought for all response types
                self._emit_status("thought", {
                    "content": parsed.get("thought", parsed.get("content", "")) if isinstance(parsed, dict) else str(parsed),
                    "iteration": self.iterations
                })
                
                # Add to history
                self.history.append({
                    "iteration": self.iterations,
                    "type": parsed.get("type", "unknown") if isinstance(parsed, dict) else "thought",
                    "content": parsed,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
                # --- Handle FINISH ---
                if isinstance(parsed, dict) and parsed.get("type") == "finish":
                    finish_content = parsed.get("content", "").lower() if isinstance(parsed.get("content"), str) else ""
                    hallucination_keywords = ["created", "modified", "edited", "wrote", "updated", "generated", "saved"]
                    
                    # If finishing with claims of file operations, verify actions were actually taken
                    if any(keyword in finish_content for keyword in hallucination_keywords):
                        action_count = sum(1 for h in self.history if h.get("type") == "action")
                        
                        if action_count == 0:
                            observation_text = f"""\nObservation: ❌ HALLUCINATION DETECTED - You claim to have created/modified files, but you haven't executed ANY actions yet.

You must actually call the tools using the correct JSON format:

Thought: I need to read the existing files first.
Action: {{"tool_name": "list_directory", "params": {{"path": "."}}}}

Wait for my Observation, then proceed with the next action.

Do NOT claim you've done things without receiving Observation confirmations."""
                            
                            conversation_history.append(response_text)
                            conversation_history.append(observation_text)
                            continue
                    
                    # --- SINGLE VERIFICATION ON FINISH ---
                    # Only prompt for verification ONCE. If we already verified, accept the finish.
                    if not self._finish_verification_done and self.iterations < self.max_iterations - 1:
                        # Check plan completion status first
                        plan_status_text = self._get_all_plans_status()
                        incomplete_plans = self._has_incomplete_plans()
                        
                        if incomplete_plans:
                            # Reject finish - there are incomplete plan steps
                            plan_rejection = f"""\nObservation: ❌ CANNOT FINISH - You have incomplete plan steps.

{plan_status_text}

You MUST complete all plan steps before finishing. Use mark_step_complete to update steps as you finish them.
If a step is no longer needed, mark it as "complete" with a note explaining why.

Continue with Thought -> Action to complete remaining work."""
                            
                            conversation_history.append(response_text)
                            conversation_history.append(plan_rejection)
                            continue
                        
                        self._finish_verification_done = True
                        
                        from backend.prompting.prompts import load_prompt_file
                        verification_template = load_prompt_file("finish_verification_prompt.txt")
                        
                        reflection_prompt = verification_template.format(
                            task=self.prompt,
                            completion_summary=parsed.get("content", ""),
                            plan_status=plan_status_text,
                            iterations=self.iterations,
                            max_iterations=self.max_iterations,
                            total_cost=self.total_cost
                        )
                        
                        conversation_history.append(response_text)
                        conversation_history.append(reflection_prompt)
                        
                        self._emit_status("finish_reflection", {
                            "iteration": self.iterations,
                            "summary": parsed.get("content", "")
                        })
                        
                        # Continue the loop to get the model's verification response
                        continue
                    
                    # Legitimate finish (either verified or at max iterations)
                    self.state = AgentState.COMPLETE
                    self._emit_status("complete", {
                        "summary": parsed.get("content", "Task completed"),
                        "iterations": self.iterations,
                        "total_cost": self.total_cost
                    })
                    
                    return {
                        "success": True,
                        "state": "complete",
                        "summary": parsed.get("content", "Task completed"),
                        "iterations": self.iterations,
                        "total_cost": self.total_cost,
                        "history": self.history
                    }
                
                # --- Handle ACTION ---
                elif isinstance(parsed, dict) and parsed.get("type") == "action":
                    # If model continues working after a finish verification, reset the flag
                    if self._finish_verification_done:
                        self._finish_verification_done = False
                    
                    observations = []
                    for action in parsed.get("actions", []):
                        observation = await self._execute_action_async(action["tool"], action["parameters"])
                        observations.append({
                            "tool": action["tool"],
                            "result": observation
                        })
                    
                    # Format observations
                    if len(observations) == 1:
                        observation_text = f"\nObservation: {json.dumps(observations[0]['result'], indent=2)}\n\nContinue with next Thought -> Action or Finish if done."
                    else:
                        obs_parts = [f"\nObservations from {len(observations)} actions:"]
                        for i, obs in enumerate(observations, 1):
                            obs_parts.append(f"\n{i}. {obs['tool']}: {json.dumps(obs['result'], indent=2)}")
                        obs_parts.append("\n\nContinue with next Thought -> Action or Finish if done.")
                        observation_text = "".join(obs_parts)
                    
                    conversation_history.append(response_text)
                    conversation_history.append(observation_text)
                    
                    # --- REFLECTION STEP ---
                    # Every 3 iterations, trigger a reflection to keep the agent grounded
                    if self.iterations > 0 and self.iterations % 3 == 0:
                        tools_used = [obs["tool"] for obs in observations]
                        plan_status_text = self._get_all_plans_status()
                        reflection_prompt = f"""\n[REFLECTION - Iteration {self.iterations}/{self.max_iterations}]
Before continuing, take a moment to reflect on your progress:

1. **What have I accomplished so far?** Summarize the key actions taken and their outcomes.
2. **Am I on track?** Is my approach working, or do I need to adjust my strategy?
3. **What's the most important next step?** Prioritize what to do next.
4. **Am I being efficient?** Have I been repeating actions or going in circles?

**Current Plan Status (checked at iteration {self.iterations}):**
{plan_status_text}

⚠️ Remember: ALL plan steps must be marked "complete" before you can Finish.
If any steps are still pending or in_progress, focus on completing them.
If a step is no longer relevant, mark it "complete" with notes explaining why.

Last action(s): {', '.join(tools_used)}
Iterations used: {self.iterations}/{self.max_iterations} ({round(self.iterations/self.max_iterations*100)}%)
Cost so far: ${self.total_cost:.4f}

Provide a brief Reflection, then continue with your next Thought -> Action."""
                        
                        conversation_history.append(reflection_prompt)
                        
                        self._emit_status("reflection", {
                            "iteration": self.iterations,
                            "tools_used": tools_used,
                            "progress_pct": round(self.iterations / self.max_iterations * 100)
                        })
                
                # --- Handle THOUGHT (no action) ---
                else:
                    conversation_history.append(response_text)
                    # Nudge the agent to take an action
                    conversation_history.append("\nObservation: You provided a thought but no Action. Please provide an Action using the JSON format:\n\nAction: {\"tool_name\": \"tool_name_here\", \"params\": {\"param\": \"value\"}}\n")
                
                # Check if context summarization is needed
                if self.enable_context_summarization and self.context_summarizer.should_summarize(conversation_history):
                    before_stats = self.context_summarizer.get_context_stats(conversation_history)
                    before_count = len(conversation_history)
                    
                    self._emit_status("context_summarization", {
                        "iteration": self.iterations,
                        "before_count": before_count,
                        "before_tokens": before_stats.get("estimated_tokens", 0),
                        "before_messages": before_stats.get("total_messages", 0),
                        "reason": f"Context exceeded {self.context_summarizer.token_threshold:,} token threshold"
                    })
                    
                    # Run synchronous summarization in thread pool
                    conversation_history = await asyncio.to_thread(
                        self.context_summarizer.summarize_conversation, conversation_history
                    )
                    
                    after_stats = self.context_summarizer.get_context_stats(conversation_history)
                    after_count = len(conversation_history)
                    
                    self._emit_status("context_summarized", {
                        "iteration": self.iterations,
                        "before_count": before_count,
                        "after_count": after_count,
                        "before_tokens": before_stats.get("estimated_tokens", 0),
                        "after_tokens": after_stats.get("estimated_tokens", 0),
                        "messages_removed": before_count - after_count,
                        "tokens_saved": before_stats.get("estimated_tokens", 0) - after_stats.get("estimated_tokens", 0),
                        "compression_pct": round((1 - after_stats.get("estimated_tokens", 1) / max(1, before_stats.get("estimated_tokens", 1))) * 100),
                        "stats": after_stats
                    })
            
            # Max iterations reached
            self.state = AgentState.COMPLETE
            self._emit_status("max_iterations", {
                "iterations": self.iterations,
                "total_cost": self.total_cost
            })
            
            return {
                "success": True,
                "state": "max_iterations_reached",
                "summary": f"Completed {self.iterations} iterations",
                "iterations": self.iterations,
                "total_cost": self.total_cost,
                "history": self.history
            }
            
        except Exception as e:
            self.state = AgentState.FAILED
            self._emit_status("error", {
                "error": str(e),
                "iterations": self.iterations
            })
            
            return {
                "success": False,
                "state": "failed",
                "error": str(e),
                "iterations": self.iterations,
                "total_cost": self.total_cost,
                "history": self.history
            }
    
    def cancel(self):
        """Cancel the agent execution"""
        self.state = AgentState.CANCELLED
        self._emit_status("cancelled", {
            "iterations": self.iterations,
            "total_cost": self.total_cost
        })
    
    def _get_all_plans_status(self) -> str:
        """Get a formatted string of all plan statuses"""
        try:
            plan_tool = self.tool_registry.get_tool("plan_task")
            if not plan_tool or not hasattr(plan_tool, 'plans') or not plan_tool.plans:
                return "No plans created yet."
            
            parts = []
            for plan_id, plan in plan_tool.plans.items():
                completed = sum(1 for s in plan["steps"] if s["status"] == "complete")
                total = len(plan["steps"])
                parts.append(f"Plan '{plan['goal']}' ({plan_id}): {completed}/{total} steps complete")
                for step in plan["steps"]:
                    icon = "✅" if step["status"] == "complete" else "🔄" if step["status"] == "in_progress" else "⬜" if step["status"] == "pending" else "🚫"
                    parts.append(f"  {icon} Step {step['step_number']}: {step['description']} [{step['status']}]")
            return "\n".join(parts)
        except Exception as e:
            return f"Could not retrieve plan status: {e}"
    
    def _has_incomplete_plans(self) -> bool:
        """Check if any plan has incomplete steps"""
        try:
            plan_tool = self.tool_registry.get_tool("plan_task")
            if not plan_tool or not hasattr(plan_tool, 'plans') or not plan_tool.plans:
                return False  # No plans = nothing to check
            
            for plan in plan_tool.plans.values():
                if plan.get("status") != "complete":
                    # Check if any step is not complete
                    for step in plan["steps"]:
                        if step["status"] != "complete":
                            return True
            return False
        except Exception:
            return False
