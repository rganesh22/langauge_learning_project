"""
Database operations for Fluo
Handles SQLite database interactions, SRS logic, and vocabulary management
"""
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import csv
import random
import json
from . import config

# ============================================================================
# Utility Functions
# ============================================================================

def get_week_start(date: datetime = None) -> datetime:
    """Get the Monday of the week for a given date
    
    Args:
        date: Date to find week start for (defaults to today)
    
    Returns:
        datetime object for the Monday of that week
    """
    if date is None:
        date = config.get_current_time()
    
    # If date is a date object, convert to datetime
    if isinstance(date, datetime):
        date_only = date.date()
    else:
        date_only = date
    
    # Get Monday (weekday 0)
    days_since_monday = date_only.weekday()
    monday = date_only - timedelta(days=days_since_monday)
    
    return datetime.combine(monday, datetime.min.time())


# ----------------------------------------------------------------------------
# Utility: lesson words cache table
# ----------------------------------------------------------------------------
def ensure_lesson_words_table():
    """Create the lesson_words cache table if it doesn't exist."""
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lesson_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL,
            lesson_id TEXT NOT NULL,
            text TEXT NOT NULL,
            gloss TEXT
        )
    ''')
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_words_unique ON lesson_words(language, lesson_id, text)')
    conn.commit()
    conn.close()

# ============================================================================
# Database Initialization
# ============================================================================

def init_db():
    """Initialize the database with all required tables"""
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    # User profile table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT 'Language Learner',
            profile_picture_url TEXT,
            streak INTEGER DEFAULT 0,
            last_activity_date TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Add new columns if they don't exist (for existing databases)
    try:
        cursor.execute('ALTER TABLE user_profile ADD COLUMN name TEXT DEFAULT "Language Learner"')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    try:
        cursor.execute('ALTER TABLE user_profile ADD COLUMN profile_picture_url TEXT')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # User settings table (for SRS and other preferences, per-language)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            language TEXT DEFAULT 'kannada',
            setting_key TEXT NOT NULL,
            setting_value TEXT,
            UNIQUE(user_id, language, setting_key),
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Add language column if it doesn't exist (for existing databases)
    try:
        cursor.execute('ALTER TABLE user_settings ADD COLUMN language TEXT DEFAULT "kannada"')
        # Migrate existing settings to have language = 'kannada'
        cursor.execute('UPDATE user_settings SET language = "kannada" WHERE language IS NULL')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Language goals table (per-language, per-activity goals) - DEPRECATED
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS language_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            daily_target INTEGER DEFAULT 1,
            UNIQUE(language, activity_type)
        )
    ''')
    
    # Weekly goals table (Monday-Friday goals per language and activity)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS weekly_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            day_of_week TEXT NOT NULL,
            week_start_date TEXT NOT NULL,
            target_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(language, activity_type, day_of_week, week_start_date)
        )
    ''')
    
    # Vocabulary words table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vocabulary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL,
            english_word TEXT NOT NULL,
            translation TEXT NOT NULL,
            transliteration TEXT,
            word_class TEXT,
            level TEXT,
            verb_transitivity TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # SRS word states table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS word_states (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER NOT NULL,
            user_id INTEGER DEFAULT 1,
            mastery_level TEXT DEFAULT 'new',
            next_review_date TEXT,
            review_count INTEGER DEFAULT 0,
            ease_factor REAL DEFAULT 2.5,
            last_reviewed TEXT,
            introduced_date TEXT,
            FOREIGN KEY (word_id) REFERENCES vocabulary(id),
            FOREIGN KEY (user_id) REFERENCES user_profile(id),
            UNIQUE(word_id, user_id)
        )
    ''')
    
    # Review history table - tracks all past reviews for analytics
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER NOT NULL,
            user_id INTEGER DEFAULT 1,
            reviewed_at TEXT NOT NULL,
            rating TEXT NOT NULL,
            activity_type TEXT,
            interval_days REAL,
            ease_factor REAL,
            mastery_level_before TEXT,
            mastery_level_after TEXT,
            FOREIGN KEY (word_id) REFERENCES vocabulary(id),
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Add index for faster history queries
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_review_history_word_user 
        ON review_history(word_id, user_id, reviewed_at DESC)
    ''')
    
    # Add introduced_date column if it doesn't exist (for existing databases)
    try:
        cursor.execute('ALTER TABLE word_states ADD COLUMN introduced_date TEXT')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Add interval_days column if it doesn't exist (for existing databases)
    try:
        cursor.execute('ALTER TABLE word_states ADD COLUMN interval_days REAL')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Add UNIQUE constraint if table exists but constraint doesn't (for existing databases)
    try:
        cursor.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS idx_word_states_unique 
            ON word_states(word_id, user_id)
        ''')
    except sqlite3.OperationalError:
        # Index might already exist, ignore
        pass
    
    # SRS settings table (per-language configuration)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS srs_settings (
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
    
    # SRS daily quota table (tracks daily quotas and completion)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS srs_daily_quota (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            language TEXT NOT NULL,
            date TEXT NOT NULL,
            new_cards_quota INTEGER DEFAULT 0,
            new_cards_completed INTEGER DEFAULT 0,
            reviews_quota INTEGER DEFAULT 0,
            reviews_completed INTEGER DEFAULT 0,
            UNIQUE(user_id, language, date),
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Activity history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activity_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            language TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            activity_data TEXT,
            score REAL,
            completed_at TEXT,
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Lessons table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            language TEXT NOT NULL,
            level TEXT NOT NULL,
            unit_id TEXT,
            lesson_number INTEGER,
            steps_json TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Units table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unit_id TEXT NOT NULL UNIQUE,
            unit_number INTEGER NOT NULL,
            language TEXT NOT NULL,
            title TEXT NOT NULL,
            subtitle TEXT,
            description TEXT,
            estimated_minutes INTEGER DEFAULT 0,
            lesson_count INTEGER DEFAULT 0,
            metadata_json TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Unit progress table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS unit_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            unit_id TEXT NOT NULL,
            lessons_completed INTEGER DEFAULT 0,
            total_lessons INTEGER NOT NULL,
            is_completed INTEGER DEFAULT 0,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, unit_id),
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Lesson completion history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lesson_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            lesson_id TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            answers_json TEXT,
            feedback_json TEXT,
            total_score REAL,
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Create index for faster lesson queries
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_lessons_language 
        ON lessons(language, level)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_lessons_unit 
        ON lessons(unit_id, lesson_number)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_units_language 
        ON units(language, unit_number)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_lesson_completions_user 
        ON lesson_completions(user_id, lesson_id, completed_at DESC)
    ''')
    
    # Daily progress table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            language TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            date TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            UNIQUE(user_id, language, activity_type, date)
        )
    ''')
    
    # Language personalization settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS language_personalization (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL UNIQUE,
            default_transliterate INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    
    # Initialize default user if not exists
    cursor.execute('SELECT COUNT(*) FROM user_profile')
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            'INSERT INTO user_profile (name, streak, last_activity_date) VALUES (?, 0, ?)',
            ('Language Learner', datetime.now().strftime('%Y-%m-%d'))
        )
        conn.commit()
    
    # Initialize default goals for Kannada
    cursor.execute('SELECT COUNT(*) FROM language_goals WHERE language = ?', ('kannada',))
    if cursor.fetchone()[0] == 0:
        for activity, target in config.DEFAULT_DAILY_GOALS.items():
            cursor.execute('''
                INSERT INTO language_goals (language, activity_type, daily_target)
                VALUES (?, ?, ?)
            ''', ('kannada', activity, target))
        conn.commit()
    
    conn.close()


def init_db_schema():
    """Initialize only the database schema without loading vocabulary.
    This is safe to call on every server startup without losing data."""
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    # User profile table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT DEFAULT 'Language Learner',
            profile_picture_url TEXT,
            streak INTEGER DEFAULT 0,
            last_activity_date TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Add new columns if they don't exist (for existing databases)
    try:
        cursor.execute('ALTER TABLE user_profile ADD COLUMN name TEXT DEFAULT "Language Learner"')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    try:
        cursor.execute('ALTER TABLE user_profile ADD COLUMN profile_picture_url TEXT')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # User settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            language TEXT DEFAULT 'kannada',
            setting_key TEXT NOT NULL,
            setting_value TEXT,
            UNIQUE(user_id, language, setting_key),
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Language goals table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS language_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            daily_target INTEGER DEFAULT 1,
            UNIQUE(language, activity_type)
        )
    ''')
    
    # Weekly goals table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS weekly_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            day_of_week TEXT NOT NULL,
            week_start_date TEXT NOT NULL,
            target_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(language, activity_type, day_of_week, week_start_date)
        )
    ''')
    
    # Vocabulary words table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vocabulary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL,
            english_word TEXT NOT NULL,
            translation TEXT NOT NULL,
            transliteration TEXT,
            word_class TEXT,
            level TEXT,
            verb_transitivity TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # SRS word states table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS word_states (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER NOT NULL,
            user_id INTEGER DEFAULT 1,
            mastery_level TEXT DEFAULT 'new',
            next_review_date TEXT,
            review_count INTEGER DEFAULT 0,
            ease_factor REAL DEFAULT 2.5,
            last_reviewed TEXT,
            introduced_date TEXT,
            FOREIGN KEY (word_id) REFERENCES vocabulary(id),
            FOREIGN KEY (user_id) REFERENCES user_profile(id),
            UNIQUE(word_id, user_id)
        )
    ''')
    
    # Review history table - tracks all past reviews for analytics
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER NOT NULL,
            user_id INTEGER DEFAULT 1,
            reviewed_at TEXT NOT NULL,
            rating TEXT NOT NULL,
            activity_type TEXT,
            interval_days REAL,
            ease_factor REAL,
            mastery_level_before TEXT,
            mastery_level_after TEXT,
            FOREIGN KEY (word_id) REFERENCES vocabulary(id),
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Add index for faster history queries
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_review_history_word_user 
        ON review_history(word_id, user_id, reviewed_at DESC)
    ''')
    
    # Add columns that might not exist in older databases
    try:
        cursor.execute('ALTER TABLE word_states ADD COLUMN introduced_date TEXT')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE word_states ADD COLUMN interval_days REAL')
    except sqlite3.OperationalError:
        pass
    
    # SRS settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS srs_settings (
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
    
    # SRS daily quota table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS srs_daily_quota (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            language TEXT NOT NULL,
            date TEXT NOT NULL,
            new_cards_quota INTEGER DEFAULT 0,
            new_cards_completed INTEGER DEFAULT 0,
            reviews_quota INTEGER DEFAULT 0,
            reviews_completed INTEGER DEFAULT 0,
            UNIQUE(user_id, language, date),
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # User preferences table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            interests TEXT,
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Activity history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activity_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            language TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Lessons table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            language TEXT NOT NULL,
            level TEXT NOT NULL,
            unit_id TEXT,
            lesson_number INTEGER,
            steps_json TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Add new columns to lessons table if they don't exist
    try:
        cursor.execute('ALTER TABLE lessons ADD COLUMN unit_id TEXT')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    try:
        cursor.execute('ALTER TABLE lessons ADD COLUMN lesson_number INTEGER')
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Units table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unit_id TEXT NOT NULL UNIQUE,
            unit_number INTEGER NOT NULL,
            language TEXT NOT NULL,
            title TEXT NOT NULL,
            subtitle TEXT,
            description TEXT,
            estimated_minutes INTEGER DEFAULT 0,
            lesson_count INTEGER DEFAULT 0,
            metadata_json TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Unit progress table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS unit_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            unit_id TEXT NOT NULL,
            lessons_completed INTEGER DEFAULT 0,
            total_lessons INTEGER NOT NULL,
            is_completed INTEGER DEFAULT 0,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, unit_id),
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Lesson completion history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lesson_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            lesson_id TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            answers_json TEXT,
            feedback_json TEXT,
            total_score REAL,
            FOREIGN KEY (user_id) REFERENCES user_profile(id)
        )
    ''')
    
    # Create index for faster lesson queries
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_lessons_language 
        ON lessons(language, level)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_lessons_unit 
        ON lessons(unit_id, lesson_number)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_units_language 
        ON units(language, unit_number)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_lesson_completions_user 
        ON lesson_completions(user_id, lesson_id, completed_at DESC)
    ''')
    
    # Daily progress table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            language TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            date TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            UNIQUE(user_id, language, activity_type, date)
        )
    ''')
    
    # Language personalization settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS language_personalization (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL UNIQUE,
            default_transliterate INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Lesson words table (if it exists in init_db)
    try:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS lesson_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                word_id INTEGER NOT NULL,
                language TEXT NOT NULL,
                lesson_number INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (word_id) REFERENCES vocabulary(id),
                FOREIGN KEY (user_id) REFERENCES user_profile(id)
            )
        ''')
    except:
        pass
    
    conn.commit()
    
    # Initialize default user if not exists
    cursor.execute('SELECT COUNT(*) FROM user_profile')
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            'INSERT INTO user_profile (name, streak, last_activity_date) VALUES (?, 0, ?)',
            ('Language Learner', datetime.now().strftime('%Y-%m-%d'))
        )
        conn.commit()
    
    conn.close()


