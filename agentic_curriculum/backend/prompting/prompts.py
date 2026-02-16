# React Agent Prompt Loading
# All prompts are loaded from text files
from pathlib import Path

def load_prompt_file(filename: str) -> str:
    """Load a prompt from a text file in the prompts subdirectory"""
    prompt_path = Path(__file__).parent / "prompts" / filename
    try:
        return prompt_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Warning: Failed to load {filename}: {e}")
        return ""

# Load all prompts from files in prompts/ subdirectory
SYSTEM_PROMPT_BASE = load_prompt_file("system_prompt.txt")
CONTEXT_SUMMARIZATION_PROMPT = load_prompt_file("context_summarization_prompt.txt")
FALLBACK_README_SECTION = load_prompt_file("lesson_format_spec.txt")

# Template for building full system prompt - loaded from file
SYSTEM_PROMPT_TEMPLATE = load_prompt_file("system_prompt_template.txt")
