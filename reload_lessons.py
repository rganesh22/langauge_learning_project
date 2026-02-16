#!/usr/bin/env python3
"""
Standalone script to reload lessons from JSON files into the database.
Run this BEFORE starting the backend server.

Usage:
    python3 reload_lessons.py
"""
import os
import json
import sqlite3
import time
from pathlib import Path
from datetime import datetime

# Database path
DB_PATH = Path(__file__).parent / "backend" / "fluo.db"
LESSONS_DIR = Path(__file__).parent / "backend" / "lessons"

def get_db_connection():
    """Get a database connection with appropriate timeout."""
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn

def clear_all_lessons(conn):
    """Clear all lessons from the database."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM lessons")
    conn.commit()
    deleted = cursor.rowcount
    print(f"🗑️  Cleared {deleted} existing lessons from database")
    return deleted

def add_lesson(conn, lesson_data):
    """Add a single lesson to the database."""
    cursor = conn.cursor()
    
    lesson_id = lesson_data['lesson_id']
    title = lesson_data['title']
    language = lesson_data['language']
    
    # Handle cefr_level as level if level is not present
    if 'level' not in lesson_data and 'cefr_level' in lesson_data:
        level = lesson_data['cefr_level']
    else:
        level = lesson_data.get('level', 'A1')
    
    steps_json = json.dumps(lesson_data['steps'])
    now = datetime.now().isoformat()
    
    try:
        cursor.execute('''
            INSERT INTO lessons (lesson_id, title, language, level, steps_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (lesson_id, title, language, level, steps_json, now, now))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # Lesson already exists, update it
        cursor.execute('''
            UPDATE lessons 
            SET title = ?, language = ?, level = ?, steps_json = ?, updated_at = ?
            WHERE lesson_id = ?
        ''', (title, language, level, steps_json, now, lesson_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"  ❌ Error adding lesson {lesson_id}: {str(e)}")
        return False

def load_lessons():
    """Load all lesson JSON files from lessons/ directory into database."""
    if not LESSONS_DIR.exists():
        print(f"❌ Lessons directory not found: {LESSONS_DIR}")
        return 0
    
    if not DB_PATH.exists():
        print(f"❌ Database not found: {DB_PATH}")
        print("Please start the backend server once to initialize the database.")
        return 0
    
    print(f"📚 Loading lessons from: {LESSONS_DIR}")
    print(f"💾 Database: {DB_PATH}")
    print()
    
    conn = get_db_connection()
    
    # Clear existing lessons
    clear_all_lessons(conn)
    print()
    
    loaded_count = 0
    failed_count = 0
    
    # Iterate through language folders
    for lang_dir in sorted(LESSONS_DIR.iterdir()):
        if not lang_dir.is_dir():
            continue
        
        lang_code = lang_dir.name
        print(f"📖 Loading lessons for language: {lang_code}")
        
        lang_loaded = 0
        
        # Iterate through JSON files in language folder
        for lesson_file in sorted(lang_dir.glob("*.json")):
            try:
                with open(lesson_file, 'r', encoding='utf-8') as f:
                    lesson_data = json.load(f)
                
                # Validate required fields
                required_fields = ['lesson_id', 'title', 'language', 'steps']
                missing_fields = [field for field in required_fields if field not in lesson_data]
                
                if missing_fields:
                    print(f"  ⚠️  Skipping {lesson_file.name}: Missing fields {missing_fields}")
                    failed_count += 1
                    continue
                
                if add_lesson(conn, lesson_data):
                    loaded_count += 1
                    lang_loaded += 1
                    print(f"  ✅ {lesson_file.name} → {lesson_data.get('title', 'Untitled')} (Level: {lesson_data.get('cefr_level', lesson_data.get('level', 'N/A'))})")
                else:
                    failed_count += 1
                    
            except json.JSONDecodeError as e:
                print(f"  ⚠️  Error parsing {lesson_file.name}: {str(e)}")
                failed_count += 1
            except Exception as e:
                print(f"  ⚠️  Error loading {lesson_file.name}: {str(e)}")
                failed_count += 1
        
        if lang_loaded > 0:
            print(f"  📊 Loaded {lang_loaded} {lang_code} lessons")
        print()
    
    conn.close()
    
    print("=" * 60)
    print(f"✅ Successfully loaded: {loaded_count} lessons")
    if failed_count > 0:
        print(f"⚠️  Failed to load: {failed_count} lessons")
    print("=" * 60)
    print()
    print("🚀 You can now start the backend server:")
    print("   python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 5001 --reload")
    
    return loaded_count

if __name__ == "__main__":
    print("🔄 Reloading lessons into database...")
    print()
    load_lessons()
