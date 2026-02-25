"""
Prompt templates for Gemini API interactions
"""
from .template_renderer import render_template, get_template_path
from .placement_prompts import PLACEMENT_TEST_GENERATE_PROMPT, PLACEMENT_TEST_ANALYZE_PROMPT

__all__ = [
    'render_template',
    'get_template_path',
    'PLACEMENT_TEST_GENERATE_PROMPT',
    'PLACEMENT_TEST_ANALYZE_PROMPT',
]
