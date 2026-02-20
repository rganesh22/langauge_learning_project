#!/usr/bin/env python3
"""
Script to update all Malayalam lesson JSON files to A0 level
Focus: Reading Malayalam script phonetically, not grammar comprehension
"""
import json
import os
from pathlib import Path

# Lesson directory
LESSONS_DIR = Path(__file__).parent / 'lessons' / 'ml'

def update_lesson_to_a0(filepath):
    """Update a single lesson file to A0 level with reading-focused description"""
    with open(filepath, 'r', encoding='utf-8') as f:
        lesson = json.load(f)
    
    # Update CEFR level to A0
    lesson['cefr_level'] = 'A0'
    
    # Update description to emphasize reading/phonetics
    original_desc = lesson.get('description', '')
    lesson_num = lesson.get('lesson_id', '').split('_')[1] if '_' in lesson.get('lesson_id', '') else ''
    
    # Create reading-focused descriptions based on lesson type
    if 'vowel' in original_desc.lower() or 'vowel' in lesson.get('title', '').lower():
        lesson['description'] = f"Learn to read and pronounce Malayalam vowel characters. Master the visual recognition and phonetic sounds of these essential letters."
    elif 'consonant' in original_desc.lower() or 'consonant' in lesson.get('title', '').lower():
        lesson['description'] = f"Learn to read and pronounce Malayalam consonant characters. Master the visual recognition and phonetic sounds of these essential letters."
    elif 'chillu' in original_desc.lower() or 'chillu' in lesson.get('title', '').lower():
        lesson['description'] = f"Learn to read Malayalam chillu characters - special consonant endings. Master their visual forms and how they sound at the end of words."
    elif 'conjunct' in original_desc.lower() or 'cluster' in original_desc.lower() or 'double' in original_desc.lower() or 'hook' in original_desc.lower() or 'merger' in original_desc.lower():
        lesson['description'] = f"Learn to read Malayalam conjunct consonants - combined letter forms. Master recognizing and pronouncing these connected characters."
    elif 'chandrakkala' in original_desc.lower() or 'virama' in original_desc.lower():
        lesson['description'] = f"Learn to read the chandrakkala mark (്) in Malayalam script. Master how it changes pronunciation in different contexts."
    elif 'visual' in lesson.get('title', '').lower() or 'sabotage' in lesson.get('title', '').lower():
        lesson['description'] = f"Practice distinguishing visually similar Malayalam letters. Sharpen your reading skills by recognizing subtle differences."
    elif 'reform' in original_desc.lower() or 'script' in lesson.get('title', '').lower():
        lesson['description'] = f"Learn about Malayalam script variations. Practice reading both traditional and modern letter forms."
    elif 'food' in original_desc.lower() or 'culinary' in original_desc.lower() or 'vegan' in lesson.get('title', '').lower():
        lesson['description'] = f"Learn to read Malayalam food vocabulary. Practice phonetic reading with delicious Kerala dish names."
    elif 'sign' in original_desc.lower() or 'environmental' in lesson.get('title', '').lower():
        lesson['description'] = f"Learn to read common Malayalam signs and labels. Practice reading real-world Malayalam text phonetically."
    elif 'headline' in original_desc.lower() or 'digital' in lesson.get('title', '').lower():
        lesson['description'] = f"Learn to read modern Malayalam fonts and digital text. Practice reading Malayalam in various styles."
    elif 'story' in original_desc.lower() or 'reading' in lesson.get('title', '').lower():
        lesson['description'] = f"Practice reading a complete Malayalam story. Apply all your phonetic reading skills to read connected text."
    elif 'loanword' in original_desc.lower():
        lesson['description'] = f"Learn to read Malayalam spellings of foreign words. Practice how Malayalam script adapts English and other languages."
    elif 'sanskrit' in original_desc.lower():
        lesson['description'] = f"Learn to read Sanskrit-origin Malayalam letters. Master the phonetic pronunciation of these special characters."
    elif 'rare' in original_desc.lower() or 'mark' in original_desc.lower():
        lesson['description'] = f"Learn to read rare Malayalam marks and symbols. Complete your ability to read any Malayalam text."
    elif 'grammar' in original_desc.lower() or 'suffix' in original_desc.lower():
        lesson['description'] = f"Learn to read common Malayalam word endings. Practice recognizing how suffixes look in written form."
    else:
        # Generic reading-focused description
        lesson['description'] = f"Learn to read Malayalam script phonetically. Master the visual recognition and pronunciation of these characters."
    
    # Write back to file
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(lesson, f, ensure_ascii=False, indent=2)
    
    return lesson.get('lesson_id', filepath.name)

def main():
    """Update all Malayalam lesson files to A0"""
    if not LESSONS_DIR.exists():
        print(f"Malayalam lessons directory not found: {LESSONS_DIR}")
        return
    
    updated_count = 0
    
    # Iterate through all JSON files
    for lesson_file in sorted(LESSONS_DIR.glob("*.json")):
        lesson_id = update_lesson_to_a0(lesson_file)
        print(f"✓ Updated {lesson_file.name} to A0 level")
        updated_count += 1
    
    print(f"\n✅ Updated {updated_count} Malayalam lessons to A0 level")
    print("📖 All lessons now focus on phonetic reading skills")
    print("\nNext step: Run 'python3 -m backend.load_lessons' to reload into database")

if __name__ == "__main__":
    main()
