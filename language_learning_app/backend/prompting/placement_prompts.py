"""
Prompting templates for placement test generation and analysis.
Loads prompts from template files.
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


PLACEMENT_TEST_GENERATE_PROMPT = _load_prompt_template("placement_test_generate.txt")
PLACEMENT_TEST_ANALYZE_PROMPT = _load_prompt_template("placement_test_analyze.txt")
