"""
Load lessons from JSON files in the lessons/ directory into the database.
"""
import os
import json
import time
import sqlite3
from pathlib import Path
from . import db, config

def load_lessons_from_files(max_retries=3):
    """Load all lesson JSON files from lessons/ directory into database.
    Syncs database with file system - removes deleted lessons, adds new ones.
    
    Args:
        max_retries: Number of times to retry on database lock errors
    """
    lessons_dir = Path(__file__).parent / "lessons"
    
    if not lessons_dir.exists():
        print(f"Lessons directory not found: {lessons_dir}")
        return 0
    
    loaded_count = 0
    failed_count = 0
    
    # Track all lesson IDs found in files
    lesson_ids_in_files = set()
    
    # Iterate through language folders
    for lang_dir in lessons_dir.iterdir():
        if not lang_dir.is_dir():
            continue
        
        lang_code = lang_dir.name
        print(f"Loading lessons for language: {lang_code}")
        
        # Iterate through JSON files in language folder
        for lesson_file in lang_dir.glob("*.json"):
            retries = 0
            success = False
            
            while retries < max_retries and not success:
                try:
                    with open(lesson_file, 'r', encoding='utf-8') as f:
                        lesson_data = json.load(f)
                    
                    # Validate required fields - accept either 'level' or 'cefr_level'
                    required_fields = ['lesson_id', 'title', 'language', 'steps']
                    if not all(field in lesson_data for field in required_fields):
                        print(f"  ⚠️  Skipping {lesson_file.name}: missing required fields")
                        break
                    
                    # Handle cefr_level as level if level is not present
                    if 'level' not in lesson_data and 'cefr_level' in lesson_data:
                        lesson_data['level'] = lesson_data['cefr_level']
                    elif 'level' not in lesson_data:
                        print(f"  ⚠️  Skipping {lesson_file.name}: missing level or cefr_level")
                        break
                    
                    # Track this lesson ID
                    lesson_ids_in_files.add(lesson_data['lesson_id'])
                    
                    # Add or update lesson in database
                    result = db.add_lesson(
                        lesson_id=lesson_data['lesson_id'],
                        title=lesson_data['title'],
                        language=lesson_data['language'],
                        level=lesson_data['level'],
                        steps=lesson_data['steps']
                    )
                    
                    if result:
                        loaded_count += 1
                        print(f"  ✓ Loaded: {lesson_data['title']} ({lesson_data['lesson_id']})")
                        success = True
                    else:
                        retries += 1
                        if retries < max_retries:
                            time.sleep(0.1)  # Brief delay before retry
                    
                except json.JSONDecodeError as e:
                    print(f"  ⚠️  Error parsing {lesson_file.name}: {e}")
                    break
                except Exception as e:
                    print(f"  ⚠️  Error loading {lesson_file.name}: {e}")
                    retries += 1
                    if retries < max_retries:
                        time.sleep(0.1)
            
            if not success:
                failed_count += 1
    
    # Remove lessons from database that are no longer in files
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        # Get all lesson IDs from database
        cursor.execute("SELECT lesson_id FROM lessons")
        db_lesson_ids = {row[0] for row in cursor.fetchall()}
        
        # Find lessons to delete
        lessons_to_delete = db_lesson_ids - lesson_ids_in_files
        
        if lessons_to_delete:
            print(f"\n🗑️  Removing {len(lessons_to_delete)} deleted lessons from database...")
            for lesson_id in lessons_to_delete:
                cursor.execute("DELETE FROM lessons WHERE lesson_id = ?", (lesson_id,))
                print(f"  ✓ Removed: {lesson_id}")
            conn.commit()
        
        conn.close()
    except Exception as e:
        print(f"  ⚠️  Error cleaning up deleted lessons: {e}")
    
    print(f"\n✅ Total lessons loaded/updated: {loaded_count}")
    if failed_count > 0:
        print(f"❌ Failed to load: {failed_count}")
    return loaded_count

if __name__ == "__main__":
    print("Loading lessons from JSON files...\n")
    load_lessons_from_files()
else:
    # When imported as module, make function available
    __all__ = ['load_lessons_from_files']