def load_vocabulary_from_csv(language: str = 'kannada'):
    """Load vocabulary from CSV file into database"""
    import os
    # Map language codes to configured CSV paths
    vocab_file = None
    if language == 'kannada':
        vocab_file = config.KANNADA_VOCAB_FILE
    elif language == 'hindi':
        vocab_file = getattr(config, 'HINDI_VOCAB_FILE', None)
    elif language == 'urdu':
        vocab_file = getattr(config, 'URDU_VOCAB_FILE', None)
    else:
        # Try to find a csv in the vocab directory matching the language code
        candidate = os.path.join(config.VOCAB_DIR, f"{language}-oxford-5000.csv")
        if os.path.exists(candidate):
            vocab_file = candidate

    if not vocab_file or not os.path.exists(vocab_file):
        print(f"Vocabulary file not found for {language} -> {vocab_file}")
        return
    
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    # Check if vocabulary already loaded
    cursor.execute('SELECT COUNT(*) FROM vocabulary WHERE language = ?', (language,))
    existing_count = cursor.fetchone()[0]
    if existing_count > 0:
        # If entries already exist for this language, remove them and reload.
        # This handles previous runs where CSV headers (e.g. with BOM) caused empty
        # or malformed imports. Safer to replace than to leave incomplete rows.
        print(f"Existing vocabulary for {language} detected ({existing_count} rows) - deleting and reloading...")
        cursor.execute('DELETE FROM vocabulary WHERE language = ?', (language,))
        conn.commit()
    
    print(f"Loading vocabulary from {vocab_file}...")
    from . import transliteration
    with open(vocab_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        # Normalize fieldnames to remove BOM or stray whitespace (some CSVs have '\ufeff' in header)
        if reader.fieldnames:
            normalized_fieldnames = [fn.replace('\ufeff', '').strip() if fn else fn for fn in reader.fieldnames]
            reader.fieldnames = normalized_fieldnames
        count = 0
        for row in reader:
            # Normalize transliteration to ensure consistency (ṃ vs ṁ, visarga handling, etc.)
            raw_transliteration = row.get('transliteration', '')
            normalized_transliteration = ''
            if raw_transliteration:
                # Use the clean_iast function to standardize transliteration format
                normalized_transliteration = transliteration.clean_iast(raw_transliteration)
            
            # Support flexible CSV column names for the translation column
            translation_col = None
            for candidate_col in ['translation', 'kannada_translation', 'hindi_translation', 'urdu_translation', 'tamil_translation', 'telugu_translation', 'malayalam_translation']:
                if candidate_col in row and row.get(candidate_col, '').strip() != '':
                    translation_col = candidate_col
                    break

            translation_value = row.get(translation_col, '') if translation_col else row.get('translation', '')

            cursor.execute('''
                INSERT INTO vocabulary 
                (language, english_word, translation, transliteration, word_class, level, verb_transitivity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                language,
                row.get('english_word', ''),
                translation_value,
                normalized_transliteration,
                row.get('word_class', ''),
                row.get('level', ''),
                row.get('verb_transitivity', '')
            ))
            count += 1
    
    conn.commit()
    conn.close()

    # Ensure lesson words cache table exists
    ensure_lesson_words_table()


# ----------------------------------------------------------------------------
# Utility: lesson words cache table
# ----------------------------------------------------------------------------
def ensure_lesson_words_table():
    """Create the lesson_words cache table if it doesn't exist."""
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lesson_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            language TEXT NOT NULL,
            lesson_id TEXT NOT NULL,
            text TEXT NOT NULL,
            gloss TEXT
        )
    ''')
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_words_unique ON lesson_words(language, lesson_id, text)')
    conn.commit()
    conn.close()


# ============================================================================
# User Profile Operations
# ============================================================================

def get_user_profile() -> Dict:
    """Get user profile with streak"""
    try:
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM user_profile WHERE id = 1')
        profile = cursor.fetchone()
        conn.close()
        
        return dict(profile) if profile else {}
    except Exception as e:
        print(f"Error in get_user_profile: {str(e)}")
        return {'streak': 0}


def calculate_goal_based_streak(user_id: int = 1) -> Dict[str, int]:
    """Calculate streak based on goal completion
    
    Returns the longest continuous stretch of days (including today) where all goals were met.
    
    Returns:
        {
            'current_streak': int,  # Days where all goals were met consecutively including today
            'longest_streak': int,  # Longest streak ever
            'today_complete': bool  # Whether today's goals are all met
        }
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        today = config.get_current_time().date()
        
        # Get the last 365 days of data to calculate streak
        # We'll check backwards from today to find consecutive days where ALL goals were met
        current_streak = 0
        longest_streak = 0
        temp_streak = 0
        today_complete = False
        
        # Check each day backwards from today
        for days_ago in range(365):  # Check up to a year back
            check_date = today - timedelta(days=days_ago)
            date_str = check_date.strftime('%Y-%m-%d')
            
            # Get all goals for this day
            cursor.execute('''
                SELECT language, activity_type, target_count
                FROM weekly_goals
                WHERE week_start_date = ? AND day_of_week = ?
            ''', (get_week_start(check_date).strftime('%Y-%m-%d'), check_date.strftime('%A').lower()))
            
            goals = cursor.fetchall()
            
            # If no goals set for this day, skip it (don't break streak)
            if not goals:
                if days_ago == 0:
                    today_complete = True  # No goals = automatically complete
                continue
            
            # Get progress for this day (count completed activities)
            all_goals_met = True
            for goal in goals:
                cursor.execute('''
                    SELECT COUNT(*) as count
                    FROM activity_history
                    WHERE language = ? 
                    AND activity_type = ?
                    AND DATE(completed_at) = ?
                    AND score > 0
                ''', (goal['language'], goal['activity_type'], date_str))
                
                progress_row = cursor.fetchone()
                progress_count = progress_row['count'] if progress_row else 0
                
                if progress_count < goal['target_count']:
                    all_goals_met = False
                    break
            
            if all_goals_met:
                temp_streak += 1
                if days_ago == 0:
                    today_complete = True
                    current_streak = temp_streak
            else:
                # Streak broken
                if days_ago == 0:
                    today_complete = False
                    current_streak = 0
                    temp_streak = 0
                else:
                    # We've found the end of the current streak
                    if temp_streak > current_streak:
                        current_streak = temp_streak
                    break
            
            # Track longest streak
            if temp_streak > longest_streak:
                longest_streak = temp_streak
        
        conn.close()
        
        return {
            'current_streak': current_streak,
            'longest_streak': max(longest_streak, current_streak),
            'today_complete': today_complete
        }
        
    except Exception as e:
        print(f"Error calculating goal-based streak: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'current_streak': 0,
            'longest_streak': 0,
            'today_complete': False
        }


def update_streak():
    """Legacy function - now replaced by calculate_goal_based_streak()
    
    This function is kept for backward compatibility but should not be used.
    Use calculate_goal_based_streak() instead which calculates streak based on goal completion.
    """
    # This function is now deprecated - streak is calculated on-demand from goals
    pass


def update_user_profile(name: Optional[str] = None, username: Optional[str] = None, profile_picture_url: Optional[str] = None) -> bool:
    """Update user profile name, username, and/or profile picture"""
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        updates = []
        params = []
        
        if name is not None:
            updates.append('name = ?')
            params.append(name)
        
        if username is not None:
            # Treat empty strings as None (NULL in database)
            username_value = username.strip() if username.strip() else None
            updates.append('username = ?')
            params.append(username_value)
        
        if profile_picture_url is not None:
            # Treat empty strings as None (NULL in database)
            url_value = profile_picture_url.strip() if profile_picture_url.strip() else None
            updates.append('profile_picture_url = ?')
            params.append(url_value)
        
        if updates:
            params.append(1)  # user_id = 1
            query = f'UPDATE user_profile SET {", ".join(updates)} WHERE id = ?'
            cursor.execute(query, params)
            conn.commit()
        
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating user profile: {str(e)}")
        return False


def get_user_settings(language: str = 'kannada') -> Dict[str, str]:
    """Get all user settings for a specific language"""
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT setting_key, setting_value 
            FROM user_settings 
            WHERE user_id = 1 AND language = ?
        ''', (language,))
        rows = cursor.fetchall()
        conn.close()
        
        settings = {}
        for row in rows:
            settings[row['setting_key']] = row['setting_value']
        
        return settings
    except Exception as e:
        print(f"Error getting user settings: {str(e)}")
        return {}


def update_user_setting(setting_key: str, setting_value: str, language: str = 'kannada') -> bool:
    """Update or insert a user setting for a specific language"""
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO user_settings (user_id, language, setting_key, setting_value)
            VALUES (1, ?, ?, ?)
        ''', (language, setting_key, setting_value))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating user setting: {str(e)}")
        return False


def get_srs_settings_for_language(language: str) -> Dict[str, float]:
    """Get SRS settings for a language, with defaults from config if not set"""
    settings = get_user_settings(language)
    
    return {
        'default_ease_factor': float(settings.get('default_ease_factor', config.DEFAULT_EASE_FACTOR)),
        'min_ease_factor': float(settings.get('min_ease_factor', config.MIN_EASE_FACTOR)),
        'max_ease_factor': float(settings.get('max_ease_factor', config.MAX_EASE_FACTOR)),
        'ease_factor_increment': float(settings.get('ease_factor_increment', config.EASE_FACTOR_INCREMENT)),
        'ease_factor_decrement': float(settings.get('ease_factor_decrement', config.EASE_FACTOR_DECREMENT)),
    }


def get_language_for_word(word_id: int) -> str:
    """Get the language for a word_id"""
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT language FROM vocabulary WHERE id = ?', (word_id,))
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result else 'kannada'  # Default to kannada if not found
    except Exception as e:
        print(f"Error getting language for word: {str(e)}")
        return 'kannada'


# ============================================================================
# Vocabulary Operations
# ============================================================================

def get_words_for_review(language: str, limit: int = 10, user_id: int = 1) -> List[Dict]:
    """Get words for flashcard review based on SRS algorithm and daily quota.
    
    Returns:
    - Due reviews (next_review_date <= today) - unlimited, prioritized by overdue
    - New cards - loads generously to ensure continuous learning
    
    Strategy:
    - Prioritize overdue reviews (critical for retention)
    - Include new cards (not overly restricted by quota to keep learning flowing)
    - Return enough cards for sustained practice
    """
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    today = config.get_current_time().date()
    today_str = today.strftime('%Y-%m-%d')
    
    # Get today's quota to track progress (but don't strictly limit)
    quota = get_daily_quota(language, today_str, user_id)
    new_cards_completed = quota['new_cards_completed']
    new_cards_quota = quota['new_cards_quota']
    
    # Calculate how many new cards to include in this batch
    # IMPORTANT: Frontend creates 2 flashcards per word (bidirectional testing)
    # So if quota is 10, we need at least 10 words to make 20 cards
    # Be generous: allow 3x quota to ensure continuous learning with bidirectional cards
    new_cards_remaining = max(10, (new_cards_quota * 3) - new_cards_completed)
    
    # Fetch DUE reviews (including cards marked for "again" - same day review)
    cursor.execute('''
        SELECT v.*, 
               ws.mastery_level as mastery_level,
               ws.next_review_date as next_review_date,
               ws.review_count as review_count,
               ws.ease_factor as ease_factor,
               ws.last_reviewed as last_reviewed,
               ws.introduced_date as introduced_date
        FROM vocabulary v
        JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = ?
        WHERE v.language = ?
          AND ws.mastery_level != 'new'
          AND ws.next_review_date IS NOT NULL
          AND ws.next_review_date <= ?
    ''', (user_id, language, today_str))

    review_rows = cursor.fetchall()
    
    # Fetch NEW cards (not yet introduced) if we have quota remaining
    new_rows = []
    if new_cards_remaining > 0:
        # Order by level first (easiest to hardest), then by ID (insertion order)
        # Level ordering: a1 < a2 < b1 < b2 < c1 < c2
        cursor.execute('''
            SELECT v.*, 
                   COALESCE(ws.mastery_level, 'new') as mastery_level,
                   COALESCE(ws.next_review_date, '') as next_review_date,
                   COALESCE(ws.review_count, 0) as review_count,
                   COALESCE(ws.ease_factor, ?) as ease_factor,
                   COALESCE(ws.last_reviewed, '') as last_reviewed,
                   COALESCE(ws.introduced_date, '') as introduced_date,
                   CASE v.level
                       WHEN 'a1' THEN 1
                       WHEN 'a2' THEN 2
                       WHEN 'b1' THEN 3
                       WHEN 'b2' THEN 4
                       WHEN 'c1' THEN 5
                       WHEN 'c2' THEN 6
                       ELSE 7
                   END as level_order
            FROM vocabulary v
            LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = ?
            WHERE v.language = ?
              AND (ws.id IS NULL OR ws.mastery_level = 'new')
              AND (ws.introduced_date IS NULL OR ws.introduced_date = '')
            ORDER BY level_order ASC, v.id ASC
            LIMIT ?
        ''', (config.DEFAULT_EASE_FACTOR, user_id, language, new_cards_remaining))
        
        new_rows = cursor.fetchall()
    
    conn.close()

    def parse_date(date_str: str):
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        except Exception:
            return None

    # Prioritize review cards
    review_candidates = []
    for row in review_rows:
        row_dict = dict(row)
        next_review_dt = parse_date(row_dict.get('next_review_date') or '')
        last_review_dt = parse_date(row_dict.get('last_reviewed') or '')

        # Priority components
        overdue_days = 0
        if next_review_dt and next_review_dt < today:
            overdue_days = (today - next_review_dt).days

        mastery_level = row_dict.get('mastery_level', 'review')
        mastery_boost = {
            'learning': 4,
            'review': 3,
            'mastered': 1,
        }.get(mastery_level, 2)

        ease_factor = row_dict.get('ease_factor') or config.DEFAULT_EASE_FACTOR
        # Lower ease_factor => higher priority (harder cards)
        difficulty_boost = max(0.0, 3.5 - float(ease_factor)) * 2

        recency_penalty = 0
        if last_review_dt and (today - last_review_dt).days < 1:
            recency_penalty = 1  # slight de-prioritize if reviewed today

        # CEFR level ordering (prefer lower levels: A1 > A2 > B1 > B2 > C1 > C2)
        # This ensures foundational vocabulary is prioritized when priority is similar
        level_order = {
            'a1': 1, 'a2': 2, 'b1': 3, 'b2': 4, 'c1': 5, 'c2': 6
        }.get((row_dict.get('level') or '').lower(), 7)

        priority = (
            overdue_days * 5          # Most important: overdue reviews
            + difficulty_boost        # Second: difficult words (low ease factor)
            + mastery_boost          # Third: learning > review > mastered
            - level_order * 0.5      # Fourth: prefer lower CEFR levels (A1 > C2)
            - recency_penalty        # Fifth: slight penalty for same-day reviews
        )

        review_candidates.append((priority, row_dict))

    # Sort reviews by priority descending (highest priority first)
    review_candidates.sort(key=lambda x: x[0], reverse=True)
    
    # Combine: prioritized reviews + new cards
    prioritized = [c[1] for c in review_candidates]
    
    # Add new cards (already limited by quota)
    for row in new_rows:
        prioritized.append(dict(row))
    
    return prioritized[:limit]


# ============================================================================
# SRS Settings and Quota Management
# ============================================================================

def get_srs_settings(language: str, user_id: int = 1) -> Dict:
    """Get SRS settings for a language (or defaults if not set)"""
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM srs_settings 
            WHERE user_id = ? AND language = ?
        ''', (user_id, language))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'language': row['language'],
                'new_cards_per_day': row['new_cards_per_day'],
                'reviews_per_day': row['reviews_per_day'],
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
            }
        else:
            # Return defaults
            return {
                'language': language,
                'new_cards_per_day': config.DEFAULT_NEW_CARDS_PER_DAY,
                'reviews_per_day': config.DEFAULT_REVIEWS_PER_DAY,
                'created_at': None,
                'updated_at': None,
            }
    except Exception as e:
        print(f"Error getting SRS settings: {str(e)}")
        return {
            'language': language,
            'new_cards_per_day': config.DEFAULT_NEW_CARDS_PER_DAY,
            'reviews_per_day': config.DEFAULT_REVIEWS_PER_DAY,
            'created_at': None,
            'updated_at': None,
        }


def update_srs_settings(language: str, new_cards_per_day: int, reviews_per_day: int, user_id: int = 1) -> bool:
    """Update SRS settings for a language and recalculate daily quotas"""
    try:
        # Validate input
        if new_cards_per_day < 0 or reviews_per_day < 0:
            return False
        
        # Validate reviews_per_day >= new_cards_per_day * MIN_REVIEWS_MULTIPLIER
        min_reviews = new_cards_per_day * config.MIN_REVIEWS_MULTIPLIER
        if reviews_per_day < min_reviews:
            return False
        
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        # Update or insert settings
        cursor.execute('''
            INSERT OR REPLACE INTO srs_settings 
            (user_id, language, new_cards_per_day, reviews_per_day, updated_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, language, new_cards_per_day, reviews_per_day, config.get_current_time().isoformat()))
        
        conn.commit()
        conn.close()
        
        # Recalculate daily quotas for current week
        _recalculate_daily_quotas(language, user_id)
        
        return True
    except Exception as e:
        print(f"Error updating SRS settings: {str(e)}")
        return False


def _recalculate_daily_quotas(language: str, user_id: int = 1):
    """Recalculate daily quotas for the current week based on SRS settings"""
    try:
        settings = get_srs_settings(language, user_id)
        
        # Daily quotas are now directly set in settings
        daily_new = settings['new_cards_per_day']
        daily_reviews = settings['reviews_per_day']
        
        # Get current date and calculate week boundaries
        today = config.get_current_time().date()
        
        # Calculate quotas for next 7 days
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        for i in range(7):
            date = today + timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            
            # Check if quota already exists
            cursor.execute('''
                SELECT new_cards_completed, reviews_completed 
                FROM srs_daily_quota 
                WHERE user_id = ? AND language = ? AND date = ?
            ''', (user_id, language, date_str))
            
            row = cursor.fetchone()
            
            if row:
                # Update quotas but preserve completed counts
                cursor.execute('''
                    UPDATE srs_daily_quota 
                    SET new_cards_quota = ?, reviews_quota = ?
                    WHERE user_id = ? AND language = ? AND date = ?
                ''', (daily_new, daily_reviews, user_id, language, date_str))
            else:
                # Insert new quota
                cursor.execute('''
                    INSERT INTO srs_daily_quota 
                    (user_id, language, date, new_cards_quota, new_cards_completed, reviews_quota, reviews_completed)
                    VALUES (?, ?, ?, ?, 0, ?, 0)
                ''', (user_id, language, date_str, daily_new, daily_reviews))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error recalculating daily quotas: {str(e)}")


def sync_srs_quotas_from_weekly_goals(language: str, week_start_date: str = None, user_id: int = 1):
    """Sync SRS daily quotas from weekly flashcard goals
    
    This function reads the weekly goals for flashcards and sets the SRS daily quotas
    accordingly. This ensures flashcard quotas match the user's weekly goals.
    
    Args:
        language: Language code
        week_start_date: Monday of the target week (YYYY-MM-DD), defaults to current week
        user_id: User ID
    """
    try:
        from datetime import datetime, timedelta
        
        # Get weekly goals for this language
        weekly_goals = get_weekly_goals(language, week_start_date)
        
        if not weekly_goals:
            print(f"No weekly goals found for {language}, using default SRS settings")
            _recalculate_daily_quotas(language, user_id)
            return
        
        # Calculate week start if not provided
        if week_start_date is None:
            today = config.get_current_time()
            week_start = today - timedelta(days=today.weekday())
            week_start_date = week_start.strftime('%Y-%m-%d')
        else:
            week_start = datetime.strptime(week_start_date, '%Y-%m-%d')
        
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        
        # Process each day of the week
        for i, day_name in enumerate(day_names):
            date = week_start + timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            
            # Get flashcard goal for this day
            day_goals = weekly_goals.get(day_name, {})
            flashcard_goal = day_goals.get('flashcards', 0)
            
            # Set the daily quota based on weekly goal
            # Assuming flashcard goal means total cards (new + reviews)
            # Split 30/70 between new and reviews (adjust as needed)
            new_cards_quota = int(flashcard_goal * 0.3) if flashcard_goal > 0 else 0
            reviews_quota = flashcard_goal - new_cards_quota if flashcard_goal > 0 else 0
            
            # Check if quota already exists
            cursor.execute('''
                SELECT new_cards_completed, reviews_completed 
                FROM srs_daily_quota 
                WHERE user_id = ? AND language = ? AND date = ?
            ''', (user_id, language, date_str))
            
            row = cursor.fetchone()
            
            if row:
                # Update quotas but preserve completed counts
                cursor.execute('''
                    UPDATE srs_daily_quota 
                    SET new_cards_quota = ?, reviews_quota = ?
                    WHERE user_id = ? AND language = ? AND date = ?
                ''', (new_cards_quota, reviews_quota, user_id, language, date_str))
            else:
                # Insert new quota
                cursor.execute('''
                    INSERT INTO srs_daily_quota 
                    (user_id, language, date, new_cards_quota, new_cards_completed, reviews_quota, reviews_completed)
                    VALUES (?, ?, ?, ?, 0, ?, 0)
                ''', (user_id, language, date_str, new_cards_quota, reviews_quota))
        
        conn.commit()
        conn.close()
        
        print(f"✓ Synced SRS quotas from weekly goals for {language} (week {week_start_date})")
        
    except Exception as e:
        print(f"Error syncing SRS quotas from weekly goals: {str(e)}")
        import traceback
        traceback.print_exc()


def sync_all_languages_srs_quotas(week_start_date: str = None, user_id: int = 1):
    """Sync SRS quotas for all active languages from their weekly goals
    
    Args:
        week_start_date: Monday of the target week (YYYY-MM-DD), defaults to current week
        user_id: User ID
    """
    try:
        # Get all weekly goals across all languages
        all_goals = get_all_languages_today_goals()
        
        # Sync each language that has goals
        for language in all_goals.keys():
            sync_srs_quotas_from_weekly_goals(language, week_start_date, user_id)
        
        print(f"✓ Synced SRS quotas for {len(all_goals)} languages")
        return True
        
    except Exception as e:
        print(f"Error syncing all languages SRS quotas: {str(e)}")
        return False


def get_daily_quota(language: str, date: str = None, user_id: int = 1) -> Dict:
    """Get daily quota for a specific date (defaults to today)"""
    try:
        if date is None:
            date = config.get_current_date_str()
        
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM srs_daily_quota 
            WHERE user_id = ? AND language = ? AND date = ?
        ''', (user_id, language, date))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'date': row['date'],
                'new_cards_quota': row['new_cards_quota'],
                'new_cards_completed': row['new_cards_completed'],
                'reviews_quota': row['reviews_quota'],
                'reviews_completed': row['reviews_completed'],
            }
        else:
            # Create quota for this date
            _recalculate_daily_quotas(language, user_id)
            # Try again
            return get_daily_quota(language, date, user_id)
    except Exception as e:
        print(f"Error getting daily quota: {str(e)}")
        settings = get_srs_settings(language, user_id)
        return {
            'date': date or config.get_current_date_str(),
            'new_cards_quota': settings['new_cards_per_week'] // 7,
            'new_cards_completed': 0,
            'reviews_quota': settings['reviews_per_week'] // 7,
            'reviews_completed': 0,
        }


def increment_daily_quota(language: str, is_new_card: bool, user_id: int = 1):
    """Increment the completed count for new cards or reviews"""
    try:
        date = config.get_current_date_str()
        
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        if is_new_card:
            cursor.execute('''
                UPDATE srs_daily_quota 
                SET new_cards_completed = new_cards_completed + 1 
                WHERE user_id = ? AND language = ? AND date = ?
            ''', (user_id, language, date))
        else:
            cursor.execute('''
                UPDATE srs_daily_quota 
                SET reviews_completed = reviews_completed + 1 
                WHERE user_id = ? AND language = ? AND date = ?
            ''', (user_id, language, date))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error incrementing daily quota: {str(e)}")


def get_srs_stats(language: str, user_id: int = 1) -> Dict:
    """Get comprehensive SRS stats for a language"""
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        today = config.get_current_date_str()
        
        # Count words by mastery level
        cursor.execute('''
            SELECT 
                COALESCE(ws.mastery_level, 'new') as mastery_level,
                COUNT(*) as count
            FROM vocabulary v
            LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = ?
            WHERE v.language = ?
            GROUP BY COALESCE(ws.mastery_level, 'new')
        ''', (user_id, language))
        
        mastery_counts = {row['mastery_level']: row['count'] for row in cursor.fetchall()}
        
        # Count due reviews (next_review_date <= today)
        cursor.execute('''
            SELECT COUNT(*) as count
            FROM vocabulary v
            JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = ?
            WHERE v.language = ?
              AND ws.next_review_date IS NOT NULL
              AND ws.next_review_date <= ?
              AND ws.mastery_level != 'new'
        ''', (user_id, language, today))
        
        due_count = cursor.fetchone()['count']
        
        # Get today's quota
        quota = get_daily_quota(language, today, user_id)
        
        # Count new cards available (not yet introduced)
        cursor.execute('''
            SELECT COUNT(*) as count
            FROM vocabulary v
            LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = ?
            WHERE v.language = ?
              AND (ws.id IS NULL OR ws.mastery_level = 'new')
              AND (ws.introduced_date IS NULL OR ws.introduced_date = '')
        ''', (user_id, language))
        
        total_new = cursor.fetchone()['count']
        
        conn.close()
        
        # Calculate new cards available today
        new_available_today = max(0, quota['new_cards_quota'] - quota['new_cards_completed'])
        new_available_today = min(new_available_today, total_new)
        
        return {
            'due_count': due_count,
            'new_count': new_available_today,
            'total_new': total_new,
            'total_learning': mastery_counts.get('learning', 0),
            'total_review': mastery_counts.get('review', 0),
            'total_mastered': mastery_counts.get('mastered', 0),
            'today_new_completed': quota['new_cards_completed'],
            'today_reviews_completed': quota['reviews_completed'],
            'today_new_quota': quota['new_cards_quota'],
            'today_reviews_quota': quota['reviews_quota'],
        }
    except Exception as e:
        print(f"Error getting SRS stats: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'due_count': 0,
            'new_count': 0,
            'total_new': 0,
            'total_learning': 0,
            'total_review': 0,
            'total_mastered': 0,
            'today_new_completed': 0,
            'today_reviews_completed': 0,
            'today_new_quota': 0,
            'today_reviews_quota': 0,
        }


def check_and_log_flashcard_completion(language: str, user_id: int = 1) -> bool:
    """Check if daily flashcard goal is met and log as activity if complete
    
    Checks if the number of cards reviewed (new + reviews) meets or exceeds
    the daily flashcard goal from weekly_goals.
    
    Returns True if flashcards were completed for the day, False otherwise
    """
    try:
        from datetime import datetime, timedelta
        
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        today = config.get_current_date_str()
        
        # Get today's quota to see how many cards have been completed
        quota = get_daily_quota(language, today, user_id)
        total_cards_completed = quota['new_cards_completed'] + quota['reviews_completed']
        
        # Get today's flashcard goal from weekly_goals
        today_date = datetime.now()
        week_start_date = (today_date - timedelta(days=today_date.weekday())).strftime('%Y-%m-%d')
        day_of_week = today_date.strftime('%A').lower()
        
        cursor.execute('''
            SELECT target_count
            FROM weekly_goals
            WHERE language = ?
              AND week_start_date = ?
              AND day_of_week = ?
              AND activity_type = 'flashcards'
        ''', (language, week_start_date, day_of_week))
        
        goal_row = cursor.fetchone()
        
        # If no goal set for today, don't log completion
        if not goal_row or goal_row['target_count'] == 0:
            conn.close()
            return False
        
        flashcard_goal = goal_row['target_count']
        
        # Check if we've met the goal
        goal_met = total_cards_completed >= flashcard_goal
        
        if not goal_met:
            conn.close()
            return False
        
        # Check if we've already logged flashcard activity for today
        cursor.execute('''
            SELECT COUNT(*) as count
            FROM daily_progress
            WHERE user_id = ?
              AND language = ?
              AND activity_type = 'flashcards'
              AND date = ?
        ''', (user_id, language, today))
        
        already_logged = cursor.fetchone()['count'] > 0
        
        if already_logged:
            conn.close()
            return True  # Already completed and logged
        
        # Log flashcard activity
        cursor.execute('''
            INSERT INTO activity_history (user_id, language, activity_type, activity_data, score, completed_at)
            VALUES (?, ?, 'flashcards', ?, 1.0, datetime('now'))
        ''', (user_id, language, f'{{"new_completed": {quota["new_cards_completed"]}, "reviews_completed": {quota["reviews_completed"]}, "total_cards": {total_cards_completed}, "goal": {flashcard_goal}}}'))
        
        # Update daily progress
        cursor.execute('''
            INSERT INTO daily_progress (user_id, language, activity_type, date, count)
            VALUES (?, ?, 'flashcards', ?, 1)
        ''', (user_id, language, today))
        
        conn.commit()
        conn.close()
        
        print(f"✓ Flashcard activity logged for {language} on {today}: {total_cards_completed}/{flashcard_goal} cards")
        return True
        
    except Exception as e:
        print(f"Error checking flashcard completion: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def get_words_for_activity(language: str, limit: int = 10, learned_limit: int = None, learning_limit: int = None) -> List[Dict]:
    """Get random words for reading activities: randomly selected learned and learning words
    
    Args:
        language: Language code
        limit: Total number of words to return (if learned_limit and learning_limit not specified)
        learned_limit: Number of learned (mastered) words to randomly select
        learning_limit: Number of learning/review words to randomly select
    """
    import random
    conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # If specific limits provided, use them; otherwise calculate from total limit
        if learned_limit is None:
            learned_limit = int(limit * 0.75)  # 70-80% learned words
        if learning_limit is None:
            learning_limit = limit - learned_limit  # Remaining for learning words
        
        # Get ALL mastered words first, then randomly select
        cursor.execute('''
            SELECT v.*, COALESCE(ws.mastery_level, 'new') as mastery_level,
                   COALESCE(ws.next_review_date, '') as next_review_date
            FROM vocabulary v
            LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = 1
            WHERE v.language = ?
            AND COALESCE(ws.mastery_level, 'new') = 'mastered'
        ''', (language,))
        
        all_mastered = [dict(row) for row in cursor.fetchall()]
        # Randomly select from all mastered words
        mastered_words = random.sample(all_mastered, min(learned_limit, len(all_mastered))) if all_mastered else []
        
        # Get ALL learning/review words first, then randomly select
        cursor.execute('''
            SELECT v.*, COALESCE(ws.mastery_level, 'new') as mastery_level,
                   COALESCE(ws.next_review_date, '') as next_review_date
            FROM vocabulary v
            LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = 1
            WHERE v.language = ?
            AND COALESCE(ws.mastery_level, 'new') IN ('learning', 'review')
        ''', (language,))
        
        all_learning = [dict(row) for row in cursor.fetchall()]
        # Randomly select from all learning/review words
        learning_words = random.sample(all_learning, min(learning_limit, len(all_learning))) if all_learning else []
        
        # If no learning/review words, use "new" words as learning words
        if not learning_words and learning_limit > 0:
            cursor.execute('''
                SELECT v.*, COALESCE(ws.mastery_level, 'new') as mastery_level,
                       COALESCE(ws.next_review_date, '') as next_review_date
                FROM vocabulary v
                LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = 1
                WHERE v.language = ?
                AND COALESCE(ws.mastery_level, 'new') = 'new'
            ''', (language,))
            all_new = [dict(row) for row in cursor.fetchall()]
            # Randomly select from all new words
            learning_words = random.sample(all_new, min(learning_limit, len(all_new))) if all_new else []
            # Mark these as 'learning' for the activity (temporarily, just for the word bank)
            for word in learning_words:
                word['mastery_level'] = 'learning'
        
        conn.close()
        
        # Combine and return
        return mastered_words + learning_words
    
    except Exception as e:
        print(f"Error in get_words_for_activity: {e}")
        if conn:
            conn.close()
        return []


def calculate_similarity_score(search: str, word: str, field_type: str = 'transliteration') -> float:
    """Calculate similarity score between search query and word
    Returns a score from 0.0 to 1.0, where 1.0 is a perfect match
    Higher scores mean better matches
    
    If word contains "/", treats each term as independent and returns the best match
    
    Args:
        search: The search query
        word: The word to compare against (may contain "/" separated terms)
        field_type: Type of field ('transliteration', 'english', 'kannada')
    
    Returns:
        Similarity score (0.0 to 1.0)
    """
    if not search or not word:
        return 0.0
    
    search_lower = search.lower().strip()
    
    # Split word by "/" and compare against each term independently
    # Take the best (highest) score
    word_terms = [term.strip() for term in word.split('/')]
    best_score = 0.0
    
    for word_term in word_terms:
        if not word_term:
            continue
        
        word_lower = word_term.lower().strip()
        
        # Exact match (highest priority)
        if search_lower == word_lower:
            return 1.0  # Perfect match, return immediately
        
        # Starts with query (very high priority)
        if word_lower.startswith(search_lower):
            # Bonus for shorter words (closer match)
            length_ratio = len(search_lower) / len(word_lower) if word_lower else 0
            score = 0.9 + (0.1 * length_ratio)
            best_score = max(best_score, score)
            continue
        
        # Query starts with word (high priority - e.g., search "rasayana" matches "rasa")
        if search_lower.startswith(word_lower):
            length_ratio = len(word_lower) / len(search_lower) if search_lower else 0
            score = 0.8 + (0.1 * length_ratio)
            best_score = max(best_score, score)
            continue
        
        # Contains query (medium-high priority)
        if search_lower in word_lower:
            # Position matters - earlier in word is better
            position = word_lower.find(search_lower)
            position_ratio = 1.0 - (position / len(word_lower)) if word_lower else 0
            length_ratio = len(search_lower) / len(word_lower) if word_lower else 0
            score = 0.6 + (0.2 * position_ratio * length_ratio)
            best_score = max(best_score, score)
            continue
        
        # Query contains word (medium priority)
        if word_lower in search_lower:
            length_ratio = len(word_lower) / len(search_lower) if search_lower else 0
            score = 0.5 + (0.1 * length_ratio)
            best_score = max(best_score, score)
            continue
        
        # Calculate edit distance (Levenshtein) for fuzzy matching
        # Simple Levenshtein distance implementation
        def levenshtein_distance(s1: str, s2: str) -> int:
            if len(s1) < len(s2):
                return levenshtein_distance(s2, s1)
            if len(s2) == 0:
                return len(s1)
            
            previous_row = range(len(s2) + 1)
            for i, c1 in enumerate(s1):
                current_row = [i + 1]
                for j, c2 in enumerate(s2):
                    insertions = previous_row[j + 1] + 1
                    deletions = current_row[j] + 1
                    substitutions = previous_row[j] + (c1 != c2)
                    current_row.append(min(insertions, deletions, substitutions))
                previous_row = current_row
            return previous_row[-1]
        
        # Normalize edit distance to similarity score
        max_len = max(len(search_lower), len(word_lower))
        if max_len > 0:
            edit_dist = levenshtein_distance(search_lower, word_lower)
            # Convert distance to similarity (0 = identical, max_len = completely different)
            similarity = 1.0 - (edit_dist / max_len)
            
            # Apply penalty for longer distances relative to word length
            # Shorter words should match more strictly
            if edit_dist > max_len * 0.5:  # More than 50% different
                similarity *= 0.3  # Heavy penalty
            
            # Cap minimum similarity for very different words
            if similarity >= 0.2:
                best_score = max(best_score, similarity)
    
    return best_score


def normalize_iast_diacritics(text: str) -> str:
    """Remove IAST diacritics for fuzzy search
    Converts: ā, ē, ī, ō, ū → a, e, i, o, u
    Converts: ṛ, ṝ, ḷ, ḹ → r, l
    Converts: ṃ, ṁ → m
    Converts: ṇ, ṭ, ḍ, ṣ, ś → n, t, d, s, s
    Removes: ḥ
    
    Also handles common romanization patterns:
    - Digraphs for long vowels: aa→a, ee→e, ii→i, oo→o, uu→u
    - Retroflex consonants: T→t, D→d, N→n
    """
    if not text:
        return text
    
    # Map of diacritic characters to their base forms
    diacritic_map = {
        # Long vowels
        'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u',
        # R and L variants
        'ṛ': 'r', 'ṝ': 'r', 'ḷ': 'l', 'ḹ': 'l',
        # M variants
        'ṃ': 'm', 'ṁ': 'm',  # Both map to 'm' for normalization
        # Consonants with diacritics
        'ṇ': 'n', 'ṭ': 't', 'ḍ': 'd', 'ṣ': 's', 'ś': 's',
        # Visarga
        'ḥ': '',
    }
    
    normalized = text.lower()
    
    # First, normalize IAST diacritics to base forms
    for diacritic, base in diacritic_map.items():
        normalized = normalized.replace(diacritic, base)
    
    # Then, handle common romanization digraphs (double vowels → single)
    # This allows "aa" to match "ā" (which becomes "a" after normalization)
    # Order matters: replace longer patterns first
    romanization_map = {
        'aa': 'a',
        'ee': 'e', 
        'ii': 'i',
        'oo': 'o',
        'uu': 'u',
    }
    
    for romanized, normalized_form in romanization_map.items():
        normalized = normalized.replace(romanized, normalized_form)
    
    return normalized


def get_vocabulary(
    language: str, 
    search: str = '', 
    mastery_filter: str = '',
    word_class_filter: str = '',
    level_filter: str = '',
    limit: int = 50,
    offset: int = 0
) -> tuple:
    """Get vocabulary with optional search and filters, returns words and total count"""
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Base WHERE clause
    where_clause = 'WHERE v.language = ?'
    params = [language]
    
    if search:
        # Normalize search query (remove diacritics for fuzzy matching)
        try:
            normalized_search = normalize_iast_diacritics(search)
            normalized_search_term = f'%{normalized_search}%'
        except Exception as e:
            print(f"Error normalizing search '{search}': {e}")
            normalized_search = search
            normalized_search_term = f'%{search}%'
        
        # Search is case-insensitive and works with:
        # 1. English word (exact match)
        # 2. Kannada text (exact match)
        # 3. Transliteration (exact match)
        # 4. Normalized transliteration (fuzzy match - ignores diacritics)
        # For fuzzy matching, we fetch a broader set of candidates based on:
        # - Exact matches in English, Kannada, or transliteration
        # - Matches in transliteration that might match after normalization
        # Then we filter in Python by normalizing transliterations
        search_term = f'%{search}%'
        normalized_search_term = f'%{normalized_search}%'
        
        # Broader query: check if search appears in any field
        # We'll do fuzzy matching in Python after fetching candidates
        # For SQL, fetch candidates that might match after normalization
        # Check both original search and normalized search, and also check for significant substrings
        # Extract significant parts (3+ chars) from search for substring matching
        significant_parts = [search[i:i+3] for i in range(len(search)-2)] if len(search) >= 3 else [search]
        part_conditions = ' OR '.join(['LOWER(v.transliteration) LIKE LOWER(?)' for _ in significant_parts])
        part_params = [f'%{part}%' for part in significant_parts]
        
        where_clause += f''' AND (
            LOWER(v.english_word) LIKE LOWER(?) 
            OR v.translation LIKE ? 
            OR LOWER(v.transliteration) LIKE LOWER(?)
            OR LOWER(v.english_word) LIKE LOWER(?)
            OR {part_conditions}
        )'''
        # Use search term and normalized search, plus significant parts
        params.extend([search_term, search_term, search_term, search_term] + part_params)
    
    if mastery_filter:
        # Handle multiple mastery filters (comma-separated or multiple values)
        mastery_values = [f.strip() for f in mastery_filter.split(',') if f.strip()]
        if mastery_values:
            if 'due' in mastery_values:
                # Handle 'due' separately
                mastery_values = [v for v in mastery_values if v != 'due']
                if mastery_values:
                    # Both 'due' and other values
                    where_clause += ' AND ((ws.next_review_date IS NOT NULL AND ws.next_review_date <= ?) OR COALESCE(ws.mastery_level, "new") IN (' + ','.join(['?' for _ in mastery_values]) + '))'
                    params.append(datetime.now().strftime('%Y-%m-%d'))
                    params.extend(mastery_values)
                else:
                    # Only 'due' - words that have been reviewed and are due today or earlier
                    where_clause += ' AND ws.next_review_date IS NOT NULL AND ws.next_review_date <= ?'
                    params.append(datetime.now().strftime('%Y-%m-%d'))
            else:
                # Only specific mastery levels
                where_clause += ' AND COALESCE(ws.mastery_level, "new") IN (' + ','.join(['?' for _ in mastery_values]) + ')'
                params.extend(mastery_values)
    
    if word_class_filter:
        # Handle multiple word class filters (comma-separated)
        word_class_values = [f.strip() for f in word_class_filter.split(',') if f.strip()]
        if word_class_values:
            where_clause += ' AND LOWER(v.word_class) IN (' + ','.join(['LOWER(?)' for _ in word_class_values]) + ')'
            params.extend(word_class_values)
    
    if level_filter:
        # Handle multiple level filters (comma-separated)
        level_values = [f.strip().lower() for f in level_filter.split(',') if f.strip()]
        if level_values:
            where_clause += ' AND v.level IN (' + ','.join(['?' for _ in level_values]) + ')'
            params.extend(level_values)
    
    # Count query
    count_query = f'''
        SELECT COUNT(*) as total
        FROM vocabulary v
        LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = 1
        {where_clause}
    '''
    try:
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()['total']
    except sqlite3.OperationalError as e:
        print(f"Error in count query: {e}")
        # Fallback: use simpler count without filters
        cursor.execute(f'SELECT COUNT(*) as total FROM vocabulary v WHERE v.language = ?', [language])
        total_count = cursor.fetchone()['total']
    
    # Data query - fetch more results if searching (we'll sort and paginate in Python)
    # For search queries, we need to fetch all candidates, sort by relevance, then paginate
    # For non-search queries, we can use SQL pagination
    if search:
        # Fetch more candidates for search (we'll filter and sort in Python)
        # No ORDER BY in SQL - we'll sort purely by similarity metrics in Python
        fetch_limit = min(limit * 10, 1000)  # Fetch up to 10x the limit or 1000, whichever is smaller
        data_query = f'''
            SELECT v.*, COALESCE(ws.mastery_level, 'new') as mastery_level,
                   COALESCE(ws.next_review_date, '') as next_review_date
            FROM vocabulary v
            LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = 1
            {where_clause}
            LIMIT ?
        '''
        params.append(fetch_limit)
    else:
        # Non-search: use SQL pagination
        data_query = f'''
            SELECT v.*, COALESCE(ws.mastery_level, 'new') as mastery_level,
                   COALESCE(ws.next_review_date, '') as next_review_date
            FROM vocabulary v
            LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = 1
            {where_clause}
            ORDER BY v.english_word
            LIMIT ? OFFSET ?
        '''
        params.extend([limit, offset])
    
    try:
        cursor.execute(data_query, params)
    except sqlite3.OperationalError as e:
        print(f"Error in data query: {e}")
        # Fallback: simpler query without complex filters
        where_clause_simple = f'WHERE v.language = ?'
        if search:
            where_clause_simple += ' AND (LOWER(v.english_word) LIKE LOWER(?) OR v.translation LIKE ? OR LOWER(v.transliteration) LIKE LOWER(?))'
            params_simple = [language, f'%{search}%', f'%{search}%', f'%{search}%', limit, offset]
        else:
            params_simple = [language, limit, offset]
        data_query_simple = f'''
            SELECT v.*, COALESCE(ws.mastery_level, 'new') as mastery_level,
                   COALESCE(ws.next_review_date, '') as next_review_date
            FROM vocabulary v
            LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = 1
            {where_clause_simple}
            ORDER BY v.english_word
            LIMIT ? OFFSET ?
        '''
        cursor.execute(data_query_simple, params_simple)
    
    words = [dict(row) for row in cursor.fetchall()]
    
    # If search was provided, filter by normalized transliteration for fuzzy matching
    # This ensures diacritic-agnostic search works correctly
    if search:
        normalized_search_lower = normalized_search.lower()
        filtered_words = []
        for word in words:
            word_translit = word.get('transliteration', '').lower()
            word_english = word.get('english_word', '').lower()
            word_kannada = word.get('translation', '')
            
            # Check English word
            english_match = search.lower() in word_english
            
            # Check Kannada - split by " /" and check each variant (same as transliterations)
            kannada_match = False
            if word_kannada:
                kannada_variants = word_kannada.split(' /')
                for variant in kannada_variants:
                    variant = variant.strip()
                    if search in variant:
                        kannada_match = True
                        break
            
            # Check transliteration - split by " /" and check each variant
            translit_match = False
            if word_translit:
                translit_variants = word_translit.split(' /')
                for variant in translit_variants:
                    variant = variant.strip().lower()
                    if search.lower() in variant:
                        translit_match = True
                        break
            
            # Check exact matches first
            if english_match or kannada_match or translit_match:
                filtered_words.append(word)
            else:
                # Check normalized transliteration for fuzzy matching
                # Split transliteration by " /" and check each variant
                if word_translit:
                    translit_variants = word_translit.split(' /')
                    for variant in translit_variants:
                        variant = variant.strip().lower()
                        normalized_translit = normalize_iast_diacritics(variant)
                        # Check if normalized search is in normalized transliteration OR vice versa
                        # This handles cases like "rasayana" matching "rāsāyana"
                        if (normalized_search_lower in normalized_translit or 
                            normalized_translit in normalized_search_lower or
                            normalized_translit.startswith(normalized_search_lower) or
                            normalized_search_lower.startswith(normalized_translit)):
                            filtered_words.append(word)
                            break
        
        words = filtered_words
        
        # Calculate similarity scores and sort by relevance
        search_lower = search.lower().strip()
        for word in words:
            scores = []
            
            # Score English word
            word_english = word.get('english_word', '').lower()
            if word_english:
                scores.append(calculate_similarity_score(search_lower, word_english, 'english'))
            
            # Score Kannada - pass full string with "/", function will handle splitting
            word_kannada = word.get('translation', '')
            if word_kannada:
                # Function handles "/" splitting and returns best match
                # Pass search_lower (function will lowercase Kannada too, which is fine)
                scores.append(calculate_similarity_score(search_lower, word_kannada, 'kannada'))
            
            # Score transliteration - pass full string with "/", function will handle splitting
            word_translit = word.get('transliteration', '')
            if word_translit:
                # Score normalized transliteration for fuzzy matching (function handles "/" splitting)
                normalized_variant = normalize_iast_diacritics(word_translit)
                normalized_search = normalize_iast_diacritics(search_lower)
                scores.append(calculate_similarity_score(normalized_search, normalized_variant, 'transliteration'))
                # Also score original (in case of exact match)
                scores.append(calculate_similarity_score(search_lower, word_translit, 'transliteration'))
            
            # Use the best (highest) score
            word['_similarity_score'] = max(scores) if scores else 0.0
        
        # Sort PURELY by similarity score (descending), then alphabetically by English word
        # No mastery level or word status influence - only similarity metrics matter
        words.sort(key=lambda w: (
            -w.get('_similarity_score', 0.0),  # Primary: similarity score (descending)
            w.get('english_word', '').lower()   # Secondary: alphabetical (ascending)
        ))
        
        # Apply pagination after sorting (for search queries)
        if search:
            total_filtered = len(words)
            # Update total_count to reflect filtered results before pagination
            total_count = total_filtered
            words = words[offset:offset + limit]
        
        # For search queries, total_count is already set above from filtered results
        # For non-search queries, total_count was set from SQL count query earlier
    
    conn.close()
    return words, total_count


# ============================================================================
# Lesson words generation (per lesson, filtered by allowed characters)
# ============================================================================
def _has_only_allowed_chars(text: str, allowed: set) -> bool:
    """Return True if every meaningful character is in the allowed set."""
    if not text:
        return False
    kept = 0
    for ch in text:
        # Ignore whitespace/punctuation/digits
        if ch.isspace() or ch.isdigit() or ch in ['.', ',', ';', ':', "'", '"', '!', '?', '-', '–', '—', '(', ')', '·', '•']:
            continue
        kept += 1
        if ch not in allowed:
            return False
    return kept > 0


def generate_lesson_words(language: str, lesson_id: str, allowed_chars: List[str], target_count: int = 50, max_count: int = 60) -> List[Dict]:
    """
    Build and cache words for a lesson using only characters learned so far.
    Strategy:
      - Fetch vocabulary for the language (large limit) and filter by allowed characters.
      - Deduplicate and cap to max_count (aiming for target_count).
      - If short, pad with curated fallbacks (also filtered by allowed set).
    """
    ensure_lesson_words_table()

    allowed_set = set(allowed_chars or [])
    merged: List[Dict] = []

    # Fetch vocabulary
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, translation, english_word
        FROM vocabulary
        WHERE language = ?
        LIMIT 3000
    ''', (language,))
    vocab_rows = cursor.fetchall()
    conn.close()

    for idx, row in enumerate(vocab_rows):
        candidate = row['translation'] or row['english_word'] or ''
        if candidate and _has_only_allowed_chars(candidate, allowed_set):
            merged.append({
                'id': row['id'] or f'v-{idx}',
                'text': candidate,
                'gloss': row['english_word'] or row['translation'] or ''
            })

    # Curated fallback list (short list, still filtered by allowed chars)
    fallback_curated = [
        ('ಅಮರ', 'immortal'), ('ಕಲಾ', 'art'), ('ಮನೆ', 'house'), ('ಭಾಷೆ', 'language'),
        ('ಪುಸ್ತಕ', 'book'), ('ಕಾಫಿ', 'coffee'), ('ಸ್ನೇಹ', 'friendship'), ('ಬೆಳೆ', 'crop'),
        ('ಹೊಸ', 'new'), ('ಮಾವು', 'mango tree'), ('ಪ್ರತಿ', 'every'), ('ಶಕ್ತಿ', 'strength'),
        ('ಮನೆಮಠ', 'home/ashram'), ('ನಗರ', 'city'), ('ಕವಿ', 'poet'), ('ವಿದ್ಯೆ', 'learning'),
        ('ನದಿ', 'river'), ('ಗುಡಿ', 'temple'), ('ಮಾತು', 'speech'), ('ಕಿರು', 'short'),
        ('ದಾರಿ', 'road'), ('ಬಾಯಿ', 'mouth'), ('ಕಾಲ', 'time'), ('ಬೆಳಕು', 'light'),
        ('ಹೃದಯ', 'heart'), ('ಗಾಳಿ', 'wind'), ('ನೋಟ', 'view'), ('ತಾಯಿ', 'mother'),
        ('ತಂದೆ', 'father'), ('ಹಣ್ಣು', 'fruit'), ('ಬಳಸುವ', 'used'), ('ನೀರು', 'water'),
        ('ಆಕಾಶ', 'sky'), ('ಶಬ್ದ', 'sound'), ('ಭಾಷಣ', 'speech'), ('ಪಾಠ', 'lesson'),
        ('ಸೂರ್ಯ', 'sun'), ('ಚಂದ್ರ', 'moon'), ('ಬೆಂಕಿ', 'fire'), ('ತೋಟ', 'garden'),
        ('ಮಾರ್ಗ', 'path'), ('ಸರಸ್ವತಿ', 'goddess of knowledge'), ('ಧೈರ್ಯ', 'courage'), ('ಮಣ್ಣ', 'soil'),
        ('ಪ್ರೀತಿ', 'love'), ('ಕರ್ಮ', 'action'), ('ಸಾಧನೆ', 'effort'), ('ನಿಷ್ಠೆ', 'loyalty'),
    ]

    for idx, (text, gloss) in enumerate(fallback_curated):
        if _has_only_allowed_chars(text, allowed_set):
            merged.append({
                'id': f'f-{idx}',
                'text': text,
                'gloss': gloss,
            })

    # Deduplicate and cap
    seen = set()
    capped = []
    for item in merged:
        if item['text'] and item['text'] not in seen:
            seen.add(item['text'])
            capped.append(item)
        if len(capped) >= max_count:
            break

    # Cache for this lesson_id
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM lesson_words WHERE language = ? AND lesson_id = ?', (language, lesson_id))
    conn.commit()
    cursor.executemany(
        'INSERT INTO lesson_words(language, lesson_id, text, gloss) VALUES (?, ?, ?, ?)',
        [(language, lesson_id, item['text'], item.get('gloss')) for item in capped]
    )
    conn.commit()
    conn.close()

    return capped


def get_lesson_words(language: str, lesson_id: str, allowed_chars: List[str], target_count: int = 50, max_count: int = 60) -> List[Dict]:
    """Retrieve lesson words from cache; if missing or insufficient, regenerate."""
    ensure_lesson_words_table()
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT text, gloss FROM lesson_words WHERE language = ? AND lesson_id = ? LIMIT ?', (language, lesson_id, max_count))
    rows = cursor.fetchall()
    conn.close()

    if len(rows) >= target_count:
        return [{'id': f'c-{idx}', 'text': row['text'], 'gloss': row['gloss'] or ''} for idx, row in enumerate(rows)]

    # Regenerate
    return generate_lesson_words(language, lesson_id, allowed_chars, target_count, max_count)


def _cefr_to_numeric(cefr_level: str) -> int:
    """Convert CEFR level to numeric value for comparison"""
    levels = {'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6}
    return levels.get(cefr_level.upper(), 1)


def calculate_user_level(language: str) -> Dict:
    """Calculate user's level based on the primary level of words in the vocabulary
    
    For languages where all words are at a single level (e.g., all Tamil at A1),
    the user's level is set to that level directly, with progress based on mastered words.
    
    Level progression:
    - A0: Starting level (less than all A1 words mastered)
    - A1: All A1 words mastered (or current level if all words are A1)
    - A2: All A1 + A2 words mastered (or current level if all words are A2)
    - B1: All A1 + A2 + B1 words mastered
    - B2: All A1 + A2 + B1 + B2 words mastered
    - C1: All A1 + A2 + B1 + B2 + C1 words mastered
    - C2: All A1 + A2 + B1 + B2 + C1 + C2 words mastered
    """
    try:
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        cursor = conn.cursor()
        
        # Get total words available at each level for this language
        cursor.execute('''
            SELECT level, COUNT(*) as total
            FROM vocabulary
            WHERE language = ? AND level IS NOT NULL AND level != ''
            GROUP BY level
        ''', (language,))
        
        total_by_level = {row[0].lower(): row[1] for row in cursor.fetchall()}
        
        # Get mastered words count by level
        cursor.execute('''
            SELECT v.level, COUNT(*) as count
            FROM word_states ws
            JOIN vocabulary v ON ws.word_id = v.id
            WHERE ws.user_id = 1 
            AND ws.mastery_level = 'mastered'
            AND v.language = ?
            AND v.level IS NOT NULL AND v.level != ''
            GROUP BY v.level
        ''', (language,))
        
        mastered_by_level = {row[0].lower(): row[1] for row in cursor.fetchall()}
        
        # Get total mastered words (any level)
        cursor.execute('''
            SELECT COUNT(*) as count
            FROM word_states ws
            JOIN vocabulary v ON ws.word_id = v.id
            WHERE ws.user_id = 1 
            AND ws.mastery_level = 'mastered'
            AND v.language = ?
        ''', (language,))
        
        total_mastered = cursor.fetchone()[0] or 0
        
        # Check if this language has all words at a single level (simplified level system)
        if len(total_by_level) == 1:
            # Single-level system: user is currently at that level
            single_level = list(total_by_level.keys())[0]
            total_words = total_by_level[single_level]
            mastered_words = mastered_by_level.get(single_level, 0)
            progress = (mastered_words / total_words * 100) if total_words > 0 else 0
            
            conn.close()
            return {
                'level': single_level.upper(),
                'progress': round(progress, 1),
                'total_mastered': total_mastered,
                'next_level': single_level.upper(),
                'total_words': total_words
            }
        
        # Multi-level system: traditional progression through levels
        levels_order = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']
        current_level = 'A0'  # Starting level
        progress = 0
        next_level = 'A1'
        
        for i, level in enumerate(levels_order):
            total_words = total_by_level.get(level, 0)
            mastered_words = mastered_by_level.get(level, 0)
            
            if total_words == 0:
                # Skip levels with no words
                continue
            
            if mastered_words >= total_words:
                # User has completed this level
                current_level = level.upper()
                # Calculate progress towards next level
                if i + 1 < len(levels_order):
                    next_level_key = levels_order[i + 1]
                    next_total = total_by_level.get(next_level_key, 0)
                    next_mastered = mastered_by_level.get(next_level_key, 0)
                    if next_total > 0:
                        progress = (next_mastered / next_total) * 100
                        next_level = next_level_key.upper()
                    else:
                        progress = 100
                        next_level = current_level
                else:
                    # C2 completed
                    progress = 100
                    next_level = 'C2'
            else:
                # User is still working on this level
                if current_level == 'A0':
                    current_level = 'A0'  # Before completing A1
                progress = (mastered_words / total_words) * 100
                next_level = level.upper()
                break
        
        conn.close()
        
        return {
            'level': current_level,
            'progress': round(progress, 1),
            'total_mastered': total_mastered,
            'next_level': next_level,
            'total_words': sum(total_by_level.values())
        }
    except Exception as e:
        print(f"Error in calculate_user_level: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return default level on error
        return {
            'level': 'A1',
            'progress': 0,
            'total_mastered': 0,
            'next_level': 'A2',
            'total_words': 0
        }


# ============================================================================
# SRS (Spaced Repetition System) Operations
# ============================================================================

def bulk_update_word_states_by_level(language: str, level: str, mastery_level: str, user_id: int = 1):
    """Bulk update word states for all words of a specific level"""
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    # Get all word IDs for the specified level
    cursor.execute('''
        SELECT id FROM vocabulary
        WHERE language = ? AND LOWER(level) = LOWER(?)
    ''', (language, level))
    
    word_ids = [row[0] for row in cursor.fetchall()]
    
    if not word_ids:
        conn.close()
        return {"updated": 0}
    
    # Bulk update/insert word states
    updated_count = 0
    for word_id in word_ids:
        # Check if word state exists
        cursor.execute('''
            SELECT id FROM word_states WHERE word_id = ? AND user_id = ?
        ''', (word_id, user_id))
        
        exists = cursor.fetchone()
        
        if exists:
            # Update existing
            cursor.execute('''
                UPDATE word_states SET
                    mastery_level = ?,
                    next_review_date = ?,
                    review_count = ?,
                    ease_factor = ?,
                    last_reviewed = ?
                WHERE word_id = ? AND user_id = ?
            ''', (
                mastery_level,
                datetime.now().strftime('%Y-%m-%d') if mastery_level in ['learning', 'review'] else None,
                0 if mastery_level == 'new' else (3 if mastery_level == 'mastered' else 1),
                config.DEFAULT_EASE_FACTOR,
                datetime.now().strftime('%Y-%m-%d'),
                word_id, user_id
            ))
        else:
            # Insert new
            cursor.execute('''
                INSERT INTO word_states (word_id, user_id, mastery_level, next_review_date, 
                                        review_count, ease_factor, last_reviewed)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                word_id, user_id, mastery_level,
                datetime.now().strftime('%Y-%m-%d') if mastery_level in ['learning', 'review'] else None,
                0 if mastery_level == 'new' else (3 if mastery_level == 'mastered' else 1),
                config.DEFAULT_EASE_FACTOR,
                datetime.now().strftime('%Y-%m-%d')
            ))
        updated_count += 1
    
    conn.commit()
    conn.close()
    return {"updated": updated_count}


def update_word_state(word_id: int, user_id: int, correct: bool, activity_type: str = 'activity'):
    """Update word state based on SRS algorithm (simplified SM-2)"""
    # Get language for this word to use per-language SRS settings
    language = get_language_for_word(word_id)
    srs_settings = get_srs_settings_for_language(language)
    
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    # Get current state
    cursor.execute('''
        SELECT mastery_level, review_count, ease_factor, next_review_date
        FROM word_states
        WHERE word_id = ? AND user_id = ?
    ''', (word_id, user_id))
    
    result = cursor.fetchone()
    
    if result:
        mastery_level, review_count, ease_factor, next_review_date = result
        mastery_level_before = mastery_level
    else:
        # Create new state
        mastery_level = 'new'
        mastery_level_before = 'new'
        review_count = 0
        ease_factor = srs_settings['default_ease_factor']
        next_review_date = None
    
    today = datetime.now().date()
    
    # Update based on performance
    if correct:
        if mastery_level == 'new':
            mastery_level = 'learning'
            next_review = datetime.now() + timedelta(days=1)
        elif mastery_level == 'learning':
            mastery_level = 'review'
            next_review = datetime.now() + timedelta(days=3)
        elif mastery_level == 'review':
            if review_count >= 3:
                mastery_level = 'mastered'
            next_review = datetime.now() + timedelta(days=int(ease_factor * 2))
        else:
            next_review = datetime.now() + timedelta(days=int(ease_factor * 2))
        
        ease_factor = min(srs_settings['max_ease_factor'], ease_factor + srs_settings['ease_factor_increment'])
        review_count += 1
        rating = 'good'  # For review history
    else:
        mastery_level = 'learning'
        ease_factor = max(srs_settings['min_ease_factor'], ease_factor - srs_settings['ease_factor_decrement'])
        next_review = datetime.now() + timedelta(days=1)
        rating = 'again'  # For review history
    
    interval_days = (next_review.date() - today).days if next_review else 0
    
    # Upsert word state
    cursor.execute('''
        INSERT INTO word_states (word_id, user_id, mastery_level, next_review_date, 
                                review_count, ease_factor, last_reviewed, interval_days)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(word_id, user_id) DO UPDATE SET
            mastery_level = excluded.mastery_level,
            next_review_date = excluded.next_review_date,
            review_count = excluded.review_count,
            ease_factor = excluded.ease_factor,
            last_reviewed = excluded.last_reviewed,
            interval_days = excluded.interval_days
    ''', (
        word_id, user_id, mastery_level,
        next_review.strftime('%Y-%m-%d') if next_review else None,
        review_count, ease_factor, datetime.now().strftime('%Y-%m-%d'),
        interval_days
    ))
    
    # Log this review to review_history table
    cursor.execute('''
        INSERT INTO review_history (
            word_id, user_id, reviewed_at, rating, activity_type,
            interval_days, ease_factor, mastery_level_before, mastery_level_after
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        word_id, user_id,
        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        rating,
        activity_type,
        interval_days,
        ease_factor,
        mastery_level_before,
        mastery_level
    ))
    
    conn.commit()
    conn.close()
    
    # Check if daily flashcard goal is met and log if complete
    check_and_log_flashcard_completion(language, user_id)


def preview_word_intervals(word_id: int, user_id: int = 1) -> Dict:
    """Preview what the next review intervals would be for each possible response
    
    Returns a dictionary with keys 'again', 'hard', 'good', 'easy' containing
    interval_days and next_review date for each response option.
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get language for this word
        cursor.execute('SELECT language FROM vocabulary WHERE id = ?', (word_id,))
        lang_result = cursor.fetchone()
        if not lang_result:
            conn.close()
            return {}
        language = lang_result['language']
        
        # Get SRS settings
        srs_settings = get_srs_settings_for_language(language)
        
        # Get current word state
        cursor.execute('''
            SELECT * FROM word_states
            WHERE word_id = ? AND user_id = ?
        ''', (word_id, user_id))
        
        row = cursor.fetchone()
        today = config.get_current_time().date()
        
        if row:
            mastery_level = row['mastery_level']
            review_count = row['review_count']
            ease_factor = row['ease_factor']
            is_new = not row['introduced_date'] or row['introduced_date'] == '' or mastery_level == 'new'
        else:
            # New card
            mastery_level = 'new'
            review_count = 0
            ease_factor = srs_settings['default_ease_factor']
            is_new = True
        
        conn.close()
        
        from datetime import timedelta
        
        def calculate_interval(response_type: str) -> tuple:
            """Calculate interval for a given response type"""
            nonlocal ease_factor, review_count, mastery_level
            
            temp_ease = ease_factor
            temp_review_count = review_count + 1
            
            if response_type == 'again':
                # Failed: reset to 1 day
                temp_ease = max(srs_settings['min_ease_factor'], ease_factor - (srs_settings['ease_factor_decrement'] * 2))
                interval_days = 1
            elif response_type == 'hard':
                # Hard: 1 day, moderate ease decrease
                temp_ease = max(srs_settings['min_ease_factor'], ease_factor - srs_settings['ease_factor_decrement'])
                interval_days = 1
            elif response_type == 'good':
                # Good: standard SRS progression
                if is_new or mastery_level == 'learning':
                    interval_days = max(1, int(temp_review_count * temp_ease * 0.5))
                else:
                    interval_days = max(1, int(temp_review_count * temp_ease))
                temp_ease = min(srs_settings['max_ease_factor'], ease_factor + srs_settings['ease_factor_increment'] * 0.5)
            else:  # easy
                # Easy: longer interval, bigger ease increase
                if is_new or mastery_level == 'learning':
                    interval_days = max(1, int(temp_review_count * temp_ease * 1.2))
                else:
                    interval_days = max(1, int(temp_review_count * temp_ease * 1.3))
                temp_ease = min(srs_settings['max_ease_factor'], ease_factor + srs_settings['ease_factor_increment'])
            
            next_review = today + timedelta(days=interval_days)
            return interval_days, next_review.strftime('%Y-%m-%d')
        
        # Calculate for all response types
        results = {}
        for response in ['again', 'hard', 'good', 'easy']:
            interval_days, next_review_date = calculate_interval(response)
            results[response] = {
                'interval_days': interval_days,
                'next_review': next_review_date
            }
        
        return results
        
    except Exception as e:
        print(f"Error previewing word intervals: {str(e)}")
        import traceback
        traceback.print_exc()
        return {}


def update_word_state_from_flashcard(word_id: int, user_id: int, comfort_level: str):
    """Update word state based on flashcard performance (corner-based feedback)
    
    Args:
        word_id: The word's ID
        user_id: The user's ID
        comfort_level: One of 'easy', 'good', 'hard', 'again'
    
    SRS Algorithm:
    - Easy: Largest increase in ease factor, longest interval
    - Good: Standard SRS progression, moderate ease increase
    - Hard: Shorter interval, moderate ease decrease
    - Again: Reset to beginning, significant ease decrease
    """
    try:
        # Get current word state (or initialize new one)
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get language for this word (needed for quota tracking)
        cursor.execute('SELECT language FROM vocabulary WHERE id = ?', (word_id,))
        lang_result = cursor.fetchone()
        if not lang_result:
            conn.close()
            return
        language = lang_result['language']
        
        # Get SRS settings for this language
        srs_settings = get_srs_settings_for_language(language)
        
        # Get current state
        cursor.execute('''
            SELECT * FROM word_states
            WHERE word_id = ? AND user_id = ?
        ''', (word_id, user_id))
        
        row = cursor.fetchone()
        today = config.get_current_time().date()
        today_str = today.strftime('%Y-%m-%d')
        
        # Track if this is a new card
        is_new_card = False
        mastery_level_before = None
        
        if row:
            mastery_level = row['mastery_level']
            mastery_level_before = mastery_level  # Store for review history
            review_count = row['review_count'] + 1
            ease_factor = row['ease_factor']
            introduced_date = row['introduced_date'] or today_str
            
            # Check if this was a new card
            if not row['introduced_date'] or row['introduced_date'] == '' or mastery_level == 'new':
                is_new_card = True
                introduced_date = today_str
        else:
            # Create new state
            mastery_level = 'new'
            mastery_level_before = 'new'  # Store for review history
            review_count = 1
            ease_factor = srs_settings['default_ease_factor']
            is_new_card = True
            introduced_date = today_str
        
        # Update based on comfort level
        if comfort_level == 'again':
            # Failed: schedule for immediate review (same day), decrease ease_factor significantly
            mastery_level = 'learning'
            ease_factor = max(srs_settings['min_ease_factor'], ease_factor - (srs_settings['ease_factor_decrement'] * 2))
            next_review = today  # Same day = immediate review in same session
        elif comfort_level == 'hard':
            # Hard: shorter interval (1 day), moderate ease decrease
            mastery_level = 'learning'
            ease_factor = max(srs_settings['min_ease_factor'], ease_factor - srs_settings['ease_factor_decrement'])
            next_review = today + timedelta(days=1)
        elif comfort_level == 'good':
            # Good: standard SRS progression, moderate ease increase
            if mastery_level == 'new' or mastery_level == 'learning':
                mastery_level = 'learning'
                next_review = today + timedelta(days=max(1, int(review_count * ease_factor * 0.5)))
            elif mastery_level == 'review':
                if review_count >= 3:
                    mastery_level = 'mastered'
                next_review = today + timedelta(days=int(review_count * ease_factor))
            else:
                next_review = today + timedelta(days=int(review_count * ease_factor))
            
            ease_factor = min(srs_settings['max_ease_factor'], ease_factor + srs_settings['ease_factor_increment'] * 0.5)
        elif comfort_level == 'easy':
            # Easy: longer interval, larger ease increase
            if mastery_level == 'new' or mastery_level == 'learning':
                mastery_level = 'learning'
                next_review = today + timedelta(days=max(1, int(review_count * ease_factor * 1.2)))
            elif mastery_level == 'review':
                if review_count >= 3:
                    mastery_level = 'mastered'
                next_review = today + timedelta(days=int(review_count * ease_factor * 1.3))
            else:
                next_review = today + timedelta(days=int(review_count * ease_factor * 1.3))
            
            ease_factor = min(srs_settings['max_ease_factor'], ease_factor + srs_settings['ease_factor_increment'])
        else:
            # Default to good if unknown comfort level
            mastery_level = 'learning'
            next_review = today + timedelta(days=1)
        
        # Upsert word state
        cursor.execute('''
            INSERT INTO word_states (word_id, user_id, mastery_level, next_review_date, 
                                    review_count, ease_factor, last_reviewed, introduced_date, interval_days)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(word_id, user_id) DO UPDATE SET
                mastery_level = excluded.mastery_level,
                next_review_date = excluded.next_review_date,
                review_count = excluded.review_count,
                ease_factor = excluded.ease_factor,
                last_reviewed = excluded.last_reviewed,
                introduced_date = COALESCE(word_states.introduced_date, excluded.introduced_date),
                interval_days = excluded.interval_days
        ''', (
            word_id, user_id, mastery_level,
            next_review.strftime('%Y-%m-%d'),
            review_count, ease_factor, today_str, introduced_date,
            (next_review - today).days
        ))
        
        # Log this review to review_history table
        cursor.execute('''
            INSERT INTO review_history (
                word_id, user_id, reviewed_at, rating, activity_type,
                interval_days, ease_factor, mastery_level_before, mastery_level_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            word_id, user_id, 
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            comfort_level,  # 'easy', 'good', 'hard', 'again'
            'flashcard',
            (next_review - today).days,
            ease_factor,
            mastery_level_before,
            mastery_level
        ))
        
        conn.commit()
        conn.close()
        
        # Update daily quota
        increment_daily_quota(language, is_new_card, user_id)
        
        # Check if daily flashcard goal is met and log if complete
        check_and_log_flashcard_completion(language, user_id)
        
        print(f"[SRS] Updated word {word_id}: {mastery_level}, ease={ease_factor:.2f}, next={next_review}, new={is_new_card}")
        print(f"[SRS] Logged review: {mastery_level_before} -> {mastery_level}, rating={comfort_level}")
    except Exception as e:
        print(f"Error updating word state from flashcard: {str(e)}")
        import traceback
        traceback.print_exc()


# ============================================================================
# Daily Progress & Stats Operations
# ============================================================================

def get_daily_stats(language: str = None, days: int = 365) -> Dict:
    """Get daily activity and word learning stats for contribution graph
    
    Args:
        language: Language code (None for all languages)
        days: Number of days to look back (default 365)
    
    Returns:
        Dict with 'activities' and 'words' keys, each containing date -> count mappings
    """
    from datetime import datetime, timedelta
    
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Calculate start date
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    # Get daily activity counts
    activity_query = '''
        SELECT DATE(completed_at) as date, COUNT(*) as count
        FROM activity_history
        WHERE user_id = 1 AND completed_at IS NOT NULL
    '''
    activity_params = []
    
    if language:
        activity_query += ' AND language = ?'
        activity_params.append(language)
    
    activity_query += ' AND DATE(completed_at) >= ? GROUP BY DATE(completed_at)'
    activity_params.append(start_date)
    
    cursor.execute(activity_query, activity_params)
    activity_results = cursor.fetchall()
    
    # Get daily word learning counts (words that were mastered on that day)
    # Count words that transitioned to 'mastered' on each day
    if language:
        words_query = '''
            SELECT DATE(ws.last_reviewed) as date, COUNT(*) as count
            FROM word_states ws
            JOIN vocabulary v ON ws.word_id = v.id
            WHERE ws.user_id = 1 AND ws.mastery_level = 'mastered' 
            AND v.language = ? AND DATE(ws.last_reviewed) >= ?
            GROUP BY DATE(ws.last_reviewed)
        '''
        words_params = [language, start_date]
    else:
        words_query = '''
            SELECT DATE(ws.last_reviewed) as date, COUNT(*) as count
            FROM word_states ws
            JOIN vocabulary v ON ws.word_id = v.id
            WHERE ws.user_id = 1 AND ws.mastery_level = 'mastered' 
            AND DATE(ws.last_reviewed) >= ?
            GROUP BY DATE(ws.last_reviewed)
        '''
        words_params = [start_date]
    
    cursor.execute(words_query, words_params)
    words_results = cursor.fetchall()
    
    # Convert to dictionaries
    activities_by_date = {row['date']: row['count'] for row in activity_results}
    words_by_date = {row['date']: row['count'] for row in words_results}
    
    # Generate all dates in range with zero counts
    all_dates = {}
    for i in range(days):
        date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        all_dates[date] = {
            'activities': activities_by_date.get(date, 0),
            'words': words_by_date.get(date, 0),
        }
    
    conn.close()
    return all_dates


def get_user_learning_languages() -> List[str]:
    """Get all languages the user is learning (has activity history or word states)"""
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        # First, check if user has selected languages in preferences
        cursor.execute('''
            SELECT value FROM user_preferences
            WHERE user_id = 1 AND key = 'selected_languages'
        ''')
        pref_row = cursor.fetchone()
        
        selected_languages = None
        if pref_row and pref_row[0]:
            try:
                selected_languages = json.loads(pref_row[0])
            except:
                pass
        
        # Get languages from activity history
        cursor.execute('''
            SELECT DISTINCT language
            FROM activity_history
            WHERE user_id = 1
        ''')
        activity_languages = {row[0] for row in cursor.fetchall()}
        
        # Get languages from word states
        cursor.execute('''
            SELECT DISTINCT v.language
            FROM word_states ws
            JOIN vocabulary v ON ws.word_id = v.id
            WHERE ws.user_id = 1
        ''')
        word_languages = {row[0] for row in cursor.fetchall()}
        
        # Combine activity and word languages
        all_languages = activity_languages.union(word_languages)
        
        # If user has selected languages, filter to only show those with activity
        if selected_languages:
            # Return languages that are both selected AND have activity
            result = sorted([lang for lang in selected_languages if lang in all_languages])
            conn.close()
            return result if result else ['kannada']  # Default to kannada if none
        
        # Otherwise, return all languages with activity
        result = sorted(all_languages)
        conn.close()
        
        return result if result else ['kannada']  # Default to kannada if none
    except Exception as e:
        print(f"Error getting learning languages: {str(e)}")
        import traceback
        traceback.print_exc()
        return ['kannada']


def get_language_stats(language: str) -> Dict:
    """Get comprehensive stats for a specific language"""
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    stats = {}
    
    # Total activities by type
    cursor.execute('''
        SELECT activity_type, COUNT(*) as count
        FROM activity_history
        WHERE user_id = 1 AND language = ?
        GROUP BY activity_type
    ''', (language,))
    activity_counts = cursor.fetchall()
    stats['activities'] = {row['activity_type']: row['count'] for row in activity_counts}
    stats['total_activities'] = sum(row['count'] for row in activity_counts)
    
    # Words mastered
    cursor.execute('''
        SELECT COUNT(*) as count
        FROM word_states ws
        JOIN vocabulary v ON ws.word_id = v.id
        WHERE ws.user_id = 1 AND ws.mastery_level = 'mastered' AND v.language = ?
    ''', (language,))
    result = cursor.fetchone()
    stats['words_mastered'] = result['count'] if result else 0
    
    # Words learning
    cursor.execute('''
        SELECT COUNT(*) as count
        FROM word_states ws
        JOIN vocabulary v ON ws.word_id = v.id
        WHERE ws.user_id = 1 AND ws.mastery_level IN ('learning', 'review') AND v.language = ?
    ''', (language,))
    result = cursor.fetchone()
    stats['words_learning'] = result['count'] if result else 0
    
    # Average score
    cursor.execute('''
        SELECT AVG(score) as avg_score
        FROM activity_history
        WHERE user_id = 1 AND language = ? AND score IS NOT NULL
    ''', (language,))
    result = cursor.fetchone()
    stats['average_score'] = round(result['avg_score'], 2) if result and result['avg_score'] else 0
    
    conn.close()
    return stats


# ============================================================================
# Activity & Progress Operations
# ============================================================================

def log_activity(language: str, activity_type: str, score: float = 0.0, activity_data: str = ''):
    """Log an activity completion"""
    try:
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        cursor = conn.cursor()
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Verify activity_data is not empty and is valid JSON
        if activity_data:
            try:
                import json
                # Verify it's valid JSON
                parsed = json.loads(activity_data)
                data_length = len(activity_data)
                print(f"  Saving activity data: {data_length} chars, has story: {bool(parsed.get('story'))}, has questions: {bool(parsed.get('questions'))}")
            except json.JSONDecodeError as e:
                print(f"  WARNING: activity_data is not valid JSON: {e}")
                print(f"  Data preview: {activity_data[:200]}")
        
        # Log to activity history
        cursor.execute('''
            INSERT INTO activity_history (user_id, language, activity_type, activity_data, score, completed_at)
            VALUES (1, ?, ?, ?, ?, datetime('now'))
        ''', (language, activity_type, activity_data, score))
        
        # Get the inserted ID to verify
        activity_id = cursor.lastrowid
        
        # Update daily progress
        cursor.execute('''
            INSERT INTO daily_progress (user_id, language, activity_type, date, count)
            VALUES (1, ?, ?, ?, 1)
            ON CONFLICT(user_id, language, activity_type, date) DO UPDATE SET
                count = count + 1
        ''', (language, activity_type, today))
        
        conn.commit()
        conn.close()
        
        # Don't update streak here - only update when activity is actually completed
        # update_streak() will be called from update_activity_score() instead
        
        print(f"✓ Activity logged: {activity_type} for {language}, score: {score}, id: {activity_id}, data length: {len(activity_data) if activity_data else 0}")
    except Exception as e:
        print(f"✗ Error logging activity: {e}")
        import traceback
        traceback.print_exc()


def update_activity_score(language: str, activity_type: str, score: float, activity_data: str = '', activity_id: Optional[int] = None):
    """Update the score of the most recent activity for this language and type, or a specific activity by ID"""
    try:
        import json
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        cursor = conn.cursor()
        
        # If activity_id is provided, use that specific activity
        if activity_id:
            cursor.execute('''
                SELECT id, activity_data, score FROM activity_history
                WHERE user_id = 1 AND id = ? AND language = ? AND activity_type = ?
            ''', (activity_id, language, activity_type))
        # For writing and speaking, always use the most recent activity entry (we may add new submissions later)
        # For other activities, find the one with score 0.0 (the one saved on generation)
        elif activity_type in ['writing', 'speaking']:
            cursor.execute('''
                SELECT id, activity_data, score FROM activity_history
                WHERE user_id = 1 AND language = ? AND activity_type = ?
                ORDER BY completed_at DESC
                LIMIT 1
            ''', (language, activity_type))
        else:
            cursor.execute('''
                SELECT id, activity_data, score FROM activity_history
                WHERE user_id = 1 AND language = ? AND activity_type = ? AND score = 0.0
                ORDER BY completed_at DESC
                LIMIT 1
            ''', (language, activity_type))
        
        result = cursor.fetchone()
        
        if result:
            activity_id = result[0]
            existing_data_str = result[1] if result[1] else '{}'
            existing_score = result[2] if result[2] else 0.0
            
            # For writing activities, merge submissions if they exist
            if activity_type == 'writing' and activity_data:
                try:
                    existing_data = json.loads(existing_data_str) if existing_data_str else {}
                    new_data = json.loads(activity_data) if activity_data else {}
                    
                    # If new data has submissions array, merge it with existing data
                    # Frontend sends complete submissions array, but we should preserve other existing fields
                    if 'submissions' in new_data:
                        # Frontend sent complete submissions array - merge with existing data to preserve all fields
                        merged_data = existing_data.copy()
                        merged_data.update(new_data)  # This will update submissions and any other fields
                    elif 'submissions' in existing_data:
                        # Merge new submission into existing
                        merged_data = existing_data.copy()
                        if 'user_writing' in new_data and 'grading_result' in new_data:
                            new_submission = {
                                'user_writing': new_data.get('user_writing', ''),
                                'grading_result': new_data.get('grading_result', {}),
                                'submitted_at': new_data.get('submitted_at', new_data.get('submitted_at', '')),
                            }
                            merged_data['submissions'] = existing_data.get('submissions', []) + [new_submission]
                        merged_data.update({k: v for k, v in new_data.items() if k != 'user_writing' and k != 'grading_result'})
                    else:
                        # No existing submissions, create new array
                        merged_data = new_data.copy()
                        if 'user_writing' in new_data and 'grading_result' in new_data:
                            merged_data['submissions'] = [{
                                'user_writing': new_data.get('user_writing', ''),
                                'grading_result': new_data.get('grading_result', {}),
                                'submitted_at': new_data.get('submitted_at', ''),
                            }]
                    
                    activity_data = json.dumps(merged_data)
                    # Use the highest score (in case of multiple submissions)
                    score = max(score, existing_score) if existing_score else score
                except json.JSONDecodeError as e:
                    print(f"  Warning: Failed to merge activity data: {e}, using new data")
                    # Use new data if merge fails
            
            # For speaking activities, merge submissions similar to writing activities
            if activity_type == 'speaking' and activity_data:
                try:
                    existing_data = json.loads(existing_data_str) if existing_data_str else {}
                    new_data = json.loads(activity_data) if activity_data else {}
                    
                    # If new data has submissions array, use it (frontend sends complete submissions array)
                    if 'submissions' in new_data:
                        # Frontend sent complete submissions array - merge with existing data to preserve all fields
                        merged_data = existing_data.copy()
                        merged_data.update(new_data)  # This will update submissions and any other fields
                    elif 'submissions' in existing_data:
                        # Merge new submission into existing
                        merged_data = existing_data.copy()
                        if 'transcript' in new_data and 'grading_result' in new_data:
                            new_submission = {
                                'transcript': new_data.get('transcript', ''),
                                'audio_base64': new_data.get('audio_base64'),
                                'audio_uri': new_data.get('audio_uri'),
                                'grading_result': new_data.get('grading_result', {}),
                                'submitted_at': new_data.get('submitted_at', ''),
                            }
                            merged_data['submissions'] = existing_data.get('submissions', []) + [new_submission]
                        merged_data.update({k: v for k, v in new_data.items() if k not in ['transcript', 'grading_result', 'audio_base64', 'audio_uri']})
                    else:
                        # No existing submissions, create new array
                        merged_data = new_data.copy()
                        if 'transcript' in new_data and 'grading_result' in new_data:
                            merged_data['submissions'] = [{
                                'transcript': new_data.get('transcript', ''),
                                'audio_base64': new_data.get('audio_base64'),
                                'audio_uri': new_data.get('audio_uri'),
                                'grading_result': new_data.get('grading_result', {}),
                                'submitted_at': new_data.get('submitted_at', ''),
                            }]
                    
                    activity_data = json.dumps(merged_data)
                    # Use the highest score (in case of multiple submissions)
                    score = max(score, existing_score) if existing_score else score
                except json.JSONDecodeError as e:
                    print(f"  Warning: Failed to merge speaking activity data: {e}, using new data")
                    # Use new data if merge fails

            # Update the existing activity with the new score, data, and completed_at timestamp
            # This ensures activities only count toward streak when actually completed
            cursor.execute('''
                UPDATE activity_history
                SET score = ?, activity_data = ?, completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (score, activity_data, activity_id))
            print(f"✓ Updated activity {activity_id} with score {score} and new completion timestamp")
            
            # Update daily progress (only increment if this is a new completion, not just updating data)
            # For writing activities with multiple submissions, we only want to count once per day
            # So we check if we already updated progress today
            today = datetime.now().strftime('%Y-%m-%d')
            cursor.execute('''
                SELECT count FROM daily_progress
                WHERE user_id = 1 AND language = ? AND activity_type = ? AND date = ?
            ''', (language, activity_type, today))
            progress_result = cursor.fetchone()
            
            if not progress_result:
                # No progress entry for today, create one
                # Use INSERT OR IGNORE to handle race conditions gracefully
                cursor.execute('''
                    INSERT OR IGNORE INTO daily_progress (user_id, language, activity_type, date, count)
                    VALUES (1, ?, ?, ?, 1)
                ''', (language, activity_type, today))
                # If INSERT was ignored (already exists), update instead
                if cursor.rowcount == 0:
                    cursor.execute('''
                        UPDATE daily_progress
                        SET count = count + 1
                        WHERE user_id = 1 AND language = ? AND activity_type = ? AND date = ?
                    ''', (language, activity_type, today))
        else:
            # If no activity found, just log a new one
            print(f"  No existing activity found, logging new one...")
            log_activity(language, activity_type, score, activity_data)
            conn.close()
            return
        
        conn.commit()
        conn.close()
        
        # Update streak after completing activity (not when creating it)
        update_streak()
    except Exception as e:
        print(f"✗ Error updating activity score: {e}")
        import traceback
        traceback.print_exc()


def update_conversation_messages(conversation_id: int, messages: list):
    """
    Update conversation activity_data with new messages from WebSocket session
    
    Args:
        conversation_id: Activity history ID for the conversation
        messages: List of message dicts with user_message, ai_response, timestamp
    """
    try:
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        cursor = conn.cursor()
        
        # Get existing activity_data
        cursor.execute('SELECT activity_data FROM activity_history WHERE id = ?', (conversation_id,))
        row = cursor.fetchone()
        
        if row:
            # Parse existing activity_data
            activity_data = json.loads(row[0]) if row[0] else {}
            
            # Update messages array
            activity_data['messages'] = messages
            
            # Update the activity record
            cursor.execute('''
                UPDATE activity_history 
                SET activity_data = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (json.dumps(activity_data), conversation_id))
            
            conn.commit()
            print(f"✓ Updated conversation {conversation_id} with {len(messages)} messages")
        else:
            print(f"✗ Conversation {conversation_id} not found")
        
        conn.close()
    except Exception as e:
        print(f"✗ Error updating conversation messages: {e}")
        import traceback
        traceback.print_exc()


def get_daily_progress(language: str, date: Optional[str] = None) -> Dict:
    """Get daily progress for a language"""
    try:
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT activity_type, COALESCE(SUM(count), 0) as count
            FROM daily_progress
            WHERE user_id = 1 AND language = ? AND date = ?
            GROUP BY activity_type
        ''', (language, date))
        
        progress = {row['activity_type']: row['count'] for row in cursor.fetchall()}
        
        # Get goals
        cursor.execute('''
            SELECT activity_type, daily_target
            FROM language_goals
            WHERE language = ?
        ''', (language,))
        
        goals = {row['activity_type']: row['daily_target'] for row in cursor.fetchall()}
        
        conn.close()
        
        # Combine progress and goals
        result = {}
        for activity in ['reading', 'listening', 'writing', 'speaking', 'conversation']:
            result[activity] = {
                'completed': progress.get(activity, 0),
                'target': goals.get(activity, 0)
            }
        
        return result
    except Exception as e:
        print(f"Error in get_daily_progress: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return default progress on error
        return {
            'reading': {'completed': 0, 'target': 0},
            'listening': {'completed': 0, 'target': 0},
            'writing': {'completed': 0, 'target': 0},
            'speaking': {'completed': 0, 'target': 0},
            'conversation': {'completed': 0, 'target': 0},
        }


# ============================================================================
# Goals Operations
# ============================================================================

def get_language_goals(language: str) -> Dict:
    """Get goals for a language"""
    try:
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT activity_type, daily_target
            FROM language_goals
            WHERE language = ?
        ''', (language,))
        
        goals = {row['activity_type']: row['daily_target'] for row in cursor.fetchall()}
        conn.close()
        return goals
    except Exception as e:
        print(f"Error in get_language_goals: {str(e)}")
        return {}


def update_language_goals(language: str, goals: Dict):
    """Update goals for a language"""
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    for activity_type, target in goals.items():
        cursor.execute('''
            INSERT INTO language_goals (language, activity_type, daily_target)
            VALUES (?, ?, ?)
            ON CONFLICT(language, activity_type) DO UPDATE SET
                daily_target = excluded.daily_target
        ''', (language, activity_type, target))
    
    conn.commit()
    conn.close()


# ============================================================================
# Weekly Goals Operations
# ============================================================================

def get_weekly_goals(language: str, week_start_date: str = None) -> Dict:
    """Get weekly goals for a language for a specific week
    
    Args:
        language: Language code
        week_start_date: Date string (YYYY-MM-DD) for Monday of target week.
                        If None, gets current week's goals.
    
    Returns a dict mapping day_of_week -> {activity_type -> target_count}
    Example: {'monday': {'reading': 2, 'listening': 1}, 'tuesday': {...}}
    
    Goals are perpetual - they apply to all future weeks until explicitly changed.
    We use week_start_date = 'default' to store the template.
    """
    try:
        from datetime import datetime, timedelta
        
        # Calculate week start date if not provided
        if week_start_date is None:
            today = datetime.now()
            week_start_date = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
        
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # First, try to get week-specific goals (for potential future override feature)
        cursor.execute('''
            SELECT day_of_week, activity_type, target_count
            FROM weekly_goals
            WHERE language = ? AND week_start_date = ?
        ''', (language, week_start_date))
        
        rows = cursor.fetchall()
        
        # If no week-specific goals, fall back to the default template
        if not rows:
            cursor.execute('''
                SELECT day_of_week, activity_type, target_count
                FROM weekly_goals
                WHERE language = ? AND week_start_date = 'default'
            ''', (language,))
            rows = cursor.fetchall()
        
        # Organize by day -> activity -> count
        weekly_goals = {}
        for row in rows:
            day = row['day_of_week']
            activity = row['activity_type']
            count = row['target_count']
            
            if day not in weekly_goals:
                weekly_goals[day] = {}
            weekly_goals[day][activity] = count
        
        conn.close()
        return weekly_goals
    except Exception as e:
        print(f"Error in get_weekly_goals: {str(e)}")
        return {}


def update_weekly_goals(language: str, weekly_goals: Dict, week_start_date: str = None):
    """Update weekly goals for a language
    
    Args:
        language: Language code
        weekly_goals: Dict mapping day_of_week -> {activity_type -> target_count}
                     Example: {'monday': {'reading': 2, 'listening': 1}, ...}
        week_start_date: Date string (YYYY-MM-DD) for Monday of target week.
                        If None, saves to 'default' template (applies perpetually).
    
    Goals are perpetual by default - they apply to all future weeks until changed.
    """
    try:
        from datetime import datetime, timedelta
        
        # Use 'default' to make goals perpetual (apply to all future weeks)
        if week_start_date is None:
            week_start_date = 'default'
        
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        # Clear existing goals for this language and week/template
        cursor.execute('''
            DELETE FROM weekly_goals 
            WHERE language = ? AND week_start_date = ?
        ''', (language, week_start_date))
        
        # Insert new goals
        for day, activities in weekly_goals.items():
            for activity_type, target_count in activities.items():
                if target_count > 0:  # Only save non-zero goals
                    cursor.execute('''
                        INSERT INTO weekly_goals (language, activity_type, day_of_week, week_start_date, target_count)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (language, activity_type, day, week_start_date, target_count))
        
        conn.commit()
        conn.close()
        
        # Sync SRS quotas from the updated weekly goals (use current week for syncing)
        if week_start_date == 'default':
            today = datetime.now()
            current_week_start = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
            sync_srs_quotas_from_weekly_goals(language, current_week_start)
        else:
            sync_srs_quotas_from_weekly_goals(language, week_start_date)
        
        return True
    except Exception as e:
        print(f"Error in update_weekly_goals: {str(e)}")
        return False


def get_today_goals(language: str) -> Dict:
    """Get today's goals for a language based on current week's weekly goals
    
    Returns a dict mapping activity_type -> target_count for today
    Example: {'reading': 2, 'listening': 1}
    """
    try:
        from datetime import datetime, timedelta
        
        # Get current day of week and date
        today = datetime.now()
        day_index = today.weekday()
        day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        today_name = day_names[day_index]
        
        # Calculate current week's Monday
        current_monday = today - timedelta(days=day_index)
        week_start_date = current_monday.strftime('%Y-%m-%d')
        
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT activity_type, target_count
            FROM weekly_goals
            WHERE language = ? AND day_of_week = ? AND week_start_date = ?
        ''', (language, today_name, week_start_date))
        
        today_goals = {row['activity_type']: row['target_count'] for row in cursor.fetchall()}
        
        conn.close()
        return today_goals
    except Exception as e:
        print(f"Error in get_today_goals: {str(e)}")
        return {}


def get_all_languages_today_goals() -> Dict:
    """Get today's goals for all languages (from current week's goals)
    
    Returns a dict mapping language -> {activity_type -> target_count}
    Example: {'kannada': {'reading': 2}, 'hindi': {'listening': 1}}
    """
    try:
        from datetime import datetime, timedelta
        
        today = datetime.now()
        day_index = today.weekday()
        day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        today_name = day_names[day_index]
        
        # Calculate current week's Monday
        current_monday = today - timedelta(days=day_index)
        week_start_date = current_monday.strftime('%Y-%m-%d')
        
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT language, activity_type, target_count
            FROM weekly_goals
            WHERE day_of_week = ? AND week_start_date = ?
        ''', (today_name, week_start_date))
        
        # Organize by language -> activity -> count
        all_goals = {}
        for row in cursor.fetchall():
            lang = row['language']
            activity = row['activity_type']
            count = row['target_count']
            
            if lang not in all_goals:
                all_goals[lang] = {}
            all_goals[lang][activity] = count
        
        conn.close()
        return all_goals
    except Exception as e:
        print(f"Error in get_all_languages_today_goals: {str(e)}")
        return {}


