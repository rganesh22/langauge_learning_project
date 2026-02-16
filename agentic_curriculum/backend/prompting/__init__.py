"""
Prompting module for the agentic curriculum system.
Contains all prompt templates and prompt-related utilities.
"""

from .prompts import (
    SYSTEM_PROMPT_TEMPLATE,
    FALLBACK_README_SECTION,
    CONTEXT_SUMMARIZATION_PROMPT,
    load_prompt_file
)

__all__ = [
    'SYSTEM_PROMPT_TEMPLATE',
    'FALLBACK_README_SECTION',
    'CONTEXT_SUMMARIZATION_PROMPT',
    'load_prompt_file'
]
