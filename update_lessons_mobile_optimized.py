#!/usr/bin/env python3
"""
Update all Malayalam lessons to:
1. Add skills_learned array
2. Optimize step_title to 3-4 words
3. Ensure mobile-friendly formatting
"""

import json
import os
import re
from pathlib import Path

def shorten_step_title(title, max_words=4):
    """Shorten step title to 3-4 words while preserving meaning"""
    # Remove emojis
    title = re.sub(r'[🎉📚🏗️💪✅🌟🎯🌴🥥🌿]', '', title)
    title = title.strip()
    
    # Remove trailing "..." from truncated titles
    title = re.sub(r'\.\.\.+$', '', title)
    
    # Common patterns to shorten
    replacements = {
        r'^Welcome to Malayalam Script!?$': 'Welcome to Malayalam',
        r'^Letter \d+: (.+)$': r'Letter \1',
        r'^Understanding (.+)$': r'\1 Explained',
        r'^Let\'s Build Words!?.*$': 'Build Your Words',
        r'^Phase \d+: (.+)$': r'\1',
        r'^Your First (\d+) Words!?.*$': r'Your First \1 Words',
        r'^Question: (.+)$': r'\1',
        r'^What sound does (.+) make\??$': r'\1 Sound',
        r'^What is (.+)\??$': r'Understanding \1',
        r'^How is (.+) pronounced.*$': r'\1 Pronunciation',
        r'^What does (.+) sound like\??$': r'\1 Sound',
        r'^Write the (.+) word for.*$': r'Write \1 Word',
        r'^How do you pronounce (.+)\??$': r'\1 Pronunciation',
        r'^Which characters make up.*$': 'Character Breakdown',
        r'^How many (.+)\??$': r'\1 Count',
        r"^What's the difference between (.+)\??$": r'\1 Difference',
        r'^(.+) Revealed!?$': r'\1 Unveiled',
    }
    
    for pattern, replacement in replacements.items():
        if re.match(pattern, title):
            title = re.sub(pattern, replacement, title)
            break
    
    # Split into words
    words = title.split()
    
    # If already 3-4 words, return as is
    if 3 <= len(words) <= 4:
        return title
    
    # If less than 3 words, return as is
    if len(words) < 3:
        return title
    
    # If more than 4 words, intelligently truncate
    if len(words) > 4:
        # Try to keep most meaningful words
        # Skip articles and common prepositions
        skip_words = {'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with'}
        important_words = [w for w in words if w.lower() not in skip_words]
        
        if len(important_words) <= 4:
            return ' '.join(important_words)
        else:
            # Take first 4 important words
            return ' '.join(important_words[:4])
    
    return title

def generate_skills_learned(lesson_data):
    """Generate skills_learned array based on lesson content"""
    title = lesson_data.get('title', '')
    tags = lesson_data.get('tags', [])
    steps = lesson_data.get('steps', [])
    
    skills = []
    
    # Analyze tags to generate skills
    if 'vowels' in tags:
        skills.append('Reading Malayalam vowels')
    if 'consonants' in tags:
        skills.append('Recognizing Malayalam consonants')
    if 'chillus' in tags:
        skills.append('Understanding chillu characters')
    if 'pronunciation' in tags:
        skills.append('Pronouncing Malayalam sounds')
    if 'retroflexes' in tags:
        skills.append('Distinguishing retroflex sounds')
    if 'script' in tags or 'basics' in tags:
        skills.append('Reading Malayalam script')
    if 'vocabulary' in tags:
        skills.append('Building vocabulary')
    if 'clusters' in tags or 'ligatures' in tags:
        skills.append('Reading consonant clusters')
    if 'diphthongs' in tags:
        skills.append('Pronouncing diphthongs')
    if 'doubles' in tags:
        skills.append('Reading doubled consonants')
    
    # Count words mentioned in content
    word_count = 0
    for step in steps:
        if step.get('type') == 'content':
            content = step.get('content_markdown', '')
            # Look for word lists or tables
            if '| Malayalam |' in content or '| **' in content:
                # Rough estimate of words in table
                word_count += content.count('| **')
    
    if word_count >= 10:
        skills.append(f'Reading {word_count}+ Malayalam words')
    elif word_count >= 5:
        skills.append(f'Reading {word_count} new words')
    
    # Add a generic skill based on title
    if 'letter' in title.lower() or 'character' in title.lower():
        skills.append('Writing Malayalam characters')
    
    # Ensure we have at least 3 skills
    if len(skills) < 3:
        skills.append('Understanding Malayalam phonetics')
    if len(skills) < 3:
        skills.append('Applying reading strategies')
    
    # Limit to 5 skills
    return skills[:5]

def update_lesson_file(filepath):
    """Update a single lesson file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lesson = json.load(f)
        
        modified = False
        
        # Add skills_learned if missing
        if 'skills_learned' not in lesson:
            lesson['skills_learned'] = generate_skills_learned(lesson)
            modified = True
            print(f"  Added skills_learned: {lesson['skills_learned']}")
        
        # Update step_title for all steps
        for i, step in enumerate(lesson.get('steps', [])):
            old_title = step.get('step_title', '')
            new_title = shorten_step_title(old_title)
            
            if new_title != old_title:
                step['step_title'] = new_title
                modified = True
                print(f"  Step {i+1}: '{old_title}' → '{new_title}'")
        
        # Save if modified
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(lesson, f, ensure_ascii=False, indent=2)
            return True
        else:
            print(f"  No changes needed")
            return False
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    lessons_dir = Path('backend/lessons/ml/unit_1_foundations')
    
    if not lessons_dir.exists():
        print(f"❌ Directory not found: {lessons_dir}")
        return
    
    # Get all lesson files
    lesson_files = sorted([f for f in lessons_dir.glob('*.json') 
                          if not f.name.startswith('_')])
    
    print(f"Processing {len(lesson_files)} lessons...\n")
    
    updated_count = 0
    for lesson_file in lesson_files:
        print(f"📝 {lesson_file.name}")
        if update_lesson_file(lesson_file):
            updated_count += 1
        print()
    
    print(f"\n✅ Updated {updated_count}/{len(lesson_files)} lessons!")

if __name__ == '__main__':
    main()
