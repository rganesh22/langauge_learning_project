"""
Migration script to convert SRS settings from per-week to per-day
"""
import sqlite3
import config

def migrate_srs_settings():
    """Migrate SRS settings from per-week to per-day"""
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    try:
        # First, check if we need to migrate (if new columns don't exist)
        cursor.execute("PRAGMA table_info(srs_settings)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'new_cards_per_day' in columns:
            print("✓ Database already migrated to per-day settings")
            return
        
        print("📊 Migrating SRS settings from per-week to per-day...")
        
        # Get existing data
        cursor.execute("SELECT id, user_id, language, new_cards_per_week, reviews_per_week, created_at, updated_at FROM srs_settings")
        existing_data = cursor.fetchall()
        
        print(f"Found {len(existing_data)} existing settings to migrate")
        
        # Create new table with per-day columns
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS srs_settings_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                language TEXT NOT NULL,
                new_cards_per_day INTEGER DEFAULT 3,
                reviews_per_day INTEGER DEFAULT 30,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, language),
                FOREIGN KEY (user_id) REFERENCES user_profile(id)
            )
        ''')
        
        # Migrate data (divide weekly values by 7 to get daily)
        for row in existing_data:
            row_id, user_id, language, new_cards_per_week, reviews_per_week, created_at, updated_at = row
            
            # Convert weekly to daily (round to nearest integer)
            new_cards_per_day = max(1, round(new_cards_per_week / 7))
            reviews_per_day = max(1, round(reviews_per_week / 7))
            
            print(f"  {language}: {new_cards_per_week}/week → {new_cards_per_day}/day, {reviews_per_week}/week → {reviews_per_day}/day")
            
            cursor.execute('''
                INSERT INTO srs_settings_new (id, user_id, language, new_cards_per_day, reviews_per_day, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (row_id, user_id, language, new_cards_per_day, reviews_per_day, created_at, updated_at))
        
        # Drop old table and rename new one
        cursor.execute("DROP TABLE srs_settings")
        cursor.execute("ALTER TABLE srs_settings_new RENAME TO srs_settings")
        
        conn.commit()
        print("✅ Migration completed successfully!")
        
        # Show new settings
        cursor.execute("SELECT language, new_cards_per_day, reviews_per_day FROM srs_settings WHERE user_id = 1")
        new_settings = cursor.fetchall()
        print("\n📋 New settings (per day):")
        for lang, new_cards, reviews in new_settings:
            print(f"  {lang}: {new_cards} new cards/day, {reviews} reviews/day")
        
    except Exception as e:
        print(f"❌ Error during migration: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_srs_settings()
