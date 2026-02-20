"""
Prompts for vocabulary import from text
Loads prompts from template files
"""
import os
from pathlib import Path


def _load_prompt_template(filename: str) -> str:
    """Load a prompt template from the prompting/templates/vocab_import directory"""
    template_dir = Path(__file__).parent / "templates" / "vocab_import"
    template_path = template_dir / filename
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Warning: Template {filename} not found, using fallback")
        return ""


def get_lemmatization_prompt(language: str, words: list) -> str:
    """Generate lemmatization prompt for a batch of words
    
    Args:
        language: Target language
        words: List of words to lemmatize (already split by spaces)
    
    Returns:
        Formatted prompt string
    """
    # Load template for the specific language (files are named e.g. kannada.txt)
    template_file = f"lemmatization/{language.lower()}.txt"
    template = _load_prompt_template(template_file)
    
    # Fallback to kannada if template not found
    if not template:
        template = _load_prompt_template("lemmatization/kannada.txt")
    
    # Format the template with actual values
    prompt = template.format(
        language=language,
        words=', '.join(words)
    )
    
    return prompt


def get_translation_prompt(language: str, words: list, target_languages: list) -> str:
    """Generate translation prompt for a batch of words
    
    Args:
        language: Source language
        words: List of words to translate (with word_class)
        target_languages: Languages to translate to
    
    Returns:
        Formatted prompt string
    """
    word_list = ', '.join([w['word'] for w in words])
    other_langs = [lang for lang in target_languages if lang != language]
    target_langs_str = ', '.join(other_langs) if other_langs else 'none'
    
    # Load translation template (in vocab_import folder)
    template = _load_prompt_template("translation.txt")
    
    # Format the template
    prompt = template.format(
        source_language=language,
        target_languages=target_langs_str,
        words=word_list
    )
    
    return prompt