def get_week_goals_all_languages(week_offset: int = 0) -> Dict:
    """Get goals for all languages for a specific week
    
    Args:
        week_offset: 0 for current week, -1 for last week, 1 for next week, etc.
    
    Returns:
        Dict mapping day -> language -> {activity -> count}
    """
    try:
        from datetime import datetime, timedelta
        
        # Calculate week start date for the target week
        today = datetime.now()
        current_monday = today - timedelta(days=today.weekday())
        target_monday = current_monday + timedelta(weeks=week_offset)
        week_start_date = target_monday.strftime('%Y-%m-%d')
        
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT day_of_week, language, activity_type, target_count
            FROM weekly_goals
            WHERE week_start_date = ?
        ''', (week_start_date,))
        
        # Organize by day -> language -> activity -> count
        week_goals = {}
        day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        
        for day in day_names:
            week_goals[day] = {}
        
        for row in cursor.fetchall():
            day = row['day_of_week']
            lang = row['language']
            activity = row['activity_type']
            count = row['target_count']
            
            if day not in week_goals:
                week_goals[day] = {}
            if lang not in week_goals[day]:
                week_goals[day][lang] = {}
            week_goals[day][lang][activity] = count
        
        conn.close()
        return week_goals
    except Exception as e:
        print(f"Error in get_week_goals_all_languages: {str(e)}")
        return {}


def get_week_progress(week_offset: int = 0) -> Dict:
    """Get actual progress for a specific week across all languages
    
    Args:
        week_offset: 0 for current week, -1 for last week, 1 for next week
    
    Returns:
        Dict mapping date -> language -> {activity -> count}
    """
    try:
        from datetime import datetime, timedelta
        
        # Calculate the Monday of the target week
        today = datetime.now()
        current_monday = today - timedelta(days=today.weekday())
        target_monday = current_monday + timedelta(weeks=week_offset)
        
        # Get all 7 days of the week
        week_dates = [(target_monday + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]
        
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get progress for all dates in the week
        placeholders = ','.join(['?' for _ in week_dates])
        cursor.execute(f'''
            SELECT date, language, activity_type, count
            FROM daily_progress
            WHERE date IN ({placeholders})
        ''', week_dates)
        
        # Organize by date -> language -> activity -> count
        week_progress = {date: {} for date in week_dates}
        
        for row in cursor.fetchall():
            date = row['date']
            lang = row['language']
            activity = row['activity_type']
            count = row['count']
            
            if lang not in week_progress[date]:
                week_progress[date][lang] = {}
            week_progress[date][lang][activity] = count
        
        conn.close()
        return week_progress
    except Exception as e:
        print(f"Error in get_week_progress: {str(e)}")
        return {}


# ============================================================================
# Language Personalization Settings
# ============================================================================

def get_language_personalization(language: str) -> Dict:
    """Get personalization settings for a language
    
    Returns:
        Dict with 'default_transliterate' (bool) and other settings
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM language_personalization 
            WHERE language = ?
        ''', (language,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'language': row['language'],
                'default_transliterate': bool(row['default_transliterate']),
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
            }
        else:
            # Return defaults
            return {
                'language': language,
                'default_transliterate': True,  # Default to showing transliterations
                'created_at': None,
                'updated_at': None,
            }
    except Exception as e:
        print(f"Error getting language personalization: {str(e)}")
        return {
            'language': language,
            'default_transliterate': True,
            'created_at': None,
            'updated_at': None,
        }


