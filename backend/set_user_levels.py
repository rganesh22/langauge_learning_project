#!/usr/bin/env python3
"""
Script to set user language levels based on vocabulary completion.
This will mark all words up to and including the target level as 'mastered',
and all remaining words as 'review' (or 'due' based on SRS algorithm).
"""

import sqlite3
import config
from datetime import datetime, timedelta

def set_language_level(language: str, target_level: str, user_id: int = 1):
    """
    Set user to a specific CEFR level by mastering all words up to that level.
    
    Args:
        language: Language code (e.g., 'Tamil', 'Telugu')
        target_level: Target CEFR level (e.g., 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')
        user_id: User ID (default: 1)
    """
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    # Define level hierarchy
    level_order = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']
    target_level_lower = target_level.lower()
    
    if target_level_lower not in level_order:
        print(f"❌ Invalid target level: {target_level}")
        conn.close()
        return
    
    target_index = level_order.index(target_level_lower)
    
    # Levels to master (up to and including target)
    levels_to_master = level_order[:target_index + 1]
    # Levels to set as new (after target level)
    levels_to_new = level_order[target_index + 1:]
    
    print(f"\n🎯 Setting {language} to {target_level.upper()}")
    print(f"   Mastering: {', '.join([l.upper() for l in levels_to_master])}")
    print(f"   New: {', '.join([l.upper() for l in levels_to_new]) if levels_to_new else 'None'}")
    
    # Get all words for this language
    cursor.execute('''
        SELECT id, level FROM vocabulary 
        WHERE language = ? AND level IS NOT NULL AND level != ''
    ''', (language,))
    
    words = cursor.fetchall()
    
    if not words:
        print(f"   ⚠️  No words found for {language}")
        conn.close()
        return
    
    mastered_count = 0
    new_count = 0
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    for word_id, level in words:
        level_lower = level.lower() if level else ''
        
        if level_lower in levels_to_master:
            # Master this word (user has completed this level)
            cursor.execute('''
                INSERT OR REPLACE INTO word_states 
                (user_id, word_id, mastery_level, review_count, ease_factor, next_review_date, last_reviewed)
                VALUES (?, ?, 'mastered', 8, 2.5, ?, ?)
            ''', (user_id, word_id, now, now))
            mastered_count += 1
        else:
            # Set as new (user hasn't reached this level yet)
            cursor.execute('''
                INSERT OR REPLACE INTO word_states 
                (user_id, word_id, mastery_level, review_count, ease_factor, next_review_date, last_reviewed)
                VALUES (?, ?, 'new', 0, 2.5, NULL, NULL)
            ''', (user_id, word_id))
            new_count += 1
    
    conn.commit()
    conn.close()
    
    print(f"   ✅ Mastered: {mastered_count} words")
    print(f"   🆕 New: {new_count} words")
    return mastered_count, new_count


def set_all_words_to_review(language: str, user_id: int = 1):
    """
    Set ALL words for a language to 'review' status (due for review).
    Useful for testing or resetting progress.
    
    Args:
        language: Language code
        user_id: User ID (default: 1)
    """
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Get all words for this language
    cursor.execute('''
        SELECT id FROM vocabulary WHERE language = ?
    ''', (language,))
    
    word_ids = [row[0] for row in cursor.fetchall()]
    
    if not word_ids:
        print(f"   ⚠️  No words found for {language}")
        conn.close()
        return
    
    print(f"\n📚 Setting all {len(word_ids)} words in {language} to 'review' status")
    
    for word_id in word_ids:
        cursor.execute('''
            INSERT OR REPLACE INTO word_states 
            (user_id, word_id, mastery_level, review_count, ease_factor, next_review_date, last_reviewed)
            VALUES (?, ?, 'review', 3, 2.5, ?, ?)
        ''', (user_id, word_id, now, now))
    
    conn.commit()
    conn.close()
    
    print(f"   ✅ All words set to review")


if __name__ == '__main__':
    print("=" * 60)
    print("Setting User Language Levels")
    print("=" * 60)
    
    # Set levels as requested:
    # - tamil: B2 (master A1, A2, B1, B2)
    # - telugu: B1 (master A1, A2, B1)
    # - hindi: B1 (master A1, A2, B1)
    # - kannada: B1 (master A1, A2, B1)
    # - urdu: A2 (master A1, A2)
    
    set_language_level('tamil', 'B2')
    set_language_level('telugu', 'B1')
    set_language_level('hindi', 'B1')
    set_language_level('kannada', 'B1')
    set_language_level('urdu', 'A2')
    
    print("\n" + "=" * 60)
    print("✅ All language levels set successfully!")
    print("=" * 60)
    
    # Verify levels
    print("\n📊 Verifying levels:")
    import sys
    sys.path.insert(0, '/Users/raghavganesh/Documents/Code Projects/Language Learning Project/backend')
    import db
    
    for language in ['tamil', 'telugu', 'hindi', 'kannada', 'urdu']:
        level_info = db.calculate_user_level(language)
        print(f"   {language}: {level_info['level']} ({level_info['total_mastered']} mastered, {level_info['progress']:.1f}% to {level_info['next_level']})")
