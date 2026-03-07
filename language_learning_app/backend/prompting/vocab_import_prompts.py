"""
Prompts for vocabulary import from text
Loads combined lemmatization+translation prompts from template files
"""
import os
from pathlib import Path

# Map full language names (as used in the app) to 2-letter ISO codes
LANGUAGE_CODE_MAP = {
    'kannada': 'kn',
    'malayalam': 'ml',
    'tamil': 'ta',
    'telugu': 'te',
    'hindi': 'hi',
    'urdu': 'ur',
}


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


def get_lemmatization_translation_prompt(language: str, words: list) -> str:
    """Generate a combined lemmatization + translation prompt for a batch of words
    
    Args:
        language: Target language (full name, e.g. 'kannada')
        words: List of word strings to process
    
    Returns:
        Formatted prompt string
    """
    lang_code = LANGUAGE_CODE_MAP.get(language.lower(), language.lower()[:2])
    template_file = f"lemmatization_translation_{lang_code}.txt"
    template = _load_prompt_template(template_file)
    
    # Fallback to kannada if template not found
    if not template:
        template = _load_prompt_template("lemmatization_translation_kn.txt")
    
    # Format the template with actual values
    prompt = template.format(
        words=', '.join(words)
    )
    
    return prompt


# Keep old functions for backward compatibility
def get_lemmatization_prompt(language: str, words: list) -> str:
    """Deprecated: Use get_lemmatization_translation_prompt instead."""
    return get_lemmatization_translation_prompt(language, words)


def get_translation_prompt(language: str, words: list, target_languages: list) -> str:
    """Generate cross-translation prompt for words already processed.
    Used only for cross-language translation to other user languages."""
    word_list = ', '.join([w['word'] for w in words])
    other_langs = [lang for lang in target_languages if lang != language]
    target_langs_str = ', '.join(other_langs) if other_langs else 'none'

    # Choose a language-specific translation template when available.
    # We keep translation.txt as the generic fallback, but allow per-language
    # rules that incorporate script and style guidance from the vocab_pipeline prompts.
    lang_code = LANGUAGE_CODE_MAP.get(language.lower(), language.lower()[:2])
    per_lang_filename = None
    if lang_code == 'kn':
        per_lang_filename = "translation_prompts/translation_kn.txt"
    elif lang_code == 'ta':
        per_lang_filename = "translation_prompts/translation_ta.txt"
    elif lang_code == 'te':
        per_lang_filename = "translation_prompts/translation_te.txt"
    elif lang_code == 'ml':
        per_lang_filename = "translation_prompts/translation_ml.txt"
    elif lang_code == 'hi':
        per_lang_filename = "translation_prompts/translation_hi.txt"
    elif lang_code == 'ur':
        per_lang_filename = "translation_prompts/translation_ur.txt"

    template = _load_prompt_template(per_lang_filename) if per_lang_filename else ""
    if not template:
        # Fallback to generic prompt which already encodes key cross-language rules
        template = _load_prompt_template("translation.txt")
    if not template:
        return ""

    prompt = template.format(
        source_language=language,
        target_languages=target_langs_str,
        words=word_list
    )
    
    return prompt


def get_synonym_decision_prompt(
    extracted_word: str,
    extracted_transliteration: str,
    extracted_english: str,
    language: str,
    candidates: list,
) -> str:
    """Build prompt for AI to decide if extracted word is synonym of an existing card or new card.
    candidates: list of dicts with id, translation, transliteration, english_word."""
    template = _load_prompt_template("synonym_decision.txt")
    if not template:
        return ""
    import json
    candidates_json = json.dumps(
        [
            {
                "id": c.get("id"),
                "translation": c.get("translation", ""),
                "transliteration": c.get("transliteration", ""),
                "english_word": c.get("english_word", ""),
            }
            for c in candidates
        ],
        indent=2,
        ensure_ascii=False,
    )
    return template.format(
        extracted_word=extracted_word or "",
        extracted_transliteration=extracted_transliteration or "",
        extracted_english=extracted_english or "",
        language=language or "",
        candidates_json=candidates_json,
    )
