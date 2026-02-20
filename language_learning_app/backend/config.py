"""
Configuration constants for Fluo backend
"""
import os
from datetime import timezone, timedelta

# Database configuration
DB_NAME = 'fluo.db'
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', DB_NAME)

# Timezone Configuration
# Set your timezone here (PST/PDT is UTC-8 or UTC-7)
# For automatic daylight saving time handling, we'll use a simple offset
# You can change this to your timezone offset from UTC
# Examples: 
#   US Pacific: -8 (PST) or -7 (PDT)
#   US Eastern: -5 (EST) or -4 (EDT)
#   India: +5.5 (IST)
#   Europe Central: +1 (CET) or +2 (CEST)
TIMEZONE_OFFSET_HOURS = -8  # PST (Change this to your timezone offset)
APP_TIMEZONE = timezone(timedelta(hours=TIMEZONE_OFFSET_HOURS))

# API Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', '')

# Server Configuration
SERVER_HOST = '0.0.0.0'
SERVER_PORT = 5001

# Vocabulary file paths
VOCAB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'vocab')
KANNADA_VOCAB_FILE = os.path.join(VOCAB_DIR, 'kannada-oxford-5000.csv')
# Prefer top-level CSVs in vocab/ if present, otherwise fall back to vocab_pipeline
HINDI_VOCAB_FILE = os.path.join(VOCAB_DIR, 'hindi-oxford-5000.csv')
if not os.path.exists(HINDI_VOCAB_FILE):
    HINDI_VOCAB_FILE = os.path.join(VOCAB_DIR, 'vocab_pipeline', 'hindi-oxford-5000.csv')

URDU_VOCAB_FILE = os.path.join(VOCAB_DIR, 'urdu-oxford-5000.csv')
if not os.path.exists(URDU_VOCAB_FILE):
    URDU_VOCAB_FILE = os.path.join(VOCAB_DIR, 'vocab_pipeline', 'urdu-oxford-5000.csv')

# ============================================================================
# SRS (Spaced Repetition System) Configuration
# ============================================================================

# Default SRS settings (applied when user hasn't customized)
DEFAULT_NEW_CARDS_PER_DAY = 3    # New words introduced per day
DEFAULT_REVIEWS_PER_DAY = 30     # Review sessions per day
MIN_REVIEWS_MULTIPLIER = 10      # reviews_per_day must be >= new_cards_per_day * this

# SRS algorithm parameters
DEFAULT_EASE_FACTOR = 2.5
MIN_EASE_FACTOR = 1.3
MAX_EASE_FACTOR = 3.5
EASE_FACTOR_INCREMENT = 0.15  # For "easy" responses
EASE_FACTOR_DECREMENT = 0.20  # For "hard" responses

# Review intervals (days) based on mastery level
INITIAL_INTERVAL = 1           # First review after learning
EASY_INTERVAL_MULTIPLIER = 1.5 # For "easy" responses
HARD_INTERVAL_MULTIPLIER = 0.5 # For "hard" responses

# Default goals
DEFAULT_DAILY_GOALS = {
    'reading': 2,
    'listening': 2,
    'writing': 2,
    'conversation': 2,
}

# Utility function to get current time in app timezone
def get_current_time():
    """Get current datetime in the app's configured timezone"""
    from datetime import datetime
    return datetime.now(APP_TIMEZONE)

def get_current_date_str():
    """Get current date as YYYY-MM-DD string in app timezone"""
    return get_current_time().strftime('%Y-%m-%d')
