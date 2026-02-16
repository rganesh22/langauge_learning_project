#!/usr/bin/env python3
"""
Convert ALL Malayalam lesson comprehension questions to A0 pronunciation/reading questions
"""
import json
import re
from pathlib import Path

lessons_dir = Path("backend/lessons/ml")

# Conversion patterns
CONVERSIONS = {
    # Pattern: (question_pattern, new_question_template, options_converter)
    "what_does_mean": {
        "pattern": r"What does \*\*(.+?)\*\* (?:\((.+?)\) )?mean",
        "new_question": "How do you pronounce **{word}**?",
        "convert_options": lambda malayalam, pronunciation, options: [
            pronunciation if pronunciation else "unknown",
            pronunciation.replace("a", "aa") if pronunciation else "alt1",
            pronunciation.replace("-", "") if pronunciation else "alt2",
            pronunciation[::-1] if pronunciation else "alt3"
        ][:4]
    },
    "which_word_means": {
        "pattern": r"Which word means ['\"](.+?)['\"]",
        "new_question": "Which word is pronounced '{pronunciation}'?",
        "keep_malayalam_options": True
    },
    "write_word_for": {
        "pattern": r"(?:How do you write|Write the Malayalam word for) ['\"](.+?)['\"]",
        "new_question": "How do you pronounce **{options[0]}**?",
        "convert_to_pronunciation": True
    }
}

def extract_pronunciation(text):
    """Extract pronunciation from (pronunciation) pattern"""
    match = re.search(r'\(([^)]+)\)', text)
    return match.group(1) if match else None

def convert_question(step):
    """Convert a comprehension question to pronunciation question"""
    if step.get('type') not in ['multiple_choice', 'free_response']:
        return step
    
    question = step.get('question', '')
    
    # Check for "mean" or "means" questions
    if 'mean' in question.lower() or 'means' in question.lower():
        # Extract Malayalam word
        malayalam_match = re.search(r'\*\*(.+?)\*\*', question)
        if malayalam_match:
            malayalam_word = malayalam_match.group(1)
            
            # Extract pronunciation if present
            pron_match = re.search(r'\(([^)]+)\)', question)
            pronunciation = pron_match.group(1) if pron_match else None
            
            if step['type'] == 'multiple_choice':
                # Convert to pronunciation question
                step['question'] = f"How do you pronounce **{malayalam_word}**?"
                
                # If we have pronunciation, create phonetic options
                if pronunciation:
                    # Keep the correct pronunciation as first option
                    correct_pron = pronunciation
                    
                    # Generate alternative pronunciations
                    variants = [
                        correct_pron,
                        correct_pron.replace('a', 'aa'),
                        correct_pron.replace('-', ''),
                        correct_pron + '-a'
                    ]
                    
                    # Ensure 4 unique options
                    seen = set()
                    new_options = []
                    for v in variants:
                        if v not in seen and len(new_options) < 4:
                            new_options.append(v)
                            seen.add(v)
                    
                    # Fill remaining with variations
                    while len(new_options) < 4:
                        variant = new_options[0] + str(len(new_options))
                        if variant not in seen:
                            new_options.append(variant)
                            seen.add(variant)
                    
                    step['options'] = new_options
                    step['correct_answer'] = correct_pron
                    
            elif step['type'] == 'free_response':
                # Convert to pronunciation question
                step['question'] = f"How do you pronounce **{malayalam_word}**?"
                
                if pronunciation:
                    # Update accepted responses to pronunciation variants
                    step['accepted_responses'] = [
                        pronunciation,
                        pronunciation.capitalize(),
                        pronunciation.upper(),
                        pronunciation.replace('-', '')
                    ]
    
    # Check for "which word" questions
    elif 'which word' in question.lower() and step['type'] == 'multiple_choice':
        # Keep Malayalam options but ask about pronunciation
        if 'means' in question.lower():
            # Extract what it means
            meaning_match = re.search(r"means ['\"](.+?)['\"]", question, re.IGNORECASE)
            if meaning_match:
                # Change to ask about sound/reading
                step['question'] = "Which of these words starts with the same sound?"
                # Keep Malayalam options as-is
    
    return step

def process_lesson(filepath):
    """Process a single lesson file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    modified = False
    
    for step in data['steps']:
        original_q = step.get('question', '')
        step = convert_question(step)
        if step.get('question', '') != original_q:
            modified = True
    
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    return False

# Process all lessons
print("Converting Malayalam lessons to A0 (pronunciation-focused)...")
print("=" * 70)

modified_count = 0

for i in range(1, 31):
    lesson_files = list(lessons_dir.glob(f"{i:02d}_*.json"))
    if not lesson_files:
        print(f"⚠️  Lesson {i:02d}: File not found")
        continue
    
    filepath = lesson_files[0]
    print(f"Processing Lesson {i:02d}: {filepath.name}")
    
    if process_lesson(filepath):
        modified_count += 1
        print(f"  ✅ Modified")
    else:
        print(f"  ⏭️  No changes needed")

print("=" * 70)
print(f"✅ Processed 30 lessons, modified {modified_count} files")
print("\nNext step: Run 'python3 reload_lessons.py' to update database")