def update_language_personalization(language: str, default_transliterate: bool) -> bool:
    """Update personalization settings for a language
    
    Args:
        language: Language code
        default_transliterate: Whether to show transliterations by default
    
    Returns:
        True if successful, False otherwise
    """
    try:
        from datetime import datetime
        
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        # Check if settings exist
        cursor.execute('''
            SELECT id FROM language_personalization 
            WHERE language = ?
        ''', (language,))
        
        existing = cursor.fetchone()
        now = datetime.now().isoformat()
        
        if existing:
            # Update existing settings
            cursor.execute('''
                UPDATE language_personalization 
                SET default_transliterate = ?, updated_at = ?
                WHERE language = ?
            ''', (1 if default_transliterate else 0, now, language))
        else:
            # Insert new settings
            cursor.execute('''
                INSERT INTO language_personalization 
                (language, default_transliterate, created_at, updated_at)
                VALUES (?, ?, ?, ?)
            ''', (language, 1 if default_transliterate else 0, now, now))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating language personalization: {str(e)}")
        return False


# ============================================================================
# Lesson Management
# ============================================================================

def add_lesson(lesson_id: str, title: str, language: str, level: str, steps: List[Dict], 
               unit_id: str = None, lesson_number: int = None) -> bool:
    """Add a new lesson to the database
    
    Args:
        lesson_id: Unique lesson identifier
        title: Lesson title
        language: Language name (e.g., 'Spanish', 'Kannada')
        level: CEFR level (e.g., 'A1', 'B1')
        steps: List of lesson step dictionaries
        unit_id: Optional unit identifier
        lesson_number: Optional lesson number within unit
    
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        cursor = conn.cursor()
        
        now = datetime.now().isoformat()
        steps_json = json.dumps(steps)
        
        cursor.execute('''
            INSERT INTO lessons (lesson_id, title, language, level, unit_id, lesson_number, steps_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (lesson_id, title, language, level, unit_id, lesson_number, steps_json, now, now))
        
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        # Lesson already exists, update it instead
        return update_lesson(lesson_id, title, language, level, steps, unit_id, lesson_number)
    except Exception as e:
        print(f"Error adding lesson: {str(e)}")
        return False


def update_lesson(lesson_id: str, title: str, language: str, level: str, steps: List[Dict],
                 unit_id: str = None, lesson_number: int = None) -> bool:
    """Update an existing lesson
    
    Args:
        lesson_id: Unique lesson identifier
        title: Lesson title
        language: Language name
        level: CEFR level
        steps: List of lesson step dictionaries
        unit_id: Optional unit identifier
        lesson_number: Optional lesson number within unit
    
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
        cursor = conn.cursor()
        
        now = datetime.now().isoformat()
        steps_json = json.dumps(steps)
        
        cursor.execute('''
            UPDATE lessons 
            SET title = ?, language = ?, level = ?, unit_id = ?, lesson_number = ?, steps_json = ?, updated_at = ?
            WHERE lesson_id = ?
        ''', (title, language, level, unit_id, lesson_number, steps_json, now, lesson_id))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating lesson: {str(e)}")
        return False


