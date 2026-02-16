#!/usr/bin/env python3
"""
Update all lesson step titles to be more descriptive
Removes emojis and extracts clean section headers
"""
import json
import glob
import re
import os

def clean_title(title):
    """Remove emojis and extra whitespace"""
    # Remove all emoji characters
    title = re.sub(r'[\U0001F300-\U0001F9FF]', '', title)
    # Remove extra whitespace
    title = re.sub(r'\s+', ' ', title).strip()
    return title

def extract_section_title(markdown):
    """Extract first heading from markdown"""
    if not markdown:
        return None
    
    for line in markdown.split('\n'):
        line = line.strip()
        if line.startswith('#'):
            # Remove markdown heading markers
            title = re.sub(r'^#+\s*', '', line)
            title = clean_title(title)
            
            # Limit length for sidebar display
            if len(title) > 50:
                title = title[:47] + '...'
            
            return title if title else None
    return None

def generate_step_title(step, index):
    """Generate descriptive title based on step type"""
    step_type = step.get('type', '')
    
    if step_type == 'content':
        title = extract_section_title(step.get('content_markdown', ''))
        return title if title else f'Section {index + 1}'
    
    elif step_type == 'multiple_choice':
        question = step.get('question', '')
        if len(question) > 35:
            question = question[:32] + '...'
        return question if question else f'Question {index + 1}'
    
    elif step_type == 'free_response':
        question = step.get('question', '')
        if len(question) > 35:
            question = question[:32] + '...'
        return question if question else f'Practice {index + 1}'
    
    else:
        return step_type.replace('_', ' ').title()

def update_lesson_file(filepath):
    """Update a single lesson file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    steps = data.get('steps', [])
    modified = False
    
    for i, step in enumerate(steps):
        new_title = generate_step_title(step, i)
        old_title = step.get('step_title', '')
        
        if old_title != new_title:
            step['step_title'] = new_title
            modified = True
    
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    return False

def main():
    # Process Malayalam lessons
    ml_dir = 'backend/lessons/ml/unit_1_foundations'
    os.chdir(ml_dir)
    
    lessons = sorted([f for f in glob.glob('*.json') if f != '_unit_metadata.json'])
    
    print(f'📚 Processing {len(lessons)} Malayalam lessons...\n')
    updated_count = 0
    
    for lesson_file in lessons:
        if update_lesson_file(lesson_file):
            print(f'✓ Updated {lesson_file}')
            updated_count += 1
        else:
            print(f'  Skipped {lesson_file} (no changes)')
    
    print(f'\n✅ Updated {updated_count}/{len(lessons)} lessons!')

if __name__ == '__main__':
    main()
