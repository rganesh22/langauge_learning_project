"""
Prompting templates for unified practice activities
Loads prompts from template files
"""
from pathlib import Path

def _load_prompt_template(filename: str) -> str:
    """Load a prompt template from the templates/activities directory"""
    template_dir = Path(__file__).parent / "templates" / "activities"
    template_path = template_dir / filename
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Warning: Template {filename} not found")
        return ""

UNIFIED_TRANSLITERATION_PROMPT = _load_prompt_template("unified_transliteration.txt")
UNIFIED_READING_PROMPT = _load_prompt_template("unified_reading.txt")
UNIFIED_LISTENING_PROMPT = _load_prompt_template("unified_listening.txt")
UNIFIED_WRITING_PROMPT = _load_prompt_template("unified_writing.txt")
UNIFIED_SPEAKING_PROMPT = _load_prompt_template("unified_speaking.txt")
UNIFIED_TRANSLATION_PROMPT = _load_prompt_template("unified_translation.txt")
UNIFIED_CONVERSATION_PROMPT = _load_prompt_template("unified_conversation.txt")