def get_lessons_by_language(language: str) -> List[Dict]:
    """Get all lessons for a specific language
    
    Args:
        language: Language name or code
    
    Returns:
        List of lesson dictionaries
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Try to match by language name (case-insensitive)
        # Sort by extracting the numeric part from lesson_id (e.g., ml_01_... -> 01)
        cursor.execute('''
            SELECT * FROM lessons 
            WHERE LOWER(language) = LOWER(?)
            ORDER BY CAST(SUBSTR(lesson_id, 4, 2) AS INTEGER), title
        ''', (language,))
        
        rows = cursor.fetchall()
        conn.close()
        
        lessons = []
        for row in rows:
            lessons.append({
                'lesson_id': row['lesson_id'],
                'title': row['title'],
                'language': row['language'],
                'level': row['level'],
                'steps': json.loads(row['steps_json']),
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
            })
        
        return lessons
    except Exception as e:
        print(f"Error getting lessons: {str(e)}")
        return []


def get_lesson_by_id(lesson_id: str) -> Optional[Dict]:
    """Get a specific lesson by ID
    
    Args:
        lesson_id: Unique lesson identifier
    
    Returns:
        Lesson dictionary or None if not found
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM lessons 
            WHERE lesson_id = ?
        ''', (lesson_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'lesson_id': row['lesson_id'],
                'title': row['title'],
                'language': row['language'],
                'level': row['level'],
                'steps': json.loads(row['steps_json']),
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
            }
        return None
    except Exception as e:
        print(f"Error getting lesson: {str(e)}")
        return None


def record_lesson_completion(user_id: int, lesson_id: str, answers: Dict, feedback: Dict, total_score: float = None) -> bool:
    """Record a lesson completion
    
    Args:
        user_id: User ID
        lesson_id: Lesson ID
        answers: Dictionary of answers
        feedback: Dictionary of feedback
        total_score: Overall score (optional)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        now = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO lesson_completions 
            (user_id, lesson_id, completed_at, answers_json, feedback_json, total_score)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, lesson_id, now, json.dumps(answers), json.dumps(feedback), total_score))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error recording lesson completion: {str(e)}")
        return False


def get_lesson_completions(user_id: int, lesson_id: str = None) -> List[Dict]:
    """Get lesson completion history for a user
    
    Args:
        user_id: User ID
        lesson_id: Optional lesson ID to filter by
    
    Returns:
        List of completion dictionaries
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if lesson_id:
            cursor.execute('''
                SELECT * FROM lesson_completions 
                WHERE user_id = ? AND lesson_id = ?
                ORDER BY completed_at DESC
            ''', (user_id, lesson_id))
        else:
            cursor.execute('''
                SELECT * FROM lesson_completions 
                WHERE user_id = ?
                ORDER BY completed_at DESC
            ''', (user_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        completions = []
        for row in rows:
            completions.append({
                'id': row['id'],
                'lesson_id': row['lesson_id'],
                'completed_at': row['completed_at'],
                'answers': json.loads(row['answers_json']) if row['answers_json'] else {},
                'feedback': json.loads(row['feedback_json']) if row['feedback_json'] else {},
                'total_score': row['total_score'],
            })
        
        return completions
    except Exception as e:
        print(f"Error getting lesson completions: {str(e)}")
        return []


# ============================================================================
# Unit Management
# ============================================================================

def add_unit(unit_id: str, unit_number: int, language: str, title: str, subtitle: str = None, 
             description: str = None, estimated_minutes: int = 0, lesson_count: int = 0, 
             metadata: Dict = None) -> bool:
    """Add or update a unit
    
    Args:
        unit_id: Unique unit identifier
        unit_number: Unit number for ordering
        language: Language name
        title: Unit title
        subtitle: Unit subtitle (optional)
        description: Unit description (optional)
        estimated_minutes: Estimated completion time
        lesson_count: Number of lessons in unit
        metadata: Additional metadata as dict (optional)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        now = datetime.now().isoformat()
        metadata_json = json.dumps(metadata) if metadata else None
        
        cursor.execute('''
            INSERT INTO units 
            (unit_id, unit_number, language, title, subtitle, description, estimated_minutes, 
             lesson_count, metadata_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(unit_id) DO UPDATE SET
                unit_number = excluded.unit_number,
                language = excluded.language,
                title = excluded.title,
                subtitle = excluded.subtitle,
                description = excluded.description,
                estimated_minutes = excluded.estimated_minutes,
                lesson_count = excluded.lesson_count,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at
        ''', (unit_id, unit_number, language, title, subtitle, description, estimated_minutes,
              lesson_count, metadata_json, now, now))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error adding unit: {str(e)}")
        return False


def get_units_by_language(language: str) -> List[Dict]:
    """Get all units for a specific language
    
    Args:
        language: Language name or code
    
    Returns:
        List of unit dictionaries with progress
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT u.*, 
                   up.lessons_completed,
                   up.is_completed
            FROM units u
            LEFT JOIN unit_progress up ON u.unit_id = up.unit_id AND up.user_id = 1
            WHERE LOWER(u.language) = LOWER(?)
            ORDER BY u.unit_number
        ''', (language,))
        
        rows = cursor.fetchall()
        conn.close()
        
        units = []
        for row in rows:
            units.append({
                'unit_id': row['unit_id'],
                'unit_number': row['unit_number'],
                'title': row['title'],
                'subtitle': row['subtitle'],
                'description': row['description'],
                'estimated_minutes': row['estimated_minutes'],
                'lesson_count': row['lesson_count'],
                'lessons_completed': row['lessons_completed'] or 0,
                'is_completed': bool(row['is_completed']) if row['is_completed'] is not None else False,
                'metadata': json.loads(row['metadata_json']) if row['metadata_json'] else {},
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
            })
        
        return units
    except Exception as e:
        print(f"Error getting units: {str(e)}")
        return []


