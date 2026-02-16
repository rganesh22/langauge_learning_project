#!/usr/bin/env python3
"""
Reload lessons from JSON files into database with unit support
"""
import os
import json
import sys
import sqlite3
from datetime import datetime
from pathlib import Path

# Configuration
BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, 'backend', 'fluo.db')
LESSONS_DIR = os.path.join(BASE_DIR, 'backend', 'lessons')

def add_lesson(conn, lesson_id, title, language, level, steps, unit_id=None, lesson_number=None):
    """Add a lesson to the database"""
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    steps_json = json.dumps(steps)
    
    try:
        cursor.execute('''
            INSERT INTO lessons (lesson_id, title, language, level, unit_id, lesson_number, steps_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (lesson_id, title, language, level, unit_id, lesson_number, steps_json, now, now))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # Update if exists
        cursor.execute('''
            UPDATE lessons 
            SET title = ?, language = ?, level = ?, unit_id = ?, lesson_number = ?, steps_json = ?, updated_at = ?
            WHERE lesson_id = ?
        ''', (title, language, level, unit_id, lesson_number, steps_json, now, lesson_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error adding lesson: {e}")
        return False

def add_unit(conn, unit_data):
    """Add a unit to the database"""
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    try:
        cursor.execute('''
            INSERT INTO units 
            (unit_id, unit_number, language, title, subtitle, description, estimated_minutes, 
             lesson_count, metadata_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            unit_data['unit_id'],
            unit_data['unit_number'],
            unit_data['language'],
            unit_data['title'],
            unit_data.get('subtitle'),
            unit_data.get('description'),
            unit_data.get('estimated_minutes', 0),
            unit_data.get('lesson_count', 0),
            json.dumps(unit_data),
            now,
            now
        ))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # Update if exists
        cursor.execute('''
            UPDATE units 
            SET unit_number = ?, language = ?, title = ?, subtitle = ?, description = ?, 
                estimated_minutes = ?, lesson_count = ?, metadata_json = ?, updated_at = ?
            WHERE unit_id = ?
        ''', (
            unit_data['unit_number'],
            unit_data['language'],
            unit_data['title'],
            unit_data.get('subtitle'),
            unit_data.get('description'),
            unit_data.get('estimated_minutes', 0),
            unit_data.get('lesson_count', 0),
            json.dumps(unit_data),
            now,
            unit_data['unit_id']
        ))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error adding unit: {e}")
        return False

def load_unit_metadata(unit_path):
    """Load unit metadata from _unit_metadata.json file"""
    metadata_file = os.path.join(unit_path, '_unit_metadata.json')
    if os.path.exists(metadata_file):
        with open(metadata_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def load_lessons_from_unit(conn, language, unit_path, unit_metadata):
    """Load all lessons from a unit directory"""
    lessons_loaded = 0
    errors = []
    
    # Get all JSON files except metadata
    lesson_files = sorted([f for f in os.listdir(unit_path) 
                          if f.endswith('.json') and not f.startswith('_')])
    
    for filename in lesson_files:
        filepath = os.path.join(unit_path, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lesson_data = json.load(f)
            
            # Extract lesson number from filename (e.g., "01_..." -> 1)
            lesson_number = int(filename.split('_')[0])
            
            # Add lesson to database with unit info
            success = add_lesson(
                conn=conn,
                lesson_id=lesson_data['lesson_id'],
                title=lesson_data['title'],
                language=lesson_data['language'],
                level=lesson_data.get('cefr_level', 'A0'),
                steps=lesson_data['steps'],
                unit_id=unit_metadata['unit_id'] if unit_metadata else None,
                lesson_number=lesson_number
            )
            
            if success:
                print(f"  ✅ {filename} → {lesson_data['title']} (Lesson {lesson_number})")
                lessons_loaded += 1
            else:
                errors.append(f"  ⚠️  Failed to load {filename}")
                
        except json.JSONDecodeError as e:
            errors.append(f"  ⚠️  Error parsing {filename}: {str(e)}")
        except Exception as e:
            errors.append(f"  ⚠️  Error loading {filename}: {str(e)}")
    
    return lessons_loaded, errors

def main():
    print("🔄 Reloading lessons with unit support into database...")
    print(f"📚 Loading lessons from: {LESSONS_DIR}")
    print(f"💾 Database: {DB_PATH}")
    print()
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Clear existing lessons and units
    cursor.execute('SELECT COUNT(*) FROM lessons')
    old_count = cursor.fetchone()[0]
    cursor.execute('DELETE FROM lessons')
    cursor.execute('DELETE FROM units')
    cursor.execute('DELETE FROM unit_progress')
    conn.commit()
    print(f"🗑️  Cleared {old_count} existing lessons and units from database")
    print()
    
    # Get all language directories
    languages = [d for d in os.listdir(LESSONS_DIR) 
                if os.path.isdir(os.path.join(LESSONS_DIR, d))]
    
    total_lessons = 0
    total_units = 0
    all_errors = []
    
    for lang_code in sorted(languages):
        lang_path = os.path.join(LESSONS_DIR, lang_code)
        print(f"📖 Loading lessons for language: {lang_code}")
        
        # Check for unit-based structure (subdirectories)
        items = os.listdir(lang_path)
        unit_dirs = [d for d in items if os.path.isdir(os.path.join(lang_path, d))]
        
        if unit_dirs:
            # Unit-based structure
            for unit_dir in sorted(unit_dirs):
                unit_path = os.path.join(lang_path, unit_dir)
                
                # Load unit metadata
                unit_metadata = load_unit_metadata(unit_path)
                
                if unit_metadata:
                    print(f"  📦 Unit {unit_metadata['unit_number']}: {unit_metadata['title']}")
                    
                    # Add unit to database
                    add_unit(conn, unit_metadata)
                    total_units += 1
                else:
                    print(f"  📦 Unit: {unit_dir} (no metadata)")
                    unit_metadata = {'unit_id': f"{lang_code}_unit_{unit_dir}"}
                
                # Load lessons from unit
                lessons_loaded, errors = load_lessons_from_unit(conn, lang_code, unit_path, unit_metadata)
                total_lessons += lessons_loaded
                all_errors.extend(errors)
                print()
        else:
            # Flat structure (no units) - load lessons directly
            lessons_loaded, errors = load_lessons_from_unit(conn, lang_code, lang_path, None)
            total_lessons += lessons_loaded
            all_errors.extend(errors)
            print()
    
    conn.close()
    
    print("="*80)
    if total_units > 0:
        print(f"✅ Successfully loaded: {total_units} units, {total_lessons} lessons")
    else:
        print(f"✅ Successfully loaded: {total_lessons} lessons")
    
    if all_errors:
        print(f"⚠️  Failed to load: {len(all_errors)} lessons")
        for error in all_errors:
            print(error)
    print("="*80)
    print()
    print("🚀 You can now start the backend server:")
    print("   python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 5001 --reload")

if __name__ == '__main__':
    main()
