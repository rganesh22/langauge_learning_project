#!/usr/bin/env python3
"""
Script to insert new Malayalam lessons
"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path

def insert_malayalam_lessons():
    # Malayalam lesson files
    lessons_to_add = [
        "lessons/ml/01_the_basics.json",
        "lessons/ml/02_i_vowel_sign.json",
        "lessons/ml/03_the_nasals.json",
        "lessons/ml/04_u_vowel_sign.json",
    ]
    
    db_path = Path(__file__).parent / "fluo.db"
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    added = 0
    updated = 0
    
    for lesson_file_path in lessons_to_add:
        lesson_file = Path(__file__).parent / lesson_file_path
        
        if not lesson_file.exists():
            print(f"✗ File not found: {lesson_file}")
            continue
        
        try:
            with open(lesson_file, 'r', encoding='utf-8') as f:
                lesson_data = json.load(f)
            
            now = datetime.now().isoformat()
            steps_json = json.dumps(lesson_data['steps'])
            
            # Check if exists
            cursor.execute('SELECT lesson_id FROM lessons WHERE lesson_id = ?', 
                          (lesson_data['lesson_id'],))
            exists = cursor.fetchone()
            
            if exists:
                # Update existing
                cursor.execute('''
                    UPDATE lessons 
                    SET title = ?, language = ?, level = ?, steps_json = ?, updated_at = ?
                    WHERE lesson_id = ?
                ''', (lesson_data['title'], lesson_data['language'], lesson_data['level'], 
                      steps_json, now, lesson_data['lesson_id']))
                
                print(f"↻ Updated: {lesson_data['title']} ({lesson_data['lesson_id']})")
                updated += 1
            else:
                # Insert new
                cursor.execute('''
                    INSERT INTO lessons (lesson_id, title, language, level, steps_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (lesson_data['lesson_id'], lesson_data['title'], lesson_data['language'], 
                      lesson_data['level'], steps_json, now, now))
                
                print(f"✓ Inserted: {lesson_data['title']} ({lesson_data['lesson_id']})")
                added += 1
        
        except Exception as e:
            print(f"✗ Error loading {lesson_file_path}: {e}")
    
    conn.commit()
    conn.close()
    
    print(f"\n✓ Done! Added {added} new lessons, updated {updated} lessons.")
    return added, updated

if __name__ == "__main__":
    print("Inserting Malayalam lessons...\n")
    insert_malayalam_lessons()