def update_unit_progress(user_id: int, unit_id: str) -> bool:
    """Update unit progress based on lesson completions
    
    Args:
        user_id: User ID
        unit_id: Unit ID
    
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        # Get total lessons in unit
        cursor.execute('SELECT lesson_count FROM units WHERE unit_id = ?', (unit_id,))
        result = cursor.fetchone()
        if not result:
            conn.close()
            return False
        total_lessons = result[0]
        
        # Count completed lessons in this unit
        cursor.execute('''
            SELECT COUNT(DISTINCT lc.lesson_id)
            FROM lesson_completions lc
            JOIN lessons l ON lc.lesson_id = l.lesson_id
            WHERE lc.user_id = ? AND l.unit_id = ?
        ''', (user_id, unit_id))
        
        lessons_completed = cursor.fetchone()[0]
        is_completed = 1 if lessons_completed >= total_lessons else 0
        now = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO unit_progress (user_id, unit_id, lessons_completed, total_lessons, is_completed, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, unit_id) DO UPDATE SET
                lessons_completed = excluded.lessons_completed,
                total_lessons = excluded.total_lessons,
                is_completed = excluded.is_completed,
                updated_at = excluded.updated_at
        ''', (user_id, unit_id, lessons_completed, total_lessons, is_completed, now))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating unit progress: {str(e)}")
        return False


# ============================================================================
# Lesson Progress Tracking
# ============================================================================

def save_lesson_progress(user_id: int, lesson_id: str, current_step: int, completed_steps: List[int]) -> bool:
    """Save lesson progress (current step and completed steps)
    
    Args:
        user_id: User ID
        lesson_id: Lesson ID
        current_step: Current step index
        completed_steps: List of completed step indices
    
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        now = datetime.now().isoformat()
        completed_steps_json = json.dumps(completed_steps)
        
        cursor.execute('''
            INSERT INTO lesson_progress (user_id, lesson_id, current_step, completed_steps, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, lesson_id) 
            DO UPDATE SET 
                current_step = excluded.current_step,
                completed_steps = excluded.completed_steps,
                updated_at = excluded.updated_at
        ''', (user_id, lesson_id, current_step, completed_steps_json, now))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error saving lesson progress: {str(e)}")
        return False


