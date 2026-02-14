"""
Template renderer for prompt templates
Loads templates from files and hydrates them with provided values
"""
import os
from pathlib import Path


def get_template_path(template_name: str) -> str:
    """Get the full path to a template file
    
    Args:
        template_name: Name of the template file (e.g., 'reading_activity.txt')
    
    Returns:
        Full path to the template file
    """
    # Get the directory where this module is located
    current_dir = Path(__file__).parent
    template_path = current_dir / 'templates' / template_name
    return str(template_path)


def render_template(template_name: str, **kwargs) -> str:
    """Render a template file with provided values
    
    Args:
        template_name: Name of the template file (e.g., 'reading_activity.txt')
        **kwargs: Variables to substitute in the template
    
    Returns:
        Rendered template string
    """
    template_path = get_template_path(template_name)
    
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found: {template_path}")
    
    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()
    
    # Use .format() for template substitution
    # This supports {variable_name} syntax
    try:
        rendered = template_content.format(**kwargs)
        return rendered
    except KeyError as e:
        raise ValueError(f"Missing required template variable: {e}")
    except Exception as e:
        raise ValueError(f"Error rendering template: {e}")
