#!/usr/bin/env python3
"""
One-time script to insert remaining lessons from JSON files
"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path

def insert_lessons():
    # Define which lessons to add
    lessons_to_add = [
        "lessons/kn/02_self_introduction.json",
        "lessons/ta/01_market_shopping.json",
        "lessons/ta/02_self_introduction.json",
        "lessons/hi/01_market_shopping.json",
        "lessons/hi/02_self_introduction.json",
    ]
    
    db_path = Path(__file__).parent / "fluo.db"
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    added = 0
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
                print(f"⊙ Already exists: {lesson_data['title']} ({lesson_data['lesson_id']})")
            else:
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
    
    print(f"\n✓ Done! Added {added} new lessons.")
    return added

if __name__ == "__main__":
    print("Inserting remaining lessons...\n")
    insert_lessons()