def get_lesson_progress(user_id: int, lesson_id: str) -> Optional[Dict]:
    """Get lesson progress for a specific lesson
    
    Args:
        user_id: User ID
        lesson_id: Lesson ID
    
    Returns:
        Progress dictionary or None if not found
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM lesson_progress 
            WHERE user_id = ? AND lesson_id = ?
        ''', (user_id, lesson_id))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'lesson_id': row['lesson_id'],
                'current_step': row['current_step'],
                'completed_steps': json.loads(row['completed_steps']) if row['completed_steps'] else [],
                'updated_at': row['updated_at'],
            }
        return None
    except Exception as e:
        print(f"Error getting lesson progress: {str(e)}")
        return None


def clear_lesson_progress(user_id: int, lesson_id: str) -> bool:
    """Clear lesson progress (for redo functionality)
    
    Args:
        user_id: User ID
        lesson_id: Lesson ID
    
    Returns:
        True if successful, False otherwise
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM lesson_progress 
            WHERE user_id = ? AND lesson_id = ?
        ''', (user_id, lesson_id))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error clearing lesson progress: {str(e)}")
        return False


# ============================================================================
# Initialization
# ============================================================================

# Initialize database schema on import (without loading vocabulary)
# To reload vocabulary, call load_vocabulary_from_csv() manually or run init_db()
if __name__ != '__main__':
    init_db_schema()
    # Vocabulary loading is now manual - call load_vocabulary_from_csv() or init_db() when needed
    # This prevents wiping data on every module import/server restart
