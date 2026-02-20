"""
Prompting templates for lesson grading
Loads prompts from template files
"""
from pathlib import Path


def _load_prompt_template(filename: str) -> str:
    """Load a prompt template from the templates directory"""
    template_dir = Path(__file__).parent / "templates"
    template_path = template_dir / filename
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Warning: Template {filename} not found")
        return ""


# Load the lesson free response grading prompt template
LESSON_FREE_RESPONSE_GRADING_PROMPT = _load_prompt_template("lesson_free_response_grading.txt")

# Fallback if template doesn't load
if not LESSON_FREE_RESPONSE_GRADING_PROMPT:
    LESSON_FREE_RESPONSE_GRADING_PROMPT = """You are an expert {language} teacher.

Student CEFR Level: {user_cefr_level}
Question: {question}
Student Answer: {user_answer}

Evaluate and return JSON:
{{"score": <0-100>, "feedback": "<feedback>"}}"""
