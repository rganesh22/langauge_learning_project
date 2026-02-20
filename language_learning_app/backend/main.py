"""
Fluo Backend API Server
FastAPI server providing REST endpoints for the mobile app
"""
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import asyncio
import json
import sqlite3
from . import db
from . import api_client
from . import config
from . import transliteration
from .websocket_conversation import handle_websocket_conversation
from .prompting.lesson_prompts import LESSON_FREE_RESPONSE_GRADING_PROMPT

# ============================================================================
# FastAPI App Setup
# ============================================================================

app = FastAPI(
    title="Fluo Backend API",
    description="Language learning app backend with SRS and AI-powered activities",
    version="1.0.0"
)

# Enable CORS for Expo app
# Note: Cannot use allow_origins=["*"] with allow_credentials=True
# Explicitly list allowed origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",   # Expo web (default)
        "http://localhost:8082",   # Expo web (fallback)
        "http://localhost:8083",
        "http://localhost:8084",
        "http://localhost:8085",
        "http://localhost:19006",  # Expo legacy web port
        "http://localhost:19000",
        "http://localhost:3000",   # Common React dev server
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8082",
        "http://127.0.0.1:8083",
        "http://127.0.0.1:8084",
        "http://127.0.0.1:8085",
        "http://127.0.0.1:19006",
        "http://127.0.0.1:19000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database tables and schema on application startup, then sync lessons and vocab from filesystem."""
    print("[Startup] Initializing database schema...")
    db.init_db_schema()
    print("[Startup] Database initialization complete")
    
    # Auto-sync lessons from filesystem into database (guarded)
    print("[Startup] Syncing lessons from filesystem (if available)...")
    if hasattr(db, 'sync_lessons_from_files') and callable(getattr(db, 'sync_lessons_from_files')):
        try:
            db.sync_lessons_from_files()
            print("[Startup] Lesson sync complete")
        except Exception as e:
            print(f"[Startup] Lesson sync failed: {e}")
    else:
        print("[Startup] sync_lessons_from_files not present; skipping lesson sync")

    # Sync vocabulary from CSVs — loads any language whose DB count doesn't match
    # the CSV row count (first run loads everything; subsequent runs are near-instant)
    print("[Startup] Syncing vocabulary from CSVs...")
    try:
        summary = db.sync_vocab_from_csvs()
        for lang, info in summary.items():
            print(f"[Startup]   {lang}: {info['action']} ({info.get('db_rows', 0)} rows)")
        print("[Startup] Vocabulary sync complete")
    except Exception as e:
        import traceback
        print(f"[Startup] Vocabulary sync failed: {e}")
        traceback.print_exc()

# ============================================================================
# Progress Tracking for TTS Generation
# ============================================================================

class TTSProgressTracker:
    """Track TTS generation progress for a session"""
    def __init__(self, session_id: str, total_paragraphs: int):
        self.session_id = session_id
        self.total_paragraphs = total_paragraphs
        self.progress = {i: 'pending' for i in range(total_paragraphs)}
        self.queues = []  # List of asyncio queues for SSE clients
        
    def update(self, paragraph_index: int, status: str):
        """Update progress for a paragraph"""
        self.progress[paragraph_index] = status
        # Notify all connected clients
        for queue in self.queues:
            try:
                queue.put_nowait({
                    'paragraph_index': paragraph_index,
                    'status': status,
                    'progress': self.progress.copy()
                })
            except:
                pass
    
    def add_client(self, queue):
        """Add a new SSE client queue"""
        self.queues.append(queue)
        # Send current progress immediately
        queue.put_nowait({
            'type': 'init',
            'progress': self.progress.copy(),
            'total_paragraphs': self.total_paragraphs
        })
    
    def remove_client(self, queue):
        """Remove an SSE client queue"""
        if queue in self.queues:
            self.queues.remove(queue)


class TTSProgressStore:
    """Manager for TTS progress tracking sessions"""
    def __init__(self):
        self.sessions = {}  # session_id -> TTSProgressTracker
    
    def create_session(self, session_id: str, total_paragraphs: int):
        """Create a new progress tracking session"""
        tracker = TTSProgressTracker(session_id, total_paragraphs)
        self.sessions[session_id] = tracker
        return tracker
    
    def get(self, session_id: str):
        """Get a tracker by session_id"""
        return self.sessions.get(session_id)
    
    def __contains__(self, session_id: str):
        """Check if session exists"""
        return session_id in self.sessions
    
    def __delitem__(self, session_id: str):
        """Delete a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]


# Global store to track TTS progress for active sessions
tts_progress_store = TTSProgressStore()


# ============================================================================
# Request/Response Models
# ============================================================================

class WordStateUpdate(BaseModel):
    """Model for updating word state after activity"""
    word_id: int
    correct: bool


class ActivityCompletion(BaseModel):
    """Model for activity completion submission"""
    language: str
    activity_type: str
    score: float
    word_updates: List[WordStateUpdate] = []
    activity_data: Optional[Dict] = None  # Full activity data to store in history
    activity_id: Optional[int] = None  # Optional: specific activity ID to update (for reopening activities)


class GoalUpdate(BaseModel):
    """Model for updating language goals"""
    language: str
    goals: Dict[str, int]

class ConversationRequest(BaseModel):
    """Model for conversation message"""
    message: str
    conversation_id: Optional[str] = None  # Optional: ID to continue existing conversation
    voice: Optional[str] = None  # Optional: Voice to use (if continuing conversation, use same voice)

class ConversationRatingRequest(BaseModel):
    """Model for rating conversation performance"""
    conversation_id: str
    conversation_transcript: str  # Full conversation transcript


class WritingGradingRequest(BaseModel):
    """Model for grading writing activity"""
    user_text: str
    writing_prompt: str
    required_words: List[str]
    evaluation_criteria: str
    learned_words: Optional[List[Dict]] = []
    learning_words: Optional[List[Dict]] = []

class TranslationGradingRequest(BaseModel):
    """Model for grading translation activity"""
    translations: List[Dict]  # List of {source_text, source_language, user_translation, expected_translation}

class SpeakingGradingRequest(BaseModel):
    """Model for grading speaking activity with audio input"""
    audio_base64: str  # Base64-encoded audio data
    audio_format: Optional[str] = 'webm'  # Audio format
    speaking_topic: str
    tasks: List[str]
    required_words: List[str]
    learned_words: Optional[List[Dict]] = []
    learning_words: Optional[List[Dict]] = []


class SpeechToTextRequest(BaseModel):
    """Model for speech-to-text conversion"""
    audio_base64: str  # Base64-encoded audio data
    language: str = 'kannada'  # Language code (e.g., 'kannada', 'telugu')
    audio_format: Optional[str] = None  # Optional: 'wav', 'webm', 'flac', etc.


# ============================================================================
# Health & Info Endpoints
# ============================================================================

@app.get("/")
def root():
    """Root endpoint - API info"""
    return {
        "message": "Fluo Backend API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "fluo-backend"}


# ============================================================================
# WebSocket Endpoints
# ============================================================================

@app.websocket("/ws/conversation/live")
async def websocket_conversation_live(websocket: WebSocket):
    """
    WebSocket endpoint for Gemini Live conversations
    Enables real-time bidirectional audio streaming
    """
    await handle_websocket_conversation(websocket)


# ============================================================================
# User Profile Endpoints
# ============================================================================

@app.get("/api/profile")
def get_profile():
    """Get user profile with streak"""
    profile = db.get_user_profile()
    return profile


class ProfileUpdateRequest(BaseModel):
    """Model for updating user profile"""
    name: Optional[str] = None
    username: Optional[str] = None
    profile_picture_url: Optional[str] = None


@app.put("/api/profile")
def update_profile(request: ProfileUpdateRequest):
    """Update user profile"""
    success = db.update_user_profile(
        name=request.name,
        username=request.username,
        profile_picture_url=request.profile_picture_url
    )
    if success:
        updated_profile = db.get_user_profile()
        return updated_profile
    else:
        raise HTTPException(status_code=500, detail="Failed to update profile")


@app.get("/api/settings")
def get_settings(language: str = Query('kannada', description="Language code for settings")):
    """Get user settings for a specific language"""
    settings = db.get_user_settings(language)
    return {"settings": settings}


class SettingUpdateRequest(BaseModel):
    """Model for updating a user setting"""
    key: str
    value: str
    language: str = 'kannada'


@app.put("/api/settings")
def update_setting(request: SettingUpdateRequest):
    """Update a user setting for a specific language"""
    success = db.update_user_setting(request.key, request.value, request.language)
    if success:
        updated_settings = db.get_user_settings(request.language)
        return {"settings": updated_settings}
    else:
        raise HTTPException(status_code=500, detail="Failed to update setting")


# ============================================================================
# Dashboard Endpoints
# ============================================================================

@app.get("/api/dashboard/{language}")
def get_dashboard(language: str):
    """Get dashboard data for a language (streak, progress, goals, level)"""
    try:
        print(f"Getting dashboard data for {language}...")
        profile = db.get_user_profile()
        progress = db.get_daily_progress(language)
        
        # Get today's goals from weekly goals instead of daily goals
        today_goals = db.get_today_goals(language)
        
        level_info = db.calculate_user_level(language)
        
        print(f"Dashboard data retrieved successfully")
        return {
            "streak": profile.get("streak", 0),
            "progress": progress,
            "goals": today_goals,  # Today's goals from weekly plan
            "level": level_info
        }
    except Exception as e:
        print(f"Error in get_dashboard: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error loading dashboard: {str(e)}")


# ============================================================================
# Vocabulary Endpoints
# ============================================================================

@app.get("/api/vocabulary/{language}")
def get_vocabulary(
    language: str,
    search: Optional[str] = None,
    mastery_filter: Optional[list[str]] = Query(None),
    word_class_filter: Optional[list[str]] = Query(None),
    level_filter: Optional[list[str]] = Query(None),
    limit: int = 50,
    offset: int = 0
):
    """Get vocabulary with optional search and filters, supports pagination
    Filters can be multiple values (multiple query params with same name)"""
    try:
        # Handle filters - FastAPI may pass single values or lists
        # Convert to lists if needed, then to comma-separated strings
        def normalize_filter(filter_value):
            if filter_value is None:
                return ''
            if isinstance(filter_value, str):
                return filter_value  # Already a string (comma-separated from multiple params)
            if isinstance(filter_value, list):
                return ','.join(filter_value) if filter_value else ''
            return str(filter_value)
        
        mastery_filter_str = normalize_filter(mastery_filter)
        word_class_filter_str = normalize_filter(word_class_filter)
        level_filter_str = normalize_filter(level_filter)
        
        # Debug logging
        print(f"Filters received - mastery: {mastery_filter} (type: {type(mastery_filter)}), word_class: {word_class_filter} (type: {type(word_class_filter)}), level: {level_filter} (type: {type(level_filter)})")
        print(f"Filters as strings - mastery: '{mastery_filter_str}', word_class: '{word_class_filter_str}', level: '{level_filter_str}'")
        
        # Decode URL-encoded search query if needed
        import urllib.parse
        if search:
            try:
                search = urllib.parse.unquote(search)
            except:
                pass  # If decoding fails, use as-is
        
        words, total_count = db.get_vocabulary(
            language, 
            search or '', 
            mastery_filter_str,
            word_class_filter_str,
            level_filter_str,
            limit,
            offset
        )
    except Exception as e:
        print(f"Error in get_vocabulary: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error searching vocabulary: {str(e)}")
    return {
        "words": words, 
        "count": len(words),
        "total": total_count,
        "offset": offset,
        "limit": limit,
        "has_more": offset + len(words) < total_count
    }


class TransliterationRequest(BaseModel):
    text: str
    language: str
    to_script: Optional[str] = 'IAST'  # IAST or ITRANS
    from_script: Optional[str] = None

@app.post("/api/transliterate")
def transliterate_endpoint(request: TransliterationRequest):
    """Transliterate text from target language script to Roman using IAST or ITRANS via aksharmukha"""
    # Allow client to specify source script for disambiguation (e.g., Devanagari vs Urdu Perso-Arabic)
    result = transliteration.transliterate_text(request.text, request.language, request.to_script or 'IAST', request.from_script)
    # Return debug info as well for development troubleshooting
    return {
        "original": request.text,
        "transliteration": result,
        "requested_from": request.from_script,
        "requested_to": request.to_script,
        "language": request.language,
    }


# ============================================================================
# Vocabulary Import Endpoint
# ============================================================================

class TextImportRequest(BaseModel):
    text: str
    language: str
    target_languages: Optional[List[str]] = None  # Languages to cross-translate into

@app.post("/api/vocab/import-text")
async def import_text_to_vocab(request: TextImportRequest):
    """Import text to vocabulary with lemmatization and translation

    Process:
    1. Split text into words
    2. Batch lemmatize words (10 words per batch)
    3. Check for existing entries
    4. Batch translate new words
    5. Transliterate using Aksharmukha
    6. Insert into database with origin='user'
    """
    try:
        import re
        import traceback
        from .prompting.vocab_import_prompts import get_lemmatization_prompt, get_translation_prompt

        # Use target_languages from request, or fall back to user's active languages
        if request.target_languages and len(request.target_languages) > 0:
            user_languages = request.target_languages
        else:
            user_languages = []

        # Step 1: Split text into words
        words = re.findall(
            r'[\w\u0900-\u097F\u0C00-\u0C7F\u0D00-\u0D7F\u0B80-\u0BFF\u0A80-\u0AFF\u0C80-\u0CFF]+',
            request.text,
        )
        words = list(dict.fromkeys(w.strip() for w in words if w.strip()))  # dedupe, preserve order

        if not words:
            return {
                "success": True,
                "message": "No words found in text",
                "new_words": 0, "existing_words": 0,
                "added": [], "existing": []
            }

        BATCH_SIZE = 10
        all_lemmatized = []

        # Step 2: Batch lemmatize
        for i in range(0, len(words), BATCH_SIZE):
            batch = words[i:i + BATCH_SIZE]
            prompt = get_lemmatization_prompt(request.language, batch)
            response_text, *_ = api_client.generate_text_with_gemini(
                prompt, model_name=api_client.GEMINI_MODEL
            )
            try:
                parsed = json.loads(response_text.strip().replace('```json', '').replace('```', ''))
                if isinstance(parsed, list):
                    all_lemmatized.extend(parsed)
            except json.JSONDecodeError as e:
                print(f"Lemmatization batch {i // BATCH_SIZE + 1} parse error: {e}")
                continue

        if not all_lemmatized:
            raise HTTPException(status_code=400, detail="Failed to lemmatize words")

        # Step 3: Check existing entries
        existing_words = []
        new_words = []
        seen = set()

        for wd in all_lemmatized:
            word = wd.get('word', '').strip()
            if not word or word in seen:
                continue
            seen.add(word)
            existing = db.find_word_by_translation(word, request.language)
            if existing:
                translit = existing.get('transliteration', '')
                if not translit and existing.get('translation'):
                    translit = transliteration.transliterate_text(
                        existing['translation'], request.language, 'IAST'
                    )
                existing_words.append({
                    'word': word,
                    'transliteration': translit,
                    'english_word': existing.get('english_word', ''),
                    'word_class': existing.get('word_class', '')
                })
            else:
                new_words.append(wd)

        # Step 4: Batch translate new words
        added_words = []
        for i in range(0, len(new_words), BATCH_SIZE):
            batch = new_words[i:i + BATCH_SIZE]
            prompt = get_translation_prompt(request.language, batch, user_languages)
            response_text, *_ = api_client.generate_text_with_gemini(
                prompt, model_name=api_client.GEMINI_MODEL
            )
            try:
                translations = json.loads(response_text.strip().replace('```json', '').replace('```', ''))
            except json.JSONDecodeError as e:
                print(f"Translation batch {i // BATCH_SIZE + 1} parse error: {e}")
                continue

            # Step 5: Transliterate with Aksharmukha and insert
            for td in translations:
                word = td.get('word', '').strip()
                if not word:
                    continue
                word_class = next(
                    (w['word_class'] for w in batch if w['word'] == word),
                    td.get('word_class', 'noun')
                )
                translit = transliteration.transliterate_text(word, request.language, 'IAST')

                db.insert_vocabulary_entry(
                    language=request.language,
                    english_word=td.get('english', ''),
                    translation=word,
                    transliteration=translit,
                    word_class=word_class,
                    level=None,
                    origin='user',
                )
                added_words.append({
                    'word': word,
                    'transliteration': translit,
                    'english_word': td.get('english', ''),
                    'word_class': word_class,
                })

                # Insert cross-language translations
                for lang, trans_text in td.get('translations', {}).items():
                    if lang in user_languages and trans_text:
                        if not db.find_word_by_translation(trans_text, lang):
                            t_translit = transliteration.transliterate_text(trans_text, lang, 'IAST')
                            db.insert_vocabulary_entry(
                                language=lang,
                                english_word=td.get('english', ''),
                                translation=trans_text,
                                transliteration=t_translit,
                                word_class=word_class,
                                level=None,
                                origin='user',
                            )

        return {
            "success": True,
            "message": f"Added {len(added_words)} new words, {len(existing_words)} already exist",
            "new_words": len(added_words),
            "existing_words": len(existing_words),
            "added": added_words,
            "existing": existing_words,
        }

    except json.JSONDecodeError as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Lesson Endpoints
# ============================================================================

@app.get("/api/lessons/{language}")
def get_lessons(language: str, user_id: int = 1):
    """Get all available lessons for a language with completion status"""
    try:
        # Get lessons from database
        lessons = db.get_lessons_by_language(language)
        
        # Get all completion records for this user
        all_completions = db.get_lesson_completions(user_id)
        
        # Create a map of lesson completions and progress
        completion_map = {}
        for completion in all_completions:
            lesson_id = completion['lesson_id']
            if lesson_id not in completion_map:
                completion_map[lesson_id] = {
                    'completed': True,
                    'completed_at': completion['completed_at'],
                    'total_score': completion['total_score']
                }
        
        # Add completion status to each lesson
        for lesson in lessons:
            lesson_id = lesson['lesson_id']
            if lesson_id in completion_map:
                lesson['completed'] = True
                lesson['completed_at'] = completion_map[lesson_id]['completed_at']
                lesson['total_score'] = completion_map[lesson_id]['total_score']
            else:
                lesson['completed'] = False
                lesson['in_progress'] = False  # Will be updated by frontend tracking
        
        return {"lessons": lessons}
    except Exception as e:
        print(f"Error fetching lessons: {str(e)}")
        return {"lessons": []}


class LessonFreeResponseRequest(BaseModel):
    language: str
    user_cefr_level: str
    question: str
    user_answer: str
    lesson_context: Optional[Dict] = None


@app.post("/api/lessons/grade-free-response")
def grade_lesson_free_response(request: LessonFreeResponseRequest):
    """Grade a free response answer from a lesson using AI"""
    try:
        # Use the prompt from prompting folder
        prompt = LESSON_FREE_RESPONSE_GRADING_PROMPT.format(
            language=request.language,
            user_cefr_level=request.user_cefr_level,
            question=request.question,
            user_answer=request.user_answer
        )
        
        # Generate with Gemini
        response_text, response_time, token_info, is_truncated, _ = api_client.generate_text_with_gemini(prompt)
        
        if not response_text:
            raise HTTPException(status_code=500, detail="Failed to generate feedback")
        
        # Parse JSON response
        result = api_client.parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            # Fallback: provide basic feedback
            return {
                "score": 50,
                "feedback": "Your response has been received. Keep practicing!"
            }
        
        return {
            "score": result.get("score", 50),
            "feedback": result.get("feedback", "Good effort! Keep practicing."),
            "_response_time": response_time,
            "_token_info": token_info
        }
        
    except Exception as e:
        print(f"Error grading free response: {e}")
        import traceback
        traceback.print_exc()
        # Return a graceful fallback instead of error
        return {
            "score": 50,
            "feedback": "Thank you for your response. Your effort is appreciated!"
        }


class LessonCompletionRequest(BaseModel):
    lesson_id: str
    answers: Dict
    feedback: Dict
    total_score: Optional[float] = None


@app.post("/api/lessons/complete")
def complete_lesson(request: LessonCompletionRequest):
    """Record a lesson completion"""
    try:
        user_id = 1  # Default user
        success = db.record_lesson_completion(
            user_id=user_id,
            lesson_id=request.lesson_id,
            answers=request.answers,
            feedback=request.feedback,
            total_score=request.total_score
        )
        
        if success:
            return {"success": True, "message": "Lesson completion recorded"}
        else:
            raise HTTPException(status_code=500, detail="Failed to record completion")
    except Exception as e:
        print(f"Error recording lesson completion: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/lessons/completions/{lesson_id}")
def get_lesson_completion_history(lesson_id: str):
    """Get completion history for a specific lesson"""
    try:
        user_id = 1  # Default user
        completions = db.get_lesson_completions(user_id, lesson_id)
        return {"completions": completions}
    except Exception as e:
        print(f"Error getting lesson completions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class LessonProgressRequest(BaseModel):
    lesson_id: str
    current_step: int
    completed_steps: List[int]


@app.post("/api/lessons/progress")
def save_progress(request: LessonProgressRequest):
    """Save lesson progress (current step and completed steps)"""
    try:
        user_id = 1  # Default user
        success = db.save_lesson_progress(
            user_id=user_id,
            lesson_id=request.lesson_id,
            current_step=request.current_step,
            completed_steps=request.completed_steps
        )
        
        if success:
            return {"success": True, "message": "Progress saved"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save progress")
    except Exception as e:
        print(f"Error saving lesson progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/lessons/progress/{lesson_id}")
def get_progress(lesson_id: str):
    """Get lesson progress"""
    try:
        user_id = 1  # Default user
        progress = db.get_lesson_progress(user_id, lesson_id)
        if progress:
            return progress
        else:
            return {"lesson_id": lesson_id, "current_step": 0, "completed_steps": []}
    except Exception as e:
        print(f"Error getting lesson progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/lessons/progress/{lesson_id}")
def clear_progress(lesson_id: str):
    """Clear lesson progress (for redo functionality)"""
    try:
        user_id = 1  # Default user
        success = db.clear_lesson_progress(user_id, lesson_id)
        
        if success:
            return {"success": True, "message": "Progress cleared"}
        else:
            raise HTTPException(status_code=500, detail="Failed to clear progress")
    except Exception as e:
        print(f"Error clearing lesson progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/lessons/by-id/{lesson_id}")
def get_lesson_by_id(lesson_id: str, user_id: int = 1):
    """Get a specific lesson by ID with completion status"""
    try:
        conn = db.sqlite3.connect(db.config.DB_PATH)
        conn.row_factory = db.sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM lessons WHERE lesson_id = ?', (lesson_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Lesson not found")
        
        # Check if lesson is completed
        completions = db.get_lesson_completions(user_id)
        completed = any(c['lesson_id'] == lesson_id for c in completions)
        
        lesson = {
            'lesson_id': row['lesson_id'],
            'title': row['title'],
            'language': row['language'],
            'level': row['level'],
            'steps': json.loads(row['steps_json']) if row['steps_json'] else [],
            'unit_id': row['unit_id'] if row['unit_id'] else None,
            'lesson_number': row['lesson_number'] if row['lesson_number'] else None,
            'completed': completed,
        }
        
        return {"lesson": lesson}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting lesson by ID: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Units API
# ============================================================================

@app.get("/api/units/{language}")
def get_units(language: str, user_id: int = 1):
    """Get all units for a language with progress"""
    try:
        units = db.get_units_by_language(language)
        return {"units": units}
    except Exception as e:
        print(f"Error getting units: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/units/{unit_id}/lessons")
def get_unit_lessons(unit_id: str, user_id: int = 1):
    """Get all lessons in a unit with completion status"""
    try:
        # Get all lessons for this unit
        conn = db.sqlite3.connect(db.config.DB_PATH)
        conn.row_factory = db.sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM lessons 
            WHERE unit_id = ?
            ORDER BY lesson_number
        ''', (unit_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        lessons = []
        all_completions = db.get_lesson_completions(user_id)
        completion_map = {c['lesson_id']: c for c in all_completions}
        
        for row in rows:
            lesson = {
                'lesson_id': row['lesson_id'],
                'title': row['title'],
                'language': row['language'],
                'level': row['level'],
                'lesson_number': row['lesson_number'],
                'steps': db.json.loads(row['steps_json']),
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
            }
            
            # Add completion status
            if lesson['lesson_id'] in completion_map:
                lesson['completed'] = True
                lesson['completed_at'] = completion_map[lesson['lesson_id']]['completed_at']
                lesson['total_score'] = completion_map[lesson['lesson_id']]['total_score']
            else:
                lesson['completed'] = False
            
            # Check for in-progress
            progress = db.get_lesson_progress(user_id, lesson['lesson_id'])
            lesson['inProgress'] = bool(progress and (progress['current_step'] > 0 or progress['completed_steps']))
            
            lessons.append(lesson)
        
        return {"lessons": lessons}
    except Exception as e:
        print(f"Error getting unit lessons: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/units/{unit_id}/update-progress")
def update_unit_progress_endpoint(unit_id: str, user_id: int = 1):
    """Update unit progress based on lesson completions"""
    try:
        success = db.update_unit_progress(user_id, unit_id)
        if success:
            return {"success": True, "message": "Unit progress updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update unit progress")
    except Exception as e:
        print(f"Error updating unit progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Continue with rest of API...
# ============================================================================

    except Exception as e:
        print(f"Error clearing lesson progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/lessons/admin/reload")
def reload_lessons_from_files():
    """Admin endpoint to reload lessons from JSON files on disk into the database."""
    try:
        db.sync_lessons_from_files()
        # Count what was loaded
        conn = db.sqlite3.connect(db.config.DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM lessons')
        lesson_count = cursor.fetchone()[0]
        cursor.execute('SELECT COUNT(*) FROM units')
        unit_count = cursor.fetchone()[0]
        conn.close()
        return {"success": True, "loaded_lessons": lesson_count, "loaded_units": unit_count, "message": "Lessons reloaded from filesystem"}
    except Exception as e:
        print(f"Error reloading lessons: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class LessonWordsRequest(BaseModel):
    allowed_chars: List[str]
    target_count: int = 50
    max_count: int = 60


@app.post("/api/lesson-words/{language}/{lesson_id}")
def lesson_words(language: str, lesson_id: str, request: LessonWordsRequest):
    """Get (and cache) words for a specific lesson, filtered by allowed characters learned so far."""
    try:
        words = db.get_lesson_words(
            language=language,
            lesson_id=lesson_id,
            allowed_chars=request.allowed_chars,
            target_count=request.target_count,
            max_count=request.max_count,
        )
        return {"words": words}
    except Exception as e:
        print(f"Error generating lesson words: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate lesson words")


@app.get("/api/words-for-review/{language}")
def get_words_for_review(language: str, limit: int = 10, mode: str = "all"):
    """Get words due for review based on SRS
    
    Args:
        language: Language code
        limit: Max number of words to return
        mode: 'all' (default), 'reviews' (only due reviews), or 'new' (only new words)
    """
    if mode == "reviews":
        words = db.get_words_for_review_only(language, limit)
    elif mode == "new":
        words = db.get_new_words_only(language, limit)
    else:
        words = db.get_words_for_review(language, limit)
    return {"words": words}


# ============================================================================
# Activity Generation Endpoints
# ============================================================================

@app.post("/api/activity/reading/{language}")
async def create_reading_activity(language: str, request: Request):
    """Generate a reading activity with story and questions"""
    try:
        # Parse request body for optional topic (handle empty body gracefully)
        body = {}
        try:
            if request.headers.get('content-type') == 'application/json':
                body = await request.json()
        except json.JSONDecodeError:
            # Empty or invalid JSON body - that's okay, we'll use random topic
            print("[Reading Activity] No valid JSON body provided, will use random topic")
            pass
        
        custom_topic = body.get('topic') if body else None
        
        # Get user's interests if random topic
        user_interests = []
        if custom_topic is None:
            try:
                conn = sqlite3.connect(config.DB_PATH)
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT value FROM user_preferences
                    WHERE user_id = 1 AND key = 'selected_interests'
                ''')
                row = cursor.fetchone()
                if row and row[0]:
                    user_interests = json.loads(row[0])
                conn.close()
            except Exception as e:
                print(f"Error fetching user interests: {e}")
        
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        # Get 200-300 words for the comprehensive word bank
        # Randomly select ~200 learned words and ~50 learning words
        word_bank_words = db.get_words_for_activity(language, learned_limit=200, learning_limit=50)
        if not word_bank_words:
            raise HTTPException(status_code=404, detail="No words available for activity")
        
        # Select 10 learning words that MUST be used in the story
        import random
        learning_words = [w for w in word_bank_words if w.get('mastery_level') in ['learning', 'review']]
        if not learning_words:
            # If no learning words, use new words as fallback
            learning_words = [w for w in word_bank_words if w.get('mastery_level') not in ['mastered', 'learning', 'review']]
        
        # Randomly select 10 learning words (or all if less than 10)
        required_learning_words = random.sample(learning_words, min(10, len(learning_words))) if learning_words else []
        
        print(f"Generating reading activity for {language} with {len(word_bank_words)} words...")
        print(f"User CEFR level: {user_cefr_level}")
        print(f"Custom topic: {custom_topic if custom_topic else 'Random (based on interests)'}")
        print(f"User interests: {user_interests}")
        print(f"Selected {len(required_learning_words)} required learning words: {[w.get('english_word') for w in required_learning_words]}")
        
        # Dictionary will be populated from words extracted from story text
        activity = api_client.generate_reading_activity(
            word_bank_words, 
            None, 
            language, 
            required_learning_words=required_learning_words, 
            user_cefr_level=user_cefr_level,
            custom_topic=custom_topic,
            user_interests=user_interests
        )
        
        if not activity:
            raise HTTPException(status_code=500, detail="Failed to generate activity")
        
        # Save activity immediately after generation (before user completes it)
        # This allows it to be reopened from history
        activity_data_json = json.dumps(activity)
        print(f"Activity data JSON length: {len(activity_data_json)}")
        print(f"Activity has story: {bool(activity.get('story'))}, questions: {bool(activity.get('questions'))}")
        activity_id = db.log_activity(
            language,
            'reading',
            0.0,  # Score is 0 until completed
            activity_data_json
        )
        if activity_id:
            print(f"✓ Activity saved with ID: {activity_id}")
            activity['activity_id'] = activity_id
        print(f"✓ Activity saved immediately after generation for {language} (data length: {len(activity_data_json)})")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in create_reading_activity: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating activity: {str(e)}")
    
    # Get words_used_data from activity response (extracted from story text)
    words_used_from_story = activity.get('_words_used_data', [])
    
    # If no words extracted, fall back to empty list (dictionary will be empty)
    words_used_data = [
        {
            "id": w["id"],
            "word": w["english_word"],
            "kannada": w.get("translation", ""),
            "transliteration": w.get("transliteration", ""),
            "word_class": w.get("word_class", ""),
            "level": w.get("level", ""),
            "mastery_level": w.get("mastery_level", "new"),
            "verb_transitivity": w.get("verb_transitivity", ""),
        }
        for w in words_used_from_story
    ]
    token_info = activity.get("_token_info", {})
    return {
        "activity": activity,
        "words_used": words_used_data,
        "api_details": {
            "endpoint": f"POST /api/activity/reading/{language}",
            "prompt": activity.get("_prompt", ""),
            "words": activity.get("_words", []),
            "response_time": activity.get("_response_time", 0),
            "raw_response": activity.get("_raw_response", ""),
            "learned_words": activity.get("_learned_words", []),
            "learning_words": activity.get("_learning_words", []),
            "token_info": token_info,
            "parse_error": activity.get("_parse_error"),
        }
    }


@app.get("/api/activity/listening/progress/{session_id}")
async def listening_progress_sse(session_id: str):
    """Server-Sent Events endpoint for real-time TTS progress updates"""
    
    async def event_generator():
        """Generate SSE events for TTS progress"""
        queue = asyncio.Queue()
        
        # Get or wait for the progress tracker
        max_wait = 30  # Wait up to 30 seconds for session to be created
        wait_interval = 0.5
        waited = 0
        
        while session_id not in tts_progress_store and waited < max_wait:
            await asyncio.sleep(wait_interval)
            waited += wait_interval
        
        if session_id not in tts_progress_store:
            yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
            return
        
        tracker = tts_progress_store.get(session_id)
        tracker.add_client(queue)
        
        try:
            while True:
                # Wait for progress updates
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(data)}\n\n"
                    
                    # Check if all paragraphs are complete
                    all_complete = all(
                        status in ['complete', 'error'] 
                        for status in tracker.progress.values()
                    )
                    if all_complete:
                        yield f"data: {json.dumps({'type': 'complete'})}\n\n"
                        break
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f": keepalive\n\n"
        finally:
            tracker.remove_client(queue)
            # Clean up session if no more clients
            if not tracker.queues and session_id in tts_progress_store:
                del tts_progress_store[session_id]
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ============================================================================
# Activity Generation Background Task
# ============================================================================

# Store for completed activities by session_id
completed_activities = {}

def generate_listening_activity_background(
    session_id: str,
    word_bank_words: list,
    language: str,
    required_learning_words: list,
    user_cefr_level: str,
    custom_topic: str = None,
    user_interests: list = None
):
    """Background task to generate listening activity with progress updates"""
    try:
        print(f"[Background Task] Starting activity generation for session {session_id}")
        if custom_topic:
            print(f"[Background Task] Using custom topic: {custom_topic}")
        elif user_interests:
            print(f"[Background Task] User interests: {user_interests}")
        
        activity = api_client.generate_listening_activity(
            word_bank_words, 
            language, 
            required_learning_words=required_learning_words, 
            user_cefr_level=user_cefr_level,
            session_id=session_id,
            progress_store=tts_progress_store,
            custom_topic=custom_topic,
            user_interests=user_interests
        )
        
        if not activity:
            print(f"[Background Task] Failed to generate activity for session {session_id}")
            return
        
        # Check for errors in activity
        if activity.get('_error'):
            error_detail = activity.get('_error', 'Unknown error')
            error_type = activity.get('_error_type', 'unknown')
            print(f"⚠️ [Background Task] Activity generation error: {error_type} - {error_detail}")
            completed_activities[session_id] = {
                "status": "error",
                "error": f"{error_type}: {error_detail}"
            }
            return
        
        # Save activity to history
        activity_data_json = json.dumps(activity)
        activity_id = db.log_activity(language, 'listening', 0.0, activity_data_json)
        if activity_id:
            print(f"✅ [Background Task] Activity logged with ID: {activity_id}")
            activity['activity_id'] = activity_id
        
        # Extract words_used from activity
        words_used_data = activity.get('_words_used_data', [])
        
        # Build API details
        token_info = activity.get("_token_info", {})
        tts_cost = activity.get("_tts_cost", 0.0)
        total_cost = token_info.get('total_cost', 0.0) + tts_cost
        
        api_details = {
            "endpoint": f"POST /api/activity/listening/{language}",
            "session_id": session_id,
            "prompt": activity.get("_prompt", ""),
            "learned_words": activity.get("_learned_words", []),
            "required_learning_words": activity.get("_required_learning_words", []),
            "response_time": activity.get("_response_time", 0),
            "raw_response": activity.get("_raw_response", ""),
            "token_info": token_info,
            "tts_cost": tts_cost,
            "tts_response_time": activity.get("_tts_response_time", 0.0),
            "total_cost": total_cost,
            "voice_used": activity.get("_voice_used", ""),
            "speaker_profile": activity.get("_speaker_profile"),
            "parse_error": activity.get("_parse_error"),
            "error": activity.get("_error"),
            "error_type": activity.get("_error_type"),
            "tts_errors": activity.get("_tts_errors"),
            "warning": activity.get("_warning"),
            "debug_steps": activity.get("_debug_steps", []),
        }
        
        # Store completed activity with full structure
        completed_activities[session_id] = {
            "status": "complete",
            "activity": activity,
            "words_used": words_used_data,
            "api_details": api_details
        }
        print(f"✅ [Background Task] Activity generation complete for session {session_id}")
        
        # Notify progress tracker that generation is fully complete
        if session_id in tts_progress_store:
            tracker = tts_progress_store.get(session_id)
            if tracker:
                # Send a final completion notification to all SSE clients
                for queue in tracker.queues:
                    try:
                        queue.put_nowait({
                            'type': 'generation_complete',
                            'message': 'Activity generation completed',
                            'progress': tracker.progress.copy()
                        })
                    except:
                        pass
        
    except Exception as e:
        import traceback
        error_msg = f"Error in background task: {str(e)}"
        print(f"❌ [Background Task] {error_msg}")
        print(traceback.format_exc())
        completed_activities[session_id] = {
            "status": "error",
            "error": error_msg
        }


# ============================================================================
# Activity Endpoints
# ============================================================================


@app.post("/api/activity/listening/{language}")
async def create_listening_activity(language: str, request: Request, background_tasks: BackgroundTasks):
    """Initialize a listening activity session and return session ID immediately"""
    try:
        # Parse topic from request body (handle empty body gracefully)
        body = {}
        try:
            if request.headers.get('content-type') == 'application/json':
                body = await request.json()
        except json.JSONDecodeError:
            # Empty or invalid JSON body - that's okay, we'll use random topic
            print("[Listening Activity] No valid JSON body provided, will use random topic")
            pass
        
        custom_topic = body.get('topic') if body else None
        
        # Get user interests if random topic
        user_interests = []
        if custom_topic is None:
            try:
                conn = sqlite3.connect(config.DB_PATH)
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT value FROM user_preferences
                    WHERE user_id = 1 AND key = 'selected_interests'
                ''')
                row = cursor.fetchone()
                if row and row[0]:
                    user_interests = json.loads(row[0])
                conn.close()
            except Exception as e:
                print(f"Error fetching user interests: {e}")
        
        # Create a unique session ID for progress tracking
        import uuid
        session_id = str(uuid.uuid4())
        
        print(f"\n{'='*80}")
        print(f"[Listening Activity] Starting generation for {language}")
        print(f"[Listening Activity] Session ID: {session_id}")
        if custom_topic:
            print(f"[Listening Activity] Custom topic: {custom_topic}")
        elif user_interests:
            print(f"[Listening Activity] User interests: {user_interests}")
        print(f"{'='*80}\n")
        
        # Initialize progress tracker IMMEDIATELY with 5 paragraphs (standard for listening)
        tts_progress_store.create_session(session_id, total_paragraphs=5)
        print(f"[Listening Activity] Progress tracker initialized for session {session_id}")
        
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        # Get 200-300 words for the comprehensive word bank
        word_bank_words = db.get_words_for_activity(language, learned_limit=200, learning_limit=50)
        if not word_bank_words:
            raise HTTPException(status_code=404, detail="No words available for activity")
        
        # Get 10 learning words that MUST be used
        import random
        learning_words = [w for w in word_bank_words if w.get('mastery_level') in ['learning', 'review']]
        if not learning_words:
            learning_words = [w for w in word_bank_words if w.get('mastery_level') not in ['mastered', 'learning', 'review']]
        
        required_learning_words = random.sample(learning_words, min(10, len(learning_words))) if learning_words else []
        
        print(f"[Listening Activity] User CEFR level: {user_cefr_level}")
        print(f"[Listening Activity] Required learning words: {[w.get('english_word') for w in required_learning_words]}")
        
        # Start activity generation in background
        background_tasks.add_task(
            generate_listening_activity_background,
            session_id,
            word_bank_words,
            language,
            required_learning_words,
            user_cefr_level,
            custom_topic,
            user_interests
        )
        
        # Return session ID immediately so frontend can connect to SSE
        return {
            "session_id": session_id,
            "status": "generating",
            "message": "Activity generation started. Connect to SSE for progress updates."
        }
    except Exception as e:
        import traceback
        print(f"Error creating listening activity: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/activity/listening/result/{session_id}")
def get_listening_activity_result(session_id: str):
    """Retrieve the completed activity for a session"""
    if session_id not in completed_activities:
        return {
            "status": "generating",
            "message": "Activity is still being generated. Check progress via SSE."
        }
    
    result = completed_activities[session_id]
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["error"])
    
    # Return the completed activity in the same format as the old endpoint
    response = {
        "activity": result["activity"],
        "words_used": result.get("words_used", []),
        "api_details": result.get("api_details", {})
    }
    
    # Clean up the stored activity after retrieval
    del completed_activities[session_id]
    
    return response


# Old synchronous endpoint code removed - now using async background generation


@app.post("/api/activity/speaking/{language}")
async def create_speaking_activity(language: str, request: Request):
    """Generate a speaking activity with topic and instructions"""
    try:
        # Parse topic from request body (handle empty body gracefully)
        body = {}
        try:
            if request.headers.get('content-type') == 'application/json':
                body = await request.json()
        except json.JSONDecodeError:
            # Empty or invalid JSON body - that's okay, we'll use random topic
            print("[Speaking Activity] No valid JSON body provided, will use random topic")
            pass
        
        custom_topic = body.get('topic') if body else None
        
        # Get user interests if random topic
        user_interests = []
        if custom_topic is None:
            try:
                conn = sqlite3.connect(config.DB_PATH)
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT value FROM user_preferences
                    WHERE user_id = 1 AND key = 'selected_interests'
                ''')
                row = cursor.fetchone()
                if row and row[0]:
                    user_interests = json.loads(row[0])
                conn.close()
            except Exception as e:
                print(f"Error fetching user interests: {e}")
        
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        # Get 200-300 words for the comprehensive word bank
        word_bank_words = db.get_words_for_activity(language, learned_limit=200, learning_limit=50)
        if not word_bank_words:
            raise HTTPException(status_code=404, detail="No words available for activity")
        
        # Select required words: mostly learning words (7-8) + some learned words (2-3) = 10 total
        import random
        random.shuffle(word_bank_words)  # Shuffle for randomness
        
        learning_words = [w for w in word_bank_words if w.get('mastery_level') in ['learning', 'review']]
        learned_words = [w for w in word_bank_words if w.get('mastery_level') == 'mastered']
        
        # If no learning words, use new words as fallback
        if not learning_words:
            learning_words = [w for w in word_bank_words if w.get('mastery_level') not in ['mastered', 'learning', 'review']]
        
        # Randomly select 7-8 learning words (mostly)
        num_learning = min(random.randint(7, 8), len(learning_words))
        selected_learning = random.sample(learning_words, num_learning) if learning_words else []
        
        # Randomly select 2-3 learned words (some)
        num_learned = min(10 - len(selected_learning), len(learned_words))
        selected_learned = random.sample(learned_words, num_learned) if learned_words and num_learned > 0 else []
        
        # Combine and shuffle to randomize order
        required_learning_words = selected_learning + selected_learned
        random.shuffle(required_learning_words)
        
        # Ensure we have at least some words (fallback if needed)
        if len(required_learning_words) < 5:
            # Add more words from any available
            remaining = [w for w in word_bank_words if w not in required_learning_words]
            needed = 10 - len(required_learning_words)
            required_learning_words.extend(random.sample(remaining, min(needed, len(remaining))))
        
        print(f"Generating speaking activity for {language} with {len(word_bank_words)} words...")
        print(f"User CEFR level: {user_cefr_level}")
        print(f"Selected {len(required_learning_words)} required learning words: {[w.get('english_word') for w in required_learning_words]}")
        
        activity = api_client.generate_speaking_activity(
            word_bank_words, 
            language, 
            required_learning_words=required_learning_words, 
            user_cefr_level=user_cefr_level,
            custom_topic=custom_topic,
            user_interests=user_interests
        )
        
        if not activity:
            raise HTTPException(status_code=500, detail="Failed to generate activity")
        
        # Check for errors in activity
        if activity.get('_error'):
            error_detail = activity.get('_error', 'Unknown error')
            error_type = activity.get('_error_type', 'unknown')
            print(f"⚠️ Activity generation error: {error_type} - {error_detail}")
            raise HTTPException(
                status_code=500, 
                detail=f"Error creating speaking activity: {error_type}: {error_detail}"
            )
        
        # Save activity immediately after generation
        activity_data_json = json.dumps(activity)
        activity_id = db.log_activity(
            language,
            'speaking',
            0.0,
            activity_data_json
        )
        if activity_id:
            activity['activity_id'] = activity_id
        print(f"✓ Activity saved immediately after generation for {language} (id={activity_id})")
        
        # Extract words from topic and instructions text (similar to reading/listening activities)
        words_used_data = []
        speaking_topic = activity.get('topic', '')
        instructions = activity.get('instructions', '')
        activity_name = activity.get('activity_name', '')
        
        all_text = speaking_topic + ' ' + instructions + ' ' + activity_name
        words_used_from_text = api_client.extract_words_from_text(all_text, word_bank_words)
        
        for w in words_used_from_text:
            words_used_data.append({
                "id": w.get("id", 0),
                "word": w.get("english_word", ""),
                "kannada": w.get("translation", ""),
                "transliteration": w.get("transliteration", ""),
                "word_class": w.get("word_class", ""),
                "level": w.get("level", ""),
                "mastery_level": w.get("mastery_level", "new"),
                "verb_transitivity": w.get("verb_transitivity", ""),
            })
        
        token_info = activity.get("_token_info", {})
        
        # Ensure required_words are included in the activity object
        if 'required_words' not in activity:
            # Extract Kannada words from required_learning_words
            required_words_kannada = [w.get('translation', '').split(' /')[0].strip() for w in required_learning_words[:10]]
            activity['required_words'] = required_words_kannada
        
        return {
            "activity": activity,
            "words_used": words_used_data,
            "api_details": {
                "endpoint": f"POST /api/activity/speaking/{language}",
                "prompt": activity.get("_prompt", ""),
                "words": activity.get("_words", []),
                "response_time": activity.get("_response_time", 0),
                "raw_response": activity.get("_raw_response", ""),
                "learned_words": activity.get("_learned_words", []),
                "learning_words": activity.get("_required_learning_words", []),
                "token_info": token_info,
                "parse_error": activity.get("_parse_error"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in create_speaking_activity: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating activity: {str(e)}")


@app.post("/api/activity/translation/{language}")
async def create_translation_activity(language: str, request: Request):
    """Generate a translation activity with sentences from other languages the user is learning"""
    try:
        # Parse topic from request body (handle empty body gracefully)
        body = {}
        try:
            if request.headers.get('content-type') == 'application/json':
                body = await request.json()
        except json.JSONDecodeError:
            print("[Translation Activity] No valid JSON body provided, will use random topic")
            pass
        
        custom_topic = body.get('topic') if body else None
        
        # Get user's CEFR level for target language
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        # Get all active languages user is learning
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        # Get other languages user is learning (not the target language)
        cursor.execute('''
            SELECT DISTINCT language FROM vocabulary
            WHERE language != ?
            GROUP BY language
            HAVING COUNT(*) > 0
        ''', (language,))
        
        other_languages = [row[0] for row in cursor.fetchall()]
        
        # Get CEFR levels for other languages
        other_language_levels = {}
        for other_lang in other_languages:
            level_info = db.calculate_user_level(other_lang)
            other_language_levels[other_lang] = level_info.get('level', 'A1')
        
        conn.close()
        
        print(f"Generating translation activity for {language} (level: {user_cefr_level})")
        print(f"Other languages: {other_language_levels}")
        
        # Determine number of sentences (15-30)
        import random
        num_sentences = random.randint(15, 30)
        
        # Decide how many sentences from each language
        # If target language is much higher level (2+ levels), include English
        use_english = False
        if other_languages:
            max_other_level = max([db._cefr_to_numeric(lvl) for lvl in other_language_levels.values()])
            target_level_numeric = db._cefr_to_numeric(user_cefr_level)
            if target_level_numeric - max_other_level >= 2:
                use_english = True
                other_languages.append('english')
                other_language_levels['english'] = user_cefr_level
        
        # If no other languages, use English
        if not other_languages:
            other_languages = ['english']
            other_language_levels['english'] = user_cefr_level
        
        # Distribute sentences across languages
        sentences_per_language = {}
        remaining_sentences = num_sentences
        for i, lang in enumerate(other_languages):
            if i == len(other_languages) - 1:
                sentences_per_language[lang] = remaining_sentences
            else:
                count = random.randint(max(1, num_sentences // len(other_languages) - 3), 
                                      num_sentences // len(other_languages) + 3)
                count = min(count, remaining_sentences - (len(other_languages) - i - 1))
                sentences_per_language[lang] = count
                remaining_sentences -= count
        
        print(f"Sentence distribution: {sentences_per_language}")
        
        # Generate translation activity
        activity = api_client.generate_translation_activity(
            target_language=language,
            target_level=user_cefr_level,
            source_languages=other_languages,
            source_language_levels=other_language_levels,
            sentences_per_language=sentences_per_language,
            custom_topic=custom_topic
        )
        
        if not activity:
            raise HTTPException(status_code=500, detail="Failed to generate translation activity")
        
        # Check for errors in activity
        if activity.get('_error'):
            error_detail = activity.get('_error', 'Unknown error')
            error_type = activity.get('_error_type', 'unknown')
            print(f"⚠️ Activity generation error: {error_type} - {error_detail}")
            raise HTTPException(
                status_code=500, 
                detail=f"Error creating translation activity: {error_type}: {error_detail}"
            )
        
        # Save activity immediately after generation (before user completes it)
        # This allows it to be reopened from history
        activity_data_json = json.dumps(activity)
        activity_id = db.log_activity(
            language,
            'translation',
            0.0,  # Score is 0 until completed
            activity_data_json
        )
        if activity_id:
            print(f"✓ Translation activity saved with ID: {activity_id}")
            activity['activity_id'] = activity_id
        print(f"✓ Translation activity saved immediately after generation for {language}")
        
        # Extract words from sentences for dictionary population
        words_used_data = []
        all_text = activity.get('activity_name', '') + ' ' + activity.get('instructions', '')
        
        # Add text from all sentences (both source and expected translation)
        if activity.get('sentences'):
            for sentence in activity['sentences']:
                if sentence.get('text'):
                    all_text += ' ' + sentence['text']
                if sentence.get('expected_translation'):
                    all_text += ' ' + sentence['expected_translation']
        
        # Get word bank for extraction
        word_bank_words = db.get_words_for_activity(language, learned_limit=200, learning_limit=50)
        if word_bank_words:
            words_used_from_text = api_client.extract_words_from_text(all_text, word_bank_words)
            
            for w in words_used_from_text:
                words_used_data.append({
                    "id": w.get("id", 0),
                    "word": w.get("english_word", ""),
                    "kannada": w.get("translation", ""),
                    "transliteration": w.get("transliteration", ""),
                    "word_class": w.get("word_class", ""),
                    "level": w.get("level", ""),
                    "mastery_level": w.get("mastery_level", "new"),
                    "verb_transitivity": w.get("verb_transitivity", ""),
                })
        
        activity['_words_used_data'] = words_used_data
        
        return {
            "activity": activity,
            "words_used": words_used_data,
            "api_details": {
                "endpoint": f"POST /api/activity/translation/{language}",
                "prompt": activity.get("_prompt", ""),
                "response_time": activity.get("_response_time", 0),
                "raw_response": activity.get("_raw_response", ""),
                "source_languages": other_languages,
                "source_levels": other_language_levels,
                "sentences_distribution": sentences_per_language,
                "parse_error": activity.get("_parse_error"),
                "error": activity.get("_error"),
                "error_type": activity.get("_error_type"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in create_translation_activity: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating activity: {str(e)}")


@app.post("/api/activity/writing/{language}")
async def create_writing_activity(language: str, request: Request):
    """Generate a writing activity with detailed prompt and criteria"""
    try:
        # Parse topic from request body (handle empty body gracefully)
        body = {}
        try:
            if request.headers.get('content-type') == 'application/json':
                body = await request.json()
        except json.JSONDecodeError:
            # Empty or invalid JSON body - that's okay, we'll use random topic
            print("[Writing Activity] No valid JSON body provided, will use random topic")
            pass
        
        custom_topic = body.get('topic') if body else None
        
        # Get user interests if random topic
        user_interests = []
        if custom_topic is None:
            try:
                conn = sqlite3.connect(config.DB_PATH)
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT value FROM user_preferences
                    WHERE user_id = 1 AND key = 'selected_interests'
                ''')
                row = cursor.fetchone()
                if row and row[0]:
                    user_interests = json.loads(row[0])
                conn.close()
            except Exception as e:
                print(f"Error fetching user interests: {e}")
        
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        # Get 200-300 words for the comprehensive word bank
        word_bank_words = db.get_words_for_activity(language, learned_limit=200, learning_limit=50)
        if not word_bank_words:
            raise HTTPException(status_code=404, detail="No words available for activity")
        
        # Select required words: mostly learning words (7-8) + some learned words (2-3) = 10 total
        import random
        random.shuffle(word_bank_words)  # Shuffle for randomness
        
        learning_words = [w for w in word_bank_words if w.get('mastery_level') in ['learning', 'review']]
        learned_words = [w for w in word_bank_words if w.get('mastery_level') == 'mastered']
        
        # If no learning words, use new words as fallback
        if not learning_words:
            learning_words = [w for w in word_bank_words if w.get('mastery_level') not in ['mastered', 'learning', 'review']]
        
        # Randomly select 7-8 learning words (mostly)
        num_learning = min(random.randint(7, 8), len(learning_words))
        selected_learning = random.sample(learning_words, num_learning) if learning_words else []
        
        # Randomly select 2-3 learned words (some)
        num_learned = min(10 - len(selected_learning), len(learned_words))
        selected_learned = random.sample(learned_words, num_learned) if learned_words and num_learned > 0 else []
        
        # Combine and shuffle to randomize order
        required_learning_words = selected_learning + selected_learned
        random.shuffle(required_learning_words)
        
        # Ensure we have at least some words (fallback if needed)
        if len(required_learning_words) < 5:
            # Add more words from any available
            remaining = [w for w in word_bank_words if w not in required_learning_words]
            needed = 10 - len(required_learning_words)
            required_learning_words.extend(random.sample(remaining, min(needed, len(remaining))))
        
        print(f"Generating writing activity for {language} with {len(word_bank_words)} words...")
        print(f"User CEFR level: {user_cefr_level}")
        print(f"Selected {len(selected_learning)} learning words + {len(selected_learned)} learned words = {len(required_learning_words)} total required words")
        print(f"Required words: {[w.get('english_word') for w in required_learning_words]}")
        
        activity = api_client.generate_writing_activity(
            word_bank_words, 
            language, 
            required_learning_words=required_learning_words, 
            user_cefr_level=user_cefr_level,
            custom_topic=custom_topic,
            user_interests=user_interests
        )
        
        if not activity:
            raise HTTPException(status_code=500, detail="Failed to generate activity")
        
        # Check for errors in activity and log them (but still return activity with error info for debug logs)
        if activity.get('_error'):
            error_detail = activity.get('_error', 'Unknown error')
            error_type = activity.get('_error_type', 'unknown')
            print(f"⚠️ Activity generation error: {error_type} - {error_detail}")
            print(f"Raw response preview: {activity.get('_raw_response', '')[:500]}")
            # Still return the activity so error can be viewed in debug logs
            # But raise HTTPException with detailed error info
            raise HTTPException(
                status_code=500, 
                detail=f"Error creating writing activity: {error_type}: {error_detail}"
            )
        
        # Save activity immediately after generation
        activity_data_json = json.dumps(activity)
        activity_id = db.log_activity(
            language,
            'writing',
            0.0,
            activity_data_json
        )
        if activity_id:
            activity['activity_id'] = activity_id
        print(f"✓ Activity saved immediately after generation for {language} (id={activity_id})")
        
        # Get words used from required words, writing prompt, and activity name
        words_used_data = []
        required_words = activity.get('required_words', [])
        writing_prompt = activity.get('writing_prompt', '')
        activity_name = activity.get('activity_name', '')
        
        # Add required words
        for kannada_word in required_words:
            db_words, _ = db.get_vocabulary(language, search=kannada_word, limit=1, offset=0)
            if db_words:
                w = db_words[0]
                words_used_data.append({
                    "id": w.get("id", 0),
                    "word": w.get("english_word", ""),
                    "kannada": w.get("translation", ""),
                    "transliteration": w.get("transliteration", ""),
                    "word_class": w.get("word_class", ""),
                    "level": w.get("level", ""),
                    "mastery_level": w.get("mastery_level", "new"),  # Ensure mastery_level is included
                    "verb_transitivity": w.get("verb_transitivity", ""),
                })
        
        # Extract words from writing prompt and activity name
        import re
        combined_text = writing_prompt
        if activity_name:
            combined_text += ' ' + activity_name
        
        if combined_text:
            kannada_words = re.findall(r'[\u0C80-\u0CFF]+', combined_text)
            unique_words = list(set(kannada_words))
            unique_words.sort(key=len, reverse=True)
            
            matched_word_ids = {w.get('id') for w in words_used_data}
            
            for kannada_word in unique_words[:50]:  # Limit to avoid too many
                db_words, _ = db.get_vocabulary(language, search=kannada_word, limit=5, offset=0)
                if db_words:
                    for w in db_words:
                        if w.get('id') not in matched_word_ids:
                            word_kannada = w.get('translation', '').strip()
                            word_variants = word_kannada.split(' /')
                            for variant in word_variants:
                                variant = variant.strip()
                                if kannada_word == variant or kannada_word in variant or variant in kannada_word:
                                    words_used_data.append({
                                        "id": w.get("id", 0),
                                        "word": w.get("english_word", ""),
                                        "kannada": w.get("translation", ""),
                                        "transliteration": w.get("transliteration", ""),
                                        "word_class": w.get("word_class", ""),
                                        "level": w.get("level", ""),
                                        "mastery_level": w.get("mastery_level", "new"),  # Ensure mastery_level is included
                                        "verb_transitivity": w.get("verb_transitivity", ""),
                                    })
                                    matched_word_ids.add(w.get('id'))
                                    break
                            if w.get('id') in matched_word_ids:
                                break
        
        # Store words_used_data in activity for reopening
        activity['_words_used_data'] = words_used_data
        
        token_info = activity.get("_token_info", {})
        
        # Calculate total cost from token info
        total_cost = token_info.get('total_cost', 0.0)
        
        return {
            "activity": activity,
            "words_used": words_used_data,
            "api_details": {
                "endpoint": f"POST /api/activity/writing/{language}",
                "prompt": activity.get("_prompt", ""),
                "learned_words": activity.get("_learned_words", []),
                "required_learning_words": activity.get("_required_learning_words", []),
                "response_time": activity.get("_response_time", 0),
                "raw_response": activity.get("_raw_response", ""),
                "token_info": token_info,
                "input_cost": token_info.get('input_cost', 0.0),
                "output_cost": token_info.get('output_cost', 0.0),
                "total_cost": total_cost,
                "parse_error": activity.get("_parse_error"),
                "error": activity.get("_error"),
                "error_type": activity.get("_error_type"),
                "debug_steps": activity.get("_debug_steps", []),
            }
        }
    except Exception as e:
        print(f"Error creating writing activity: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error creating writing activity: {str(e)}")


@app.post("/api/activity/writing/{language}/grade")
def grade_writing_activity(language: str, request: WritingGradingRequest):
    """Grade a writing activity using Gemini 2.5 Flash"""
    try:
        # Validate required fields
        if not request.user_text or not request.user_text.strip():
            raise HTTPException(status_code=400, detail="User text is required")
        if not request.writing_prompt or not request.writing_prompt.strip():
            raise HTTPException(status_code=400, detail="Writing prompt is required")
        if not request.required_words or len(request.required_words) == 0:
            raise HTTPException(status_code=400, detail="Required words list cannot be empty")
        
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        # Ensure evaluation_criteria is not empty
        evaluation_criteria = request.evaluation_criteria or ""
        if not evaluation_criteria.strip():
            # Fallback to default criteria if empty
            evaluation_criteria = """ನೀಡಲಾದ ಎಲ್ಲಾ ಅನಿವಾರ್ಯ ಪದಗಳನ್ನು ಬಳಸಬೇಕು ಮತ್ತು ಸಾಧ್ಯವಾದಷ್ಟು ಕಲಿತ ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಪದಗಳನ್ನು ಸಹೃದಯವಾಗಿ ಬಳಸಬೇಕು.
ವ್ಯಾಕರಣದ ನಿಖರತೆ, ಪದಗಳ ಸರಿಯಾದ ಬಳಕೆ, ಮತ್ತು ಸ್ಪಷ್ಟತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಬೇಕು.
ಲೇಖನವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು."""
        
        grading_result = api_client.grade_writing_activity(
            user_text=request.user_text,
            writing_prompt=request.writing_prompt,
            required_words=request.required_words,
            evaluation_criteria=evaluation_criteria,
            language=language,
            learned_words=request.learned_words or [],
            learning_words=request.learning_words or [],
            user_cefr_level=user_cefr_level
        )
        
        if grading_result is None:
            raise HTTPException(
                status_code=500, 
                detail="Failed to grade writing activity: API returned no result. Check backend logs for details."
            )
        
        # Check if there's an error (API error or parse error)
        if grading_result.get("_error") or grading_result.get("_parse_error"):
            # Return error response with details for debugging
            token_info = grading_result.get("_token_info", {}) or {}
            error_msg = grading_result.get("_error", "Parse error")
            parse_error = grading_result.get("_parse_error")
            return {
                "score": 0,
                "vocabulary_score": 0,
                "grammar_score": 0,
                "coherence_score": 0,
                "feedback": f"Error: {error_msg if error_msg else 'Failed to parse grading response'}. Please check debug modal for details.",
                "required_words_feedback": {},
                "api_details": {
                    "endpoint": f"POST /api/activity/writing/{language}/grade",
                    "prompt": grading_result.get("_prompt", ""),
                    "response_time": grading_result.get("_response_time", 0),
                    "raw_response": grading_result.get("_raw_response", ""),
                    "token_info": token_info,
                    "input_cost": token_info.get('input_cost', 0.0) if token_info else 0.0,
                    "output_cost": token_info.get('output_cost', 0.0) if token_info else 0.0,
                    "total_cost": token_info.get('total_cost', 0.0) if token_info else 0.0,
                    "parse_error": parse_error,
                    "error": error_msg,
                    "error_type": grading_result.get("_error_type"),
                }
            }
        
        # Validate that we have the required fields in the result
        if not isinstance(grading_result, dict):
            raise HTTPException(
                status_code=500,
                detail=f"Invalid grading result format: expected dict, got {type(grading_result).__name__}"
            )
        
        token_info = grading_result.get("_token_info", {}) or {}
        
        # Calculate total cost from token info
        total_cost = token_info.get('total_cost', 0.0)
        
        return {
            "score": grading_result.get("score", 0),
            "vocabulary_score": grading_result.get("vocabulary_score", 0),
            "grammar_score": grading_result.get("grammar_score", 0),
            "coherence_score": grading_result.get("coherence_score", 0),
            "feedback": grading_result.get("feedback", ""),
            "required_words_feedback": grading_result.get("required_words_feedback", {}),
            "api_details": {
                "endpoint": f"POST /api/activity/writing/{language}/grade",
                "prompt": grading_result.get("_prompt", ""),
                "response_time": grading_result.get("_response_time", 0),
                "raw_response": grading_result.get("_raw_response", ""),
                "token_info": token_info,
                "input_cost": token_info.get('input_cost', 0.0) if token_info else 0.0,
                "output_cost": token_info.get('output_cost', 0.0) if token_info else 0.0,
                "total_cost": total_cost,
                "parse_error": grading_result.get("_parse_error"),
            }
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"Error grading writing activity: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error grading writing activity: {str(e)}")


@app.post("/api/activity/speaking/{language}/grade")
def grade_speaking_activity(language: str, request: SpeakingGradingRequest):
    """Grade a speaking activity using Gemini 2.0 Flash with audio input"""
    import base64
    
    try:
        # Validate required fields
        if not request.audio_base64 or not request.audio_base64.strip():
            raise HTTPException(status_code=400, detail="Audio data is required")
        if not request.speaking_topic or not request.speaking_topic.strip():
            raise HTTPException(status_code=400, detail="Speaking topic is required")
        if not request.tasks or len(request.tasks) == 0:
            raise HTTPException(status_code=400, detail="Tasks list cannot be empty")
        if not request.required_words or len(request.required_words) == 0:
            raise HTTPException(status_code=400, detail="Required words list cannot be empty")
        
        # Decode audio
        try:
            audio_bytes = base64.b64decode(request.audio_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 audio data: {str(e)}")
        
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        grading_result = api_client.grade_speaking_activity_with_audio(
            audio_data=audio_bytes,
            audio_format=request.audio_format,
            speaking_topic=request.speaking_topic,
            tasks=request.tasks,
            required_words=request.required_words,
            language=language,
            learned_words=request.learned_words or [],
            learning_words=request.learning_words or [],
            user_cefr_level=user_cefr_level
        )
        
        if grading_result is None:
            raise HTTPException(
                status_code=500, 
                detail="Failed to grade speaking activity: API returned no result. Check backend logs for details."
            )
        
        # Debug logging
        print(f"[DEBUG] grading_result keys: {grading_result.keys()}")
        print(f"[DEBUG] _error value: {grading_result.get('_error')}")
        print(f"[DEBUG] _parse_error value: {grading_result.get('_parse_error')}")
        print(f"[DEBUG] score: {grading_result.get('score')}")
        print(f"[DEBUG] feedback preview: {grading_result.get('feedback', '')[:200]}")
        
        # Check if there's an error (API error or parse error)
        if grading_result.get("_error") or grading_result.get("_parse_error"):
            token_info = grading_result.get("_token_info", {}) or {}
            error_msg = grading_result.get("_error", "Parse error")
            parse_error = grading_result.get("_parse_error")
            return {
                "score": 0,
                "vocabulary_score": 0,
                "grammar_score": 0,
                "fluency_score": 0,
                "task_completion_score": 0,
                "feedback": f"Error: {error_msg if error_msg else 'Failed to parse grading response'}. Please check debug modal for details.",
                "required_words_feedback": {},
                "tasks_feedback": {},
                "api_details": {
                    "endpoint": f"POST /api/activity/speaking/{language}/grade",
                    "prompt": grading_result.get("_prompt", ""),
                    "response_time": grading_result.get("_response_time", 0),
                    "raw_response": grading_result.get("_raw_response", ""),
                    "token_info": token_info,
                    "input_cost": token_info.get('input_cost', 0.0) if token_info else 0.0,
                    "output_cost": token_info.get('output_cost', 0.0) if token_info else 0.0,
                    "total_cost": token_info.get('total_cost', 0.0) if token_info else 0.0,
                    "parse_error": parse_error,
                    "error": error_msg,
                    "error_type": grading_result.get("_error_type"),
                }
            }
        
        # Validate that we have the required fields in the result
        if not isinstance(grading_result, dict):
            raise HTTPException(
                status_code=500,
                detail=f"Invalid grading result format: expected dict, got {type(grading_result).__name__}"
            )
        
        token_info = grading_result.get("_token_info", {}) or {}
        total_cost = token_info.get('total_cost', 0.0)
        
        return {
            "user_transcript": grading_result.get("user_transcript", ""),  # Transcript from Gemini
            "score": grading_result.get("score", 0),
            "vocabulary_score": grading_result.get("vocabulary_score", 0),
            "grammar_score": grading_result.get("grammar_score", 0),
            "fluency_score": grading_result.get("fluency_score", 0),
            "task_completion_score": grading_result.get("task_completion_score", 0),
            "feedback": grading_result.get("feedback", ""),
            "required_words_feedback": grading_result.get("required_words_feedback", {}),
            "tasks_feedback": grading_result.get("tasks_feedback", {}),
            "api_details": {
                "endpoint": f"POST /api/activity/speaking/{language}/grade",
                "prompt": grading_result.get("_prompt", ""),
                "response_time": grading_result.get("_response_time", 0),
                "raw_response": grading_result.get("_raw_response", ""),
                "token_info": token_info,
                "input_cost": token_info.get('input_cost', 0.0) if token_info else 0.0,
                "output_cost": token_info.get('output_cost', 0.0) if token_info else 0.0,
                "total_cost": total_cost,
                "parse_error": grading_result.get("_parse_error"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in grade_speaking_activity: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error grading speaking activity: {str(e)}")


@app.post("/api/activity/translation/{language}/grade")
def grade_translation_activity(language: str, request: TranslationGradingRequest):
    """Grade a translation activity using Gemini 2.5 Flash"""
    try:
        # Validate required fields
        if not request.translations or len(request.translations) == 0:
            raise HTTPException(status_code=400, detail="Translations list cannot be empty")
        
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        grading_result = api_client.grade_translation_activity(
            translations=request.translations,
            target_language=language,
            user_cefr_level=user_cefr_level
        )
        
        if grading_result is None:
            raise HTTPException(
                status_code=500, 
                detail="Failed to grade translation activity: API returned no result. Check backend logs for details."
            )
        
        # Check if there's an error (API error or parse error)
        if grading_result.get("_error") or grading_result.get("_parse_error"):
            # Return error response with details for debugging
            token_info = grading_result.get("_token_info", {}) or {}
            error_msg = grading_result.get("_error", "Parse error")
            parse_error = grading_result.get("_parse_error")
            return {
                "overall_score": 0,
                "scores": {},
                "feedback": f"Error: {error_msg if error_msg else 'Failed to parse grading response'}. Please check debug modal for details.",
                "sentence_feedback": [],
                "api_details": {
                    "endpoint": f"POST /api/activity/translation/{language}/grade",
                    "prompt": grading_result.get("_prompt", ""),
                    "response_time": grading_result.get("_response_time", 0),
                    "raw_response": grading_result.get("_raw_response", ""),
                    "token_info": token_info,
                    "input_cost": token_info.get('input_cost', 0.0) if token_info else 0.0,
                    "output_cost": token_info.get('output_cost', 0.0) if token_info else 0.0,
                    "total_cost": token_info.get('total_cost', 0.0) if token_info else 0.0,
                    "parse_error": parse_error,
                    "error": error_msg,
                    "error_type": grading_result.get("_error_type"),
                }
            }
        
        # Validate that we have the required fields in the result
        if not isinstance(grading_result, dict):
            raise HTTPException(
                status_code=500,
                detail=f"Invalid grading result format: expected dict, got {type(grading_result).__name__}"
            )
        
        token_info = grading_result.get("_token_info", {}) or {}
        
        # Calculate total cost from token info
        total_cost = token_info.get('total_cost', 0.0)
        
        return {
            "overall_score": grading_result.get("overall_score", 0),
            "scores": grading_result.get("scores", {}),
            "feedback": grading_result.get("feedback", ""),
            "sentence_feedback": grading_result.get("sentence_feedback", []),
            "api_details": {
                "endpoint": f"POST /api/activity/translation/{language}/grade",
                "prompt": grading_result.get("_prompt", ""),
                "response_time": grading_result.get("_response_time", 0),
                "raw_response": grading_result.get("_raw_response", ""),
                "token_info": token_info,
                "input_cost": token_info.get('input_cost', 0.0) if token_info else 0.0,
                "output_cost": token_info.get('output_cost', 0.0) if token_info else 0.0,
                "total_cost": total_cost,
                "parse_error": grading_result.get("_parse_error"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in grade_translation_activity: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error grading translation activity: {str(e)}")


@app.post("/api/activity/conversation/{language}/intro-audio")
def generate_intro_audio(language: str, request: Dict):
    """Generate TTS audio for conversation introduction"""
    try:
        introduction = request.get('introduction')
        voice = request.get('voice')
        region = request.get('region')
        formality = request.get('formality')
        
        if not introduction or not voice:
            raise HTTPException(status_code=400, detail="Introduction and voice required")
        
        # Generate TTS
        from api_client import generate_tts, generate_tts_style_instruction
        audio_data, _, _ = generate_tts(
            introduction,
            language='kn-IN',
            voice=voice,
            style_instruction=generate_tts_style_instruction(
                introduction,
                '',
                selected_region=region,
                formality_choice=formality
            )
        )
        
        return {
            "audio_data": audio_data,
        }
    except Exception as e:
        print(f"Error generating intro audio: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating intro audio: {str(e)}")


@app.post("/api/activity/listening/{language}/audio")
def get_listening_audio(language: str, request: Dict):
    """Get audio for a specific paragraph - receives base64 audio data and returns it as MP3"""
    try:
        import base64
        
        audio_base64 = request.get('audio_base64')
        if not audio_base64:
            raise HTTPException(status_code=400, detail="No audio data provided")
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_base64)
        
        # Return audio as MP3
        from fastapi.responses import Response
        return Response(
            content=audio_bytes,
            media_type='audio/mpeg',
            headers={
                'Content-Disposition': 'inline; filename="audio.mp3"',
                'Cache-Control': 'no-cache',
            }
        )
    except Exception as e:
        print(f"Error getting audio: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error getting audio: {str(e)}")


@app.post("/api/activity/conversation/{language}/create")
async def create_conversation_activity(language: str, request: Request):
    """Create a new conversation activity with automatically selected topic and tasks"""
    try:
        # Parse topic from request body (handle empty body gracefully)
        body = {}
        try:
            if request.headers.get('content-type') == 'application/json':
                body = await request.json()
        except json.JSONDecodeError:
            # Empty or invalid JSON body - that's okay, we'll use random topic
            print("[Conversation Activity] No valid JSON body provided, will use random topic")
            pass
        
        custom_topic = body.get('topic') if body else None
        
        # Get user interests if random topic
        user_interests = []
        if custom_topic is None:
            try:
                conn = sqlite3.connect(config.DB_PATH)
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT value FROM user_preferences
                    WHERE user_id = 1 AND key = 'selected_interests'
                ''')
                row = cursor.fetchone()
                if row and row[0]:
                    user_interests = json.loads(row[0])
                conn.close()
            except Exception as e:
                print(f"Error fetching user interests: {e}")
        
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        # Get known/learning words for grounding
        learning_words, _ = db.get_vocabulary(language, mastery_filter='learning')
        review_words, _ = db.get_vocabulary(language, mastery_filter='review')
        mastered_words, _ = db.get_vocabulary(language, mastery_filter='mastered')
        words = list(learning_words)
        words.extend(list(review_words))
        words.extend(list(mastered_words[:50]))
        
        # Generate conversation activity (topic is randomly selected inside)
        activity = api_client.generate_conversation_activity(
            words[:30],
            language,
            user_cefr_level=user_cefr_level,
            custom_topic=custom_topic,
            user_interests=user_interests
        )
        
        if not activity or activity.get('_error'):
            error_detail = activity.get('_error', 'Unknown error') if activity else 'Failed to generate activity'
            raise HTTPException(status_code=500, detail=f"Error creating conversation activity: {error_detail}")
        
        # Extract words used from introduction and tasks
        all_text = activity.get('introduction', '') + ' ' + ' '.join(activity.get('tasks', []))
        words_used_from_text = api_client.extract_words_from_text(all_text, words)
        
        words_used_data = [
            {
                "id": w.get("id", 0),
                "word": w.get("english_word", ""),
                "kannada": w.get("translation", ""),
                "transliteration": w.get("transliteration", ""),
                "word_class": w.get("word_class", ""),
                "level": w.get("level", ""),
                "mastery_level": w.get("mastery_level", "new"),
                "verb_transitivity": w.get("verb_transitivity", ""),
            }
            for w in words_used_from_text
        ]
        
        activity['_words_used_data'] = words_used_data
        
        # Save activity immediately
        activity_data_json = json.dumps(activity)
        activity_id = db.log_activity(
            language,
            'conversation',
            0.0,
            activity_data_json
        )
        conversation_id = activity_id
        
        # Embed IDs back into the activity and re-save so history reopening works
        if conversation_id:
            activity['conversation_id'] = conversation_id
            activity['activity_id'] = conversation_id
            activity_data_json = json.dumps(activity)
            conn = sqlite3.connect(config.DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE activity_history SET activity_data = ? WHERE id = ?',
                (activity_data_json, conversation_id)
            )
            conn.commit()
            conn.close()
        
        token_info = activity.get("_token_info", {})
        return {
            "activity": activity,
            "conversation_id": conversation_id,
            "words_used": words_used_data,
            "api_details": {
                "endpoint": f"POST /api/activity/conversation/{language}/create",
                "prompt": activity.get("_prompt", ""),
                "response_time": activity.get("_response_time", 0),
                "raw_response": activity.get("_raw_response", ""),
                "token_info": token_info,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in create_conversation_activity: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error creating conversation activity: {str(e)}")


@app.post("/api/activity/conversation/{language}/rate")
def rate_conversation(language: str, request: ConversationRatingRequest):
    """Rate conversation performance after tasks are completed"""
    try:
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        # Load conversation activity data
        import sqlite3
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('''
            SELECT activity_data FROM activity_history
            WHERE user_id = 1 AND language = ? AND activity_type = 'conversation'
            AND id = ?
        ''', (language, request.conversation_id))
        row = cursor.fetchone()
        conn.close()
        
        if not row or not row['activity_data']:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        activity_data = json.loads(row['activity_data'])
        tasks = activity_data.get('tasks', [])
        topic = activity_data.get('_topic', '')
        words_used_data = activity_data.get('_words_used_data', [])
        
        # Get learned and learning words
        learned_words = [w for w in words_used_data if w.get('mastery_level') == 'mastered']
        learning_words = [w for w in words_used_data if w.get('mastery_level') in ['learning', 'review']]
        
        # Rate conversation
        rating_result = api_client.rate_conversation_performance(
            request.conversation_transcript,
            tasks,
            topic,
            words_used_data,
            language,
            learned_words=learned_words,
            learning_words=learning_words,
            user_cefr_level=user_cefr_level
        )
        
        if rating_result.get('_error'):
            raise HTTPException(status_code=500, detail=f"Error rating conversation: {rating_result.get('_error')}")
        
        # Update activity data with rating (append to ratings array)
        if 'ratings' not in activity_data:
            activity_data['ratings'] = []
        rating_with_meta = {
            **rating_result,
            'submitted_at': config.get_current_time().isoformat()
        }
        activity_data['ratings'].append(rating_with_meta)
        activity_data['rating'] = rating_result  # Keep for backward compatibility
        activity_data['rated_at'] = config.get_current_time().isoformat()
        # Ensure messages are preserved (don't overwrite them)
        if 'messages' not in activity_data:
            activity_data['messages'] = []
        
        # Save updated activity data
        db.update_activity_score(
            language,
            'conversation',
            rating_result.get('score', 0) / 100.0,  # Convert to 0-1 range
            json.dumps(activity_data)
        )
        
        return {
            **rating_result,
            "api_details": {
                "endpoint": f"POST /api/activity/conversation/{language}/rate",
                "prompt": rating_result.get("_prompt", ""),
                "response_time": rating_result.get("_response_time", 0),
                "raw_response": rating_result.get("_raw_response", ""),
                "token_info": rating_result.get("_token_info", {}),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in rate_conversation: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error rating conversation: {str(e)}")


@app.post("/api/activity/conversation/{language}")
def create_conversation_response(language: str, request: ConversationRequest):
    """Generate a conversation response from AI tutor"""
    
    # Get user's CEFR level
    user_level_info = db.calculate_user_level(language)
    user_cefr_level = user_level_info.get('level', 'A1')
    
    # Get known/learning words for grounding
    learning_words, _ = db.get_vocabulary(language, mastery_filter='learning')
    review_words, _ = db.get_vocabulary(language, mastery_filter='review')
    words = list(learning_words)
    words.extend(list(review_words))
    
    # Load conversation activity data if continuing an existing conversation
    conversation_history = []
    conversation_id = request.conversation_id
    voice = request.voice
    tasks = None
    topic = None
    # Initialize speaker profile variables (will be set from activity_data if available)
    speaker_profile_from_activity = None
    selected_region_from_activity = None
    formality_choice_from_activity = None
    
    if conversation_id:
        # Load conversation from activity_history
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT activity_data FROM activity_history
            WHERE user_id = 1 AND language = ? AND activity_type = 'conversation'
            AND id = ?
        ''', (language, conversation_id))
        
        row = cursor.fetchone()
        conn.close()
        
        if row and row['activity_data']:
            try:
                activity_data_raw = row['activity_data']
                # Handle case where activity_data might already be parsed or is a string
                if isinstance(activity_data_raw, str):
                    activity_data = json.loads(activity_data_raw)
                elif isinstance(activity_data_raw, dict):
                    activity_data = activity_data_raw
                else:
                    # If it's not a string or dict, it's invalid - skip loading conversation
                    print(f"Warning: activity_data is not a valid type: {type(activity_data_raw)}")
                    activity_data = {}
                
                # Ensure activity_data is a dict before accessing
                if isinstance(activity_data, dict):
                    conversation_history = activity_data.get('messages', [])
                    tasks = activity_data.get('tasks', [])
                    topic = activity_data.get('_topic')
                    # Get voice, region, formality, and speaker profile from activity data FIRST
                    # These should be consistent across all messages
                    if not voice:
                        voice = activity_data.get('_voice_used')
                        if not voice and conversation_history:
                            first_msg = conversation_history[0]
                            if isinstance(first_msg, dict):
                                voice = first_msg.get('_voice_used')
                    
                    # Get speaker profile from activity data (preferred) or first message
                    # This ensures consistency - the speaker profile shown in UI matches what AI uses
                    speaker_profile_from_activity = activity_data.get('_speaker_profile')
                    selected_region_from_activity = activity_data.get('_selected_region')
                    formality_choice_from_activity = activity_data.get('_formality_choice')
                    
                    # Debug: Log speaker profile source
                    if speaker_profile_from_activity:
                        print(f"[DEBUG] Using speaker profile from activity_data: {speaker_profile_from_activity.get('name', 'N/A')}")
                    
                    # If we don't have activity-level speaker profile, try to get from first message
                    if not speaker_profile_from_activity and conversation_history:
                        first_msg = conversation_history[0]
                        if isinstance(first_msg, dict):
                            speaker_profile_from_activity = first_msg.get('_speaker_profile')
                            if not selected_region_from_activity:
                                selected_region_from_activity = first_msg.get('_selected_region')
                            if not formality_choice_from_activity:
                                formality_choice_from_activity = first_msg.get('_formality_choice')
                            if speaker_profile_from_activity:
                                print(f"[DEBUG] Using speaker profile from first message: {speaker_profile_from_activity.get('name', 'N/A')}")
                else:
                    print(f"Warning: activity_data is not a dict after parsing: {type(activity_data)}")
                    conversation_history = []
                    tasks = None
                    topic = None
            except (json.JSONDecodeError, TypeError, AttributeError) as e:
                print(f"Error parsing activity_data: {e}")
                conversation_history = []
                tasks = None
                topic = None
    
    # Generate response with error handling
    try:
        # Pass speaker profile, region, and formality from activity data to ensure consistency
        response = api_client.generate_conversation_response(
            request.message, 
            words[:20], 
            language, 
            user_cefr_level=user_cefr_level,
            voice=voice,
            conversation_history=conversation_history,
            tasks=tasks,
            topic=topic,
            speaker_profile=speaker_profile_from_activity if 'speaker_profile_from_activity' in locals() else None,
            selected_region=selected_region_from_activity if 'selected_region_from_activity' in locals() else None,
            formality_choice=formality_choice_from_activity if 'formality_choice_from_activity' in locals() else None
        )
        
        # Check if response is None
        if response is None:
            print(f"[ERROR] generate_conversation_response returned None")
            return {
                "response": "Sorry, I couldn't generate a response. Please try again.",
                "words_used": [],
                "conversation_id": conversation_id,
                "api_details": {
                    "endpoint": f"POST /api/activity/conversation/{language}",
                    "error": "generate_conversation_response returned None",
                    "error_type": "NoneResponse",
                }
            }
        
        # Check if response has an error
        if response.get("_error"):
            print(f"[ERROR] Conversation response error: {response.get('_error')}")
            # Return error response to frontend
            return {
                "response": response.get("response", "Sorry, I couldn't generate a response. Please try again."),
                "words_used": [],
                "conversation_id": conversation_id,
                "api_details": {
                    "endpoint": f"POST /api/activity/conversation/{language}",
                    "error": response.get("_error"),
                    "error_type": response.get("_error_type"),
                    "prompt": response.get("_prompt", ""),
                    "speaker_profile": response.get("_speaker_profile"),
                }
            }
    except Exception as e:
        print(f"[ERROR] Exception in create_conversation_response: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return error response instead of crashing
        return {
            "response": "Sorry, I couldn't generate a response. Please try again.",
            "words_used": [],
            "conversation_id": conversation_id,
            "api_details": {
                "endpoint": f"POST /api/activity/conversation/{language}",
                "error": str(e),
                "error_type": type(e).__name__,
            }
        }
    
    words_used_data = [
        {
            "id": w.get("id", 0),
            "word": w.get("english_word", ""),
            "kannada": w.get("translation", ""),
            "transliteration": w.get("transliteration", ""),
            "word_class": w.get("word_class", ""),
            "level": w.get("level", ""),
            "mastery_level": w.get("mastery_level", "new"),
            "verb_transitivity": w.get("verb_transitivity", ""),
        }
        for w in words[:20]
    ]
    
    # Add new message to conversation history
    audio_data = response.get("_audio_data")
    # Debug: Log audio data status
    if response.get("response"):
        has_audio = audio_data is not None and audio_data.get("audio_base64")
        print(f"[DEBUG] Saving message: has_audio={has_audio}, audio_data_type={type(audio_data)}, response_length={len(response.get('response', ''))}")
        if not has_audio:
            print(f"[DEBUG] Message missing audio - TTS error: {response.get('_tts_error', 'None')}")
    
    new_message = {
        "user_message": request.message,
        "ai_response": response.get("response", ""),
        "_voice_used": response.get("_voice_used"),
        "_selected_region": response.get("_selected_region"),
        "_formality_choice": response.get("_formality_choice"),
        "_audio_data": audio_data,  # Can be None if TTS failed
        "_speaker_profile": response.get("_speaker_profile"),
        "timestamp": config.get_current_time().isoformat(),
    }
    conversation_history.append(new_message)
    
    # Save conversation to activity_history (preserve existing activity data)
    existing_activity_data = {}
    if conversation_id:
        try:
            conn = sqlite3.connect(config.DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('''
                SELECT activity_data FROM activity_history
                WHERE user_id = 1 AND language = ? AND activity_type = 'conversation'
                AND id = ?
            ''', (language, conversation_id))
            row = cursor.fetchone()
            conn.close()
            if row and row['activity_data']:
                activity_data_raw = row['activity_data']
                # Handle case where activity_data might already be parsed or is a string
                if isinstance(activity_data_raw, str):
                    existing_activity_data = json.loads(activity_data_raw)
                elif isinstance(activity_data_raw, dict):
                    existing_activity_data = activity_data_raw
                else:
                    # If it's not a string or dict, it's invalid - use empty dict
                    print(f"Warning: existing_activity_data is not a valid type: {type(activity_data_raw)}")
                    existing_activity_data = {}
        except Exception as e:
            print(f"Error loading existing activity data: {e}")
            existing_activity_data = {}
    
    # Ensure existing_activity_data is a dict before unpacking
    if not isinstance(existing_activity_data, dict):
        existing_activity_data = {}
    
    # Merge new message with existing activity data
    # Preserve ratings if they exist
    ratings = existing_activity_data.get('ratings', [])
    if not ratings and existing_activity_data.get('rating'):
        # Convert single rating to array for backward compatibility
        ratings = [existing_activity_data.get('rating')]
    
    activity_data = {
        **existing_activity_data,  # Preserve existing fields (tasks, topic, etc.)
        "messages": conversation_history,
        "conversation_id": conversation_id,  # Store conversation_id in activity_data for reopening
        "_voice_used": response.get("_voice_used") or existing_activity_data.get("_voice_used"),
        "_selected_region": response.get("_selected_region") or existing_activity_data.get("_selected_region"),
        "_formality_choice": response.get("_formality_choice") or existing_activity_data.get("_formality_choice"),
        "_speaker_profile": response.get("_speaker_profile") or existing_activity_data.get("_speaker_profile"),
        "_words_used_data": words_used_data,
        "ratings": ratings,  # Preserve ratings
    }
    
    # Use conversation_id if continuing, otherwise create new entry
    if conversation_id:
        # Update existing conversation by ID
        try:
            conn = sqlite3.connect(config.DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE activity_history
                SET activity_data = ?, completed_at = CURRENT_TIMESTAMP
                WHERE user_id = 1 AND language = ? AND activity_type = 'conversation' AND id = ?
            ''', (json.dumps(activity_data), language, conversation_id))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error updating conversation {conversation_id}: {e}")
            # Fallback: create new entry if update fails
            db.log_activity(
                language,
                'conversation',
                json.dumps(activity_data),
                0.0
            )
            conn = sqlite3.connect(config.DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id FROM activity_history
                WHERE user_id = 1 AND language = ? AND activity_type = 'conversation'
                ORDER BY completed_at DESC LIMIT 1
            ''', (language,))
            row = cursor.fetchone()
            conn.close()
            conversation_id = row['id'] if row else conversation_id
    else:
        # Create new conversation entry
        db.log_activity(
            language,
            'conversation',
            json.dumps(activity_data),
            0.0
        )
        # Get the new conversation ID
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id FROM activity_history
            WHERE user_id = 1 AND language = ? AND activity_type = 'conversation'
            ORDER BY completed_at DESC LIMIT 1
        ''', (language,))
        row = cursor.fetchone()
        conn.close()
        conversation_id = row['id'] if row else None
    
    # Ensure response is not None before accessing it
    if response is None:
        print(f"[ERROR] Response from generate_conversation_response is None")
        return {
            "response": "Sorry, I couldn't generate a response. Please try again.",
            "words_used": [],
            "conversation_id": conversation_id,
            "api_details": {
                "endpoint": f"POST /api/activity/conversation/{language}",
                "error": "generate_conversation_response returned None",
                "error_type": "NoneResponse",
            }
        }
    
    token_info = response.get("_token_info", {})
    return {
        **response,
        "words_used": words_used_data,
        "conversation_id": conversation_id,
        "api_details": {
            "endpoint": f"POST /api/activity/conversation/{language}",
            "prompt": response.get("_prompt", ""),  # Full prompt sent to Gemini
            "speaker_profile_context": response.get("_speaker_profile_context", ""),  # Speaker profile context from prompt
            "speaker_profile": response.get("_speaker_profile"),  # Full speaker profile object
            "selected_region": response.get("_selected_region"),
            "formality_choice": response.get("_formality_choice"),
            "topic": topic,  # Topic from activity data
            "words": response.get("_words", []),
            "response_time": response.get("_response_time", 0),
            "raw_response": response.get("response", ""),  # AI's actual response
            "token_info": token_info,
            "parse_error": response.get("_parse_error"),
            "voice_used": response.get("_voice_used"),
            "tts_cost": response.get("_tts_cost", 0.0),
            "tts_response_time": response.get("_tts_response_time", 0.0),
            "tts_error": response.get("_tts_error"),  # TTS error message if any
        }
    }


# ============================================================================
# Activity Completion Endpoints
# ============================================================================

@app.post("/api/vocabulary/bulk-update-levels")
def bulk_update_levels():
    """Bulk update word states: A1 -> mastered, A2 -> learning"""
    try:
        # Set A1 words to mastered
        a1_result = db.bulk_update_word_states_by_level('kannada', 'A1', 'mastered')
        
        # Set A2 words to learning
        a2_result = db.bulk_update_word_states_by_level('kannada', 'A2', 'learning')
        
        return {
            "success": True,
            "a1_updated": a1_result["updated"],
            "a2_updated": a2_result["updated"]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/activity/complete")
def complete_activity(completion: ActivityCompletion):
    """Complete an activity and update word states via SRS"""
    try:
        # Update word states
        for word_update in completion.word_updates:
            db.update_word_state(
                word_update.word_id,
                user_id=1,
                correct=word_update.correct
            )
        
        # Update existing activity entry with score (activity was already saved on generation)
        activity_data_json = json.dumps(completion.activity_data) if completion.activity_data else ""
        print(f"Updating activity: {completion.activity_type} for {completion.language}, score: {completion.score}")
        print(f"Activity data length: {len(activity_data_json)}")
        db.update_activity_score(
            completion.language,
            completion.activity_type,
            completion.score,
            activity_data_json,
            completion.activity_id
        )
        
        return {"success": True, "message": "Activity completed"}
    except Exception as e:
        print(f"Error in complete_activity: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error completing activity: {str(e)}")


# ============================================================================
# Goals Endpoints
# ============================================================================

@app.get("/api/goals/{language}")
def get_goals(language: str):
    """Get daily goals for a language (deprecated - use weekly goals)"""
    goals = db.get_language_goals(language)
    return {"goals": goals}


@app.put("/api/goals/{language}")
def update_goals(language: str, goal_update: GoalUpdate):
    """Update daily goals for a language (deprecated - use weekly goals)"""
    db.update_language_goals(language, goal_update.goals)
    return {"success": True, "message": "Goals updated"}


# ============================================================================
# Weekly Goals Endpoints
# ============================================================================

class WeeklyGoalsUpdate(BaseModel):
    """Model for updating weekly goals"""
    weekly_goals: Dict[str, Dict[str, int]]  # {day: {activity: count}}


class LanguagePersonalizationUpdate(BaseModel):
    """Model for updating language personalization settings"""
    default_transliterate: bool


@app.get("/api/weekly-goals/{language}")
def get_weekly_goals(language: str, week_start_date: str = None):
    """Get weekly goals for a language
    
    Args:
        language: Language code
        week_start_date: Optional date (YYYY-MM-DD) for Monday of target week
    
    Returns:
        {
            "weekly_goals": {
                "monday": {"reading": 2, "listening": 1},
                "tuesday": {"speaking": 2},
                ...
            },
            "week_start_date": "2026-01-27" or "default"
        }
    
    Goals are perpetual - they apply to all future weeks until changed.
    """
    try:
        from datetime import datetime, timedelta
        
        # Calculate week_start_date if not provided
        if week_start_date is None:
            today = config.get_current_time()
            week_start_date = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
        
        weekly_goals = db.get_weekly_goals(language, week_start_date)
        return {
            "weekly_goals": weekly_goals,
            "week_start_date": week_start_date
        }
    except Exception as e:
        print(f"Error in get_weekly_goals: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading weekly goals: {str(e)}")


@app.put("/api/weekly-goals/{language}")
def update_weekly_goals(language: str, goals_update: WeeklyGoalsUpdate, week_start_date: str = None):
    """Update weekly goals for a language (applies perpetually to all future weeks)
    
    Args:
        language: Language code
        goals_update: Weekly goals data in format:
            {
                "weekly_goals": {
                    "monday": {"reading": 2, "listening": 1},
                    "tuesday": {"speaking": 2},
                    ...
                }
            }
        week_start_date: Optional date (YYYY-MM-DD). If None, saves as default template
                        that applies to all future weeks until changed.
    """
    try:
        # Don't pass week_start_date to make goals perpetual by default
        # This means goals will be saved to the 'default' template
        success = db.update_weekly_goals(language, goals_update.weekly_goals, week_start_date=None)
        if success:
            return {
                "success": True,
                "message": "Weekly goals updated (applies to all future weeks)",
                "week_start_date": "default"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update weekly goals")
    except Exception as e:
        print(f"Error in update_weekly_goals: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating weekly goals: {str(e)}")


@app.get("/api/today-goals/{language}")
def get_today_goals(language: str):
    """Get today's goals based on weekly goals
    
    Returns:
        {
            "goals": {"reading": 2, "listening": 1},
            "day": "monday"
        }
    """
    try:
        day_index = config.get_current_time().weekday()
        day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        today = day_names[day_index]
        
        today_goals = db.get_today_goals(language)
        return {
            "goals": today_goals,
            "day": today
        }
    except Exception as e:
        print(f"Error in get_today_goals: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading today's goals: {str(e)}")


@app.get("/api/today-goals-all")
def get_today_goals_all():
    """Get today's goals for all languages
    
    Returns:
        {
            "goals": {
                "kannada": {"reading": 2, "listening": 1},
                "hindi": {"speaking": 1}
            },
            "day": "monday",
            "date": "2026-01-27"
        }
    """
    try:
        from datetime import datetime
        
        today = config.get_current_time()
        day_index = today.weekday()
        day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        day_name = day_names[day_index]
        
        all_goals = db.get_all_languages_today_goals()
        return {
            "goals": all_goals,
            "day": day_name,
            "date": today.strftime('%Y-%m-%d')
        }
    except Exception as e:
        print(f"Error in get_today_goals_all: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading today's goals: {str(e)}")


@app.get("/api/week-overview")
def get_week_overview(week_offset: int = 0):
    """Get weekly goals and progress overview for all languages
    
    Args:
        week_offset: 0 for current week, -1 for last week, 1 for next week
    
    Returns:
        {
            "week_start": "2026-01-27",
            "week_end": "2026-02-02",
            "goals": {
                "monday": {
                    "kannada": {"reading": 2, "listening": 1},
                    "hindi": {"speaking": 1}
                },
                ...
            },
            "progress": {
                "2026-01-27": {
                    "kannada": {"reading": 1, "listening": 0},
                    "hindi": {"speaking": 0}
                },
                ...
            }
        }
    """
    try:
        from datetime import datetime, timedelta
        
        # Calculate week boundaries
        today = config.get_current_time()
        current_monday = today - timedelta(days=today.weekday())
        target_monday = current_monday + timedelta(weeks=week_offset)
        week_end = target_monday + timedelta(days=6)
        
        # Get goals and progress
        week_goals = db.get_week_goals_all_languages(week_offset)
        week_progress = db.get_week_progress(week_offset)
        
        return {
            "week_start": target_monday.strftime('%Y-%m-%d'),
            "week_end": week_end.strftime('%Y-%m-%d'),
            "week_offset": week_offset,
            "goals": week_goals,
            "progress": week_progress
        }
    except Exception as e:
        print(f"Error in get_week_overview: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading week overview: {str(e)}")


# ============================================================================
# Language Personalization Endpoints
# ============================================================================

@app.get("/api/language-personalization/{language}")
def get_language_personalization(language: str):
    """Get personalization settings for a language
    
    Returns:
        {
            "language": "kannada",
            "default_transliterate": true,
            "created_at": "2026-01-31T10:00:00",
            "updated_at": "2026-02-01T15:30:00"
        }
    """
    try:
        settings = db.get_language_personalization(language)
        return settings
    except Exception as e:
        print(f"Error in get_language_personalization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading language personalization: {str(e)}")


@app.put("/api/language-personalization/{language}")
def update_language_personalization(language: str, settings_update: LanguagePersonalizationUpdate):
    """Update personalization settings for a language
    
    Args:
        language: Language code
        settings_update: Settings to update
            {
                "default_transliterate": true
            }
    """
    try:
        success = db.update_language_personalization(language, settings_update.default_transliterate)
        if success:
            return {
                "success": True,
                "message": "Language personalization updated",
                "language": language
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update language personalization")
    except Exception as e:
        print(f"Error in update_language_personalization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating language personalization: {str(e)}")


# ============================================================================
# Flashcard Endpoints
# ============================================================================

class FlashcardUpdateRequest(BaseModel):
    """Model for flashcard comfort level update"""
    word_id: int
    comfort_level: str  # 'very_difficult', 'difficult', 'easy', 'very_easy'

@app.post("/api/flashcard/update")
def update_flashcard_word(request: FlashcardUpdateRequest):
    """Update word state based on flashcard comfort level"""
    try:
        result = db.update_word_state_from_flashcard(
            word_id=request.word_id,
            user_id=1,
            comfort_level=request.comfort_level
        )
        return {
            "success": True,
            "message": "Word state updated",
            "word": result if result else None
        }
    except Exception as e:
        print(f"Error updating flashcard word: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error updating word state: {str(e)}")


# ============================================================================
# SRS (Spaced Repetition System) Endpoints
# ============================================================================

@app.get("/api/streak")
def get_streak_info():
    """Get streak information based on goal completion
    
    Returns:
        {
            'current_streak': int,  # Days where all goals were met consecutively
            'longest_streak': int,  # Longest streak ever
            'today_complete': bool  # Whether today's goals are all met
        }
    """
    try:
        streak_info = db.calculate_goal_based_streak()
        return streak_info
    except Exception as e:
        print(f"Error getting streak info: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/srs/settings/{language}")
def get_srs_settings_api(language: str):
    """Get SRS settings for a language"""
    try:
        # Get basic settings
        settings = db.get_srs_settings(language)
        
        # Get advanced settings
        advanced_settings = db.get_srs_settings_for_language(language)
        
        # Merge and return
        return {
            **settings,
            **advanced_settings,
            'interval_multiplier': float(db.get_user_settings(language).get('interval_multiplier', '1.0'))
        }
    except Exception as e:
        print(f"Error getting SRS settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/srs/settings/{language}")
async def update_srs_settings_api(language: str, request: Request):
    """Update SRS settings for a language"""
    try:
        body = await request.json()
        new_cards = body.get('new_cards_per_day')
        reviews = body.get('reviews_per_day')
        
        if new_cards is None or reviews is None:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Validate
        min_reviews = new_cards * config.MIN_REVIEWS_MULTIPLIER
        if reviews < min_reviews:
            raise HTTPException(
                status_code=400,
                detail=f"Reviews must be at least {min_reviews} (10x new cards)"
            )
        
        # Update basic SRS settings
        success = db.update_srs_settings(language, new_cards, reviews)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update settings")
        
        # Update advanced settings if provided
        advanced_settings = {
            'ease_factor_increment': body.get('ease_factor_increment'),
            'ease_factor_decrement': body.get('ease_factor_decrement'),
            'min_ease_factor': body.get('min_ease_factor'),
            'max_ease_factor': body.get('max_ease_factor'),
            'interval_multiplier': body.get('interval_multiplier')
        }
        
        for key, value in advanced_settings.items():
            if value is not None:
                db.update_user_setting(key, str(value), language)
        
        return {"success": True, "message": "Settings updated"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating SRS settings: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/srs/stats/{language}")
def get_srs_stats_api(language: str):
    """Get SRS stats for a language"""
    try:
        stats = db.get_srs_stats(language)
        return stats
    except Exception as e:
        print(f"Error getting SRS stats: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/srs/simulate")
async def simulate_srs_interval(request: Request):
    """Simulate SRS intervals for different button presses
    
    Body:
        {
            "current_interval": number,  # Current interval in days (0 for new card)
            "ease_factor": number,       # Current ease factor (default 2.5)
            "lapses": number,            # Number of lapses (default 0)
            "ease_increment": number,    # Ease increment on success (default 0.15)
            "ease_decrement": number,    # Ease decrement on failure (default 0.20)
            "min_ease": number,          # Minimum ease factor (default 1.3)
            "max_ease": number,          # Maximum ease factor (default 2.5)
            "interval_multiplier": number # Interval speed multiplier (default 1.0)
        }
    
    Returns:
        {
            "again": {"interval_days": X, "ease_factor": Y, "next_review": "date"},
            "hard": {"interval_days": X, "ease_factor": Y, "next_review": "date"},
            "good": {"interval_days": X, "ease_factor": Y, "next_review": "date"},
            "easy": {"interval_days": X, "ease_factor": Y, "next_review": "date"}
        }
    """
    try:
        body = await request.json()
        
        # Extract parameters with defaults
        current_interval = body.get('current_interval', 0)
        ease_factor = body.get('ease_factor', 2.5)
        lapses = body.get('lapses', 0)
        ease_increment = body.get('ease_increment', 0.15)
        ease_decrement = body.get('ease_decrement', 0.20)
        min_ease = body.get('min_ease', 1.3)
        max_ease = body.get('max_ease', 2.5)
        interval_multiplier = body.get('interval_multiplier', 1.0)
        
        from datetime import datetime, timedelta
        
        def calculate_next_interval(response: str):
            """Calculate next interval based on response"""
            new_ease = ease_factor
            
            if response == "again":
                # Failed: Reset to learning steps, decrease ease
                new_ease = max(min_ease, ease_factor - ease_decrement)
                if current_interval == 0:
                    interval = 0  # Show again today (0 * multiplier = 0)
                else:
                    interval = max(1, current_interval * 0.5 * interval_multiplier)
            
            elif response == "hard":
                # Hard: Multiply by 1.2, slight ease decrease
                new_ease = max(min_ease, ease_factor - ease_decrement * 0.5)
                if current_interval == 0:
                    interval = 1 * interval_multiplier
                else:
                    interval = max(1, current_interval * 1.2 * interval_multiplier)
            
            elif response == "good":
                # Good: Normal progression, slight ease increase
                new_ease = min(max_ease, ease_factor + ease_increment)
                if current_interval == 0:
                    interval = 1 * interval_multiplier
                elif current_interval == 1:
                    interval = 6 * interval_multiplier
                else:
                    interval = current_interval * new_ease * interval_multiplier
            
            elif response == "easy":
                # Easy: Larger jump, bigger ease increase
                new_ease = min(max_ease, ease_factor + ease_increment * 1.5)
                if current_interval == 0:
                    interval = 4 * interval_multiplier
                else:
                    interval = current_interval * new_ease * 1.3 * interval_multiplier
            
            else:
                interval = current_interval * interval_multiplier
            
            # Round interval
            interval = round(interval, 1)
            
            # Calculate next review date
            next_review = datetime.now() + timedelta(days=interval)
            
            return {
                "interval_days": interval,
                "ease_factor": round(new_ease, 2),
                "next_review": next_review.strftime("%Y-%m-%d"),
                "next_review_relative": f"{int(interval)} day{'s' if interval != 1 else ''}"
            }
        
        # Calculate for all response types
        results = {
            "again": calculate_next_interval("again"),
            "hard": calculate_next_interval("hard"),
            "good": calculate_next_interval("good"),
            "easy": calculate_next_interval("easy")
        }
        
        return results
        
    except Exception as e:
        print(f"Error simulating SRS: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/srs/preview/{word_id}")
def preview_srs_intervals(word_id: int, user_id: int = 1):
    """Preview SRS intervals for a word for all possible responses
    
    Returns what the next review interval would be for each button:
    {
        "again": {"interval_days": X, "next_review": "date"},
        "hard": {"interval_days": X, "next_review": "date"},
        "good": {"interval_days": X, "next_review": "date"},
        "easy": {"interval_days": X, "next_review": "date"}
    }
    """
    try:
        preview = db.preview_word_intervals(word_id, user_id)
        return preview
    except Exception as e:
        print(f"Error previewing SRS intervals: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/srs/review-history/{word_id}")
def get_word_review_history(word_id: int, user_id: int = 1):
    """Get the review history for a specific word
    
    Returns:
    {
        "word": {...word data...},
        "current_state": {
            "mastery_level": "learning",
            "review_count": 5,
            "ease_factor": 2.5,
            "interval_days": 7.0,
            "next_review_date": "2024-02-01"
        },
        "history": []  # Empty for now - no history table exists yet
    }
    """
    try:
        conn = sqlite3.connect(config.DB_PATH)
        cursor = conn.cursor()
        
        # Get word data from vocabulary table
        cursor.execute('''
            SELECT id, english_word, translation, transliteration, 
                   word_class, level, language
            FROM vocabulary 
            WHERE id = ?
        ''', (word_id,))
        word_row = cursor.fetchone()
        
        if not word_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Word not found")
        
        word = {
            "id": word_row[0],
            "english_word": word_row[1],
            "translation": word_row[2],
            "transliteration": word_row[3],
            "word_class": word_row[4],
            "level": word_row[5],
            "language": word_row[6]
        }
        
        # Get current SRS state
        cursor.execute('''
            SELECT mastery_level, review_count, ease_factor, 
                   interval_days, next_review_date, last_reviewed
            FROM word_states 
            WHERE word_id = ? AND user_id = ?
        ''', (word_id, user_id))
        state_row = cursor.fetchone()
        
        current_state = None
        if state_row:
            current_state = {
                "mastery_level": state_row[0],
                "review_count": state_row[1],
                "ease_factor": state_row[2],
                "interval_days": state_row[3],
                "next_review_date": state_row[4],
                "last_reviewed": state_row[5]
            }
        
        # Get review history (ordered by most recent first)
        cursor.execute('''
            SELECT reviewed_at, rating, activity_type, 
                   interval_days, ease_factor, mastery_level_before, mastery_level_after
            FROM review_history 
            WHERE word_id = ? AND user_id = ?
            ORDER BY reviewed_at DESC
            LIMIT 50
        ''', (word_id, user_id))
        
        history_rows = cursor.fetchall()
        history = []
        for row in history_rows:
            history.append({
                "reviewed_at": row[0],
                "rating": row[1],
                "activity_type": row[2],
                "interval_days": row[3],
                "ease_factor": row[4],
                "mastery_level_before": row[5],
                "mastery_level_after": row[6]
            })
        
        conn.close()
        
        return {
            "word": word,
            "current_state": current_state,
            "history": history
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching review history: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/flashcards/{language}")
def get_flashcards_api(language: str, limit: int = 50):
    """Get flashcards for review (respects SRS quotas)"""
    try:
        words = db.get_words_for_review(language, limit)
        return {"words": words, "count": len(words)}
    except Exception as e:
        print(f"Error getting flashcards: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/srs/sync-quotas/{language}")
def sync_srs_quotas_for_language(language: str, week_start_date: str = None):
    """Sync SRS daily quotas from weekly flashcard goals for a specific language
    
    This endpoint syncs the SRS system's daily quotas with the user's weekly goals
    for flashcards. It should be called when:
    - Weekly goals are updated
    - The app launches
    - A new week starts
    
    Args:
        language: Language code
        week_start_date: Optional Monday date (YYYY-MM-DD) for the target week
    
    Returns:
        {"success": True, "message": "SRS quotas synced", "language": "kannada"}
    """
    try:
        from datetime import datetime, timedelta
        
        # Calculate week_start_date if not provided
        if week_start_date is None:
            today = config.get_current_time()
            week_start_date = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
        
        db.sync_srs_quotas_from_weekly_goals(language, week_start_date)
        
        return {
            "success": True,
            "message": f"SRS quotas synced for {language}",
            "language": language,
            "week_start_date": week_start_date
        }
    except Exception as e:
        print(f"Error syncing SRS quotas for {language}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error syncing SRS quotas: {str(e)}")


@app.post("/api/srs/sync-quotas-all")
def sync_srs_quotas_all_languages(week_start_date: str = None):
    """Sync SRS daily quotas from weekly flashcard goals for ALL languages
    
    This endpoint syncs the SRS system for all languages that have weekly goals.
    Should be called on app startup to ensure quotas are up to date.
    
    Args:
        week_start_date: Optional Monday date (YYYY-MM-DD) for the target week
    
    Returns:
        {"success": True, "message": "SRS quotas synced for all languages", "count": 3}
    """
    try:
        from datetime import datetime, timedelta
        
        # Calculate week_start_date if not provided
        if week_start_date is None:
            today = config.get_current_time()
            week_start_date = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
        
        success = db.sync_all_languages_srs_quotas(week_start_date)
        
        if success:
            return {
                "success": True,
                "message": "SRS quotas synced for all languages",
                "week_start_date": week_start_date
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to sync SRS quotas")
            
    except Exception as e:
        print(f"Error syncing SRS quotas for all languages: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error syncing SRS quotas: {str(e)}")


# ============================================================================
# Stats & Progress Endpoints
# ============================================================================

@app.get("/api/stats/daily")
def get_daily_stats_endpoint(language: Optional[str] = None, days: int = 365):
    """Get daily activity and word learning stats for contribution graph"""
    stats = db.get_daily_stats(language=language, days=days)
    return {"stats": stats}

@app.get("/api/stats/language/{language}")
def get_language_stats_endpoint(language: str):
    """Get comprehensive stats for a specific language"""
    stats = db.get_language_stats(language)
    return stats

@app.get("/api/stats/languages")
def get_all_languages_stats():
    """Get stats summary for all languages"""
    languages = ['kannada', 'telugu', 'malayalam', 'tamil', 'hindi', 'urdu', 'spanish', 'french', 'welsh']
    all_stats = {}
    for lang in languages:
        try:
            all_stats[lang] = db.get_language_stats(lang)
        except Exception as e:
            print(f"Error getting stats for {lang}: {e}")
            all_stats[lang] = {
                'total_activities': 0,
                'words_mastered': 0,
                'words_learning': 0,
                'average_score': 0,
                'activities': {}
            }
    return all_stats


@app.get("/api/languages/learning")
def get_learning_languages():
    """Get all languages the user is learning with their levels"""
    languages = db.get_user_learning_languages()
    result = []
    for lang_code in languages:
        try:
            level_info = db.calculate_user_level(lang_code)
            result.append({
                'language': lang_code,
                'level': level_info.get('level', 'A1'),
                'total_mastered': level_info.get('total_mastered', 0),
                'progress': level_info.get('progress', 0),
            })
        except Exception as e:
            print(f"Error getting level for {lang_code}: {e}")
            result.append({
                'language': lang_code,
                'level': 'A1',
                'total_mastered': 0,
                'progress': 0,
            })
    return {'languages': result}


# ============================================================================
# Activity History Endpoints
# ============================================================================

@app.get("/api/activity-history/{language}")
def get_activity_history(language: str, limit: int = 1000):
    """Get activity history for a language
    
    Default limit is 1000 to show all activities. Activities should not expire.
    """
    import sqlite3
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM activity_history
        WHERE user_id = 1 AND language = ?
        ORDER BY COALESCE(completed_at, '9999-12-31') DESC, id DESC
        LIMIT ?
    ''', (language, limit))
    
    history = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Always return a consistent JSON structure
    return {"history": history}

@app.get("/api/weekly-stats")
def get_weekly_stats(days: int = 7, offset: int = 0):
    """Get activity and word counts for the past N days
    
    Args:
        days: Number of days to retrieve (default 7)
        offset: Number of days to offset from today (default 0 for current week, 7 for last week, etc.)
    
    Returns daily aggregates of activities completed, words learned, and lessons completed
    """
    import sqlite3
    from datetime import datetime, timedelta
    
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Calculate date range with offset
    end_date = config.get_current_time() - timedelta(days=offset)
    start_date = end_date - timedelta(days=days-1)
    
    # Get activity counts by date
    cursor.execute('''
        SELECT 
            DATE(completed_at) as date,
            COUNT(*) as activity_count
        FROM activity_history
        WHERE user_id = 1 
        AND completed_at IS NOT NULL
        AND completed_at >= ?
        GROUP BY DATE(completed_at)
        ORDER BY date ASC
    ''', (start_date.strftime('%Y-%m-%d'),))
    
    activity_counts = {row['date']: row['activity_count'] for row in cursor.fetchall()}
    
    # Get lesson counts by date
    cursor.execute('''
        SELECT 
            DATE(completed_at) as date,
            COUNT(*) as lesson_count
        FROM lesson_completions
        WHERE user_id = 1 
        AND completed_at IS NOT NULL
        AND completed_at >= ?
        GROUP BY DATE(completed_at)
        ORDER BY date ASC
    ''', (start_date.strftime('%Y-%m-%d'),))
    
    lesson_counts = {row['date']: row['lesson_count'] for row in cursor.fetchall()}
    
    # Get word counts by date (from activity_data JSON)
    cursor.execute('''
        SELECT 
            DATE(completed_at) as date,
            activity_data
        FROM activity_history
        WHERE user_id = 1 
        AND completed_at IS NOT NULL
        AND completed_at >= ?
        ORDER BY date ASC
    ''', (start_date.strftime('%Y-%m-%d'),))
    
    word_counts = {}
    for row in cursor.fetchall():
        date = row['date']
        if row['activity_data']:
            try:
                data = json.loads(row['activity_data'])
                # Count words from different activity types
                words = 0
                if 'vocabulary' in data:
                    words += len(data['vocabulary'])
                if 'sentences' in data:
                    words += len(data['sentences'])
                if 'questions' in data:
                    words += len(data['questions'])
                
                word_counts[date] = word_counts.get(date, 0) + words
            except:
                pass
    
    conn.close()
    
    # Build response for all days in range
    stats = []
    current_date = start_date
    for i in range(days):
        date_str = current_date.strftime('%Y-%m-%d')
        stats.append({
            'date': date_str,
            'day': current_date.strftime('%a'),  # Mon, Tue, etc.
            'activities': activity_counts.get(date_str, 0),
            'lessons': lesson_counts.get(date_str, 0),
            'words': word_counts.get(date_str, 0)
        })
        current_date += timedelta(days=1)
    
    return {'stats': stats}

@app.get("/api/activity/{activity_id}")
def get_activity_by_id(activity_id: int):
    """Get a specific activity by ID"""
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM activity_history
        WHERE user_id = 1 AND id = ?
    ''', (activity_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    activity = dict(row)
    # Parse activity_data JSON
    if activity.get('activity_data'):
        try:
            activity['activity_data'] = json.loads(activity['activity_data'])
        except json.JSONDecodeError:
            activity['activity_data'] = {}
    
    return activity
    
    return {"history": history}

@app.get("/api/daily-activities")
def get_daily_activities(date: str):
    """Get all activities and lessons completed on a specific date
    
    Args:
        date: Date in YYYY-MM-DD format
        
    Returns:
        List of activities and lessons with id, activity_type, language, timestamp, score, title
    """
    import sqlite3
    
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get regular activities
    cursor.execute('''
        SELECT 
            id,
            activity_type,
            language,
            completed_at as timestamp,
            activity_data
        FROM activity_history
        WHERE user_id = 1 
        AND DATE(completed_at) = ?
        ORDER BY completed_at DESC
    ''', (date,))
    
    activities = []
    for row in cursor.fetchall():
        activity = {
            'id': row['id'],
            'activity_type': row['activity_type'],
            'language': row['language'],
            'timestamp': row['timestamp']
        }
        
        # Try to extract score and title from activity_data if available
        if row['activity_data']:
            try:
                data = json.loads(row['activity_data'])
                if 'final_score' in data:
                    activity['score'] = data['final_score']
                elif 'score' in data:
                    activity['score'] = data['score']
                
                # Extract title based on activity type - check multiple possible fields
                # Priority: activity_name > story_name > title > topic > passage_name
                if 'activity_name' in data:
                    activity['title'] = data['activity_name']
                elif 'story_name' in data:
                    activity['title'] = data['story_name']
                elif 'title' in data:
                    activity['title'] = data['title']
                elif 'topic' in data:
                    activity['title'] = data['topic']
                elif 'passage_name' in data:
                    activity['title'] = data['passage_name']
                elif 'story_title' in data:
                    activity['title'] = data['story_title']
            except:
                pass
        
        activities.append(activity)
    
    # Get lessons completed on this date
    cursor.execute('''
        SELECT 
            lc.id,
            lc.lesson_id,
            lc.completed_at as timestamp,
            lc.total_score,
            l.title,
            l.language
        FROM lesson_completions lc
        LEFT JOIN lessons l ON lc.lesson_id = l.lesson_id
        WHERE lc.user_id = 1 
        AND DATE(lc.completed_at) = ?
        ORDER BY lc.completed_at DESC
    ''', (date,))
    
    # Map full language names to language codes
    language_code_map = {
        'Malayalam': 'ml',
        'Kannada': 'kn',
        'Tamil': 'ta',
        'Telugu': 'te',
        'Hindi': 'hi',
        'Marathi': 'mr',
        'Bengali': 'bn',
        'Gujarati': 'gu',
        'Punjabi': 'pa',
        'Urdu': 'ur'
    }
    
    for row in cursor.fetchall():
        language_full = row['language']
        language_code = language_code_map.get(language_full, language_full.lower() if language_full else None)
        
        lesson = {
            'id': row['id'],
            'activity_type': 'lesson',  # Mark as lesson type
            'language': language_code,
            'timestamp': row['timestamp'],
            'title': row['title'] or 'Lesson',
            'lesson_id': row['lesson_id']
        }
        
        if row['total_score'] is not None:
            lesson['score'] = row['total_score']
        
        activities.append(lesson)
    
    # Sort all activities by timestamp (most recent first)
    activities.sort(key=lambda x: x['timestamp'], reverse=True)
    
    conn.close()
    
    return {
        'date': date,
        'activities': activities
    }


# ============================================================================
# Speech-to-Text Endpoint
# ============================================================================

@app.post("/api/speech-to-text")
def speech_to_text(request: SpeechToTextRequest):
    """Convert audio to text using Google Cloud Speech-to-Text"""
    import base64
    
    try:
        # Decode base64 audio
        try:
            audio_bytes = base64.b64decode(request.audio_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 audio data: {str(e)}")
        
        # Map language codes to Google Speech language codes
        language_map = {
            'kannada': 'kn-IN',
            'telugu': 'te-IN',
            'malayalam': 'ml-IN',
            'tamil': 'ta-IN',
            'hindi': 'hi-IN',
            'urdu': 'ur-PK',
            'spanish': 'es-ES',
            'french': 'fr-FR',
            'welsh': 'cy-GB',
        }
        
        language_code = language_map.get(request.language.lower(), 'kn-IN')
        
        # Transcribe audio
        transcript = api_client.transcribe_audio(audio_bytes, language_code, request.audio_format)
        
        # Check if transcription returned an error
        if transcript.startswith("Error"):
            raise HTTPException(status_code=500, detail=transcript)
        
        return {"transcript": transcript}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in speech-to-text: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error converting audio to text: {str(e)}")


# ============================================================================
# User Language Preferences
# ============================================================================

@app.get("/api/user-languages")
def get_user_languages():
    """Get list of languages the user wants to learn, sorted by level (C2 -> A0)"""
    import sqlite3
    
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Create user_preferences table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    
    # Always read the most-recently written row (guards against duplicate rows
    # that can accumulate when the UNIQUE constraint doesn't exist on the table)
    cursor.execute('''
        SELECT value FROM user_preferences
        WHERE user_id = 1 AND key = 'selected_languages'
        ORDER BY id DESC LIMIT 1
    ''')
    
    row = cursor.fetchone()
    conn.close()
    
    # Get language list
    if row and row['value']:
        try:
            languages = json.loads(row['value'])
        except:
            languages = []
    else:
        languages = []
    
    # Get levels for each language and sort by level (C2 -> A0)
    language_levels = []
    level_order = {'C2': 6, 'C1': 5, 'B2': 4, 'B1': 3, 'A2': 2, 'A1': 1, 'A0': 0}
    
    for lang in languages:
        level_info = db.calculate_user_level(lang)
        language_levels.append({
            'code': lang,
            'level': level_info.get('level', 'A0'),
            'level_order': level_order.get(level_info.get('level', 'A0'), 0)
        })
    
    # Sort by level (highest to lowest: C2 -> A0)
    language_levels.sort(key=lambda x: x['level_order'], reverse=True)
    
    # Return just the language codes in sorted order
    sorted_languages = [lang['code'] for lang in language_levels]
    
    return {'languages': sorted_languages}
    
    # Get language list
    if row and row['value']:
        try:
            languages = json.loads(row['value'])
        except:
            languages = []
    else:
        languages = []
    
    # Get levels for each language and sort by level (C2 -> A0)
    language_levels = []
    level_order = {'C2': 6, 'C1': 5, 'B2': 4, 'B1': 3, 'A2': 2, 'A1': 1, 'A0': 0}
    
    for lang in languages:
        level_info = db.calculate_user_level(lang)
        language_levels.append({
            'code': lang,
            'level': level_info.get('level', 'A0'),
            'level_order': level_order.get(level_info.get('level', 'A0'), 0)
        })
    
    # Sort by level (highest to lowest: C2 -> A0)
    language_levels.sort(key=lambda x: x['level_order'], reverse=True)
    
    # Return just the language codes in sorted order
    sorted_languages = [lang['code'] for lang in language_levels]
    
    return {'languages': sorted_languages}


@app.post("/api/user-languages")
async def save_user_languages(request: Request):
    """Save list of languages the user wants to learn"""
    
    data = await request.json()
    languages = data.get('languages', [])
    
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    # Create user_preferences table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Delete ALL existing rows for this key (cleans up any duplicates), then insert fresh
    cursor.execute('''
        DELETE FROM user_preferences WHERE user_id = 1 AND key = 'selected_languages'
    ''')
    cursor.execute('''
        INSERT INTO user_preferences (user_id, key, value, updated_at)
        VALUES (1, 'selected_languages', ?, datetime('now'))
    ''', (json.dumps(languages),))
    
    conn.commit()
    conn.close()
    
    return {'success': True, 'languages': languages}


@app.get("/api/user-interests")
def get_user_interests():
    """Get user's selected interests/tags"""
    
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Create user_preferences table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, key)
        )
    ''')
    
    # Get interests from user_preferences
    cursor.execute('''
        SELECT value FROM user_preferences
        WHERE user_id = 1 AND key = 'selected_interests'
    ''')
    row = cursor.fetchone()
    conn.close()
    
    if row and row['value']:
        interests = json.loads(row['value'])
        return {'interests': interests}
    
    # Return empty list by default
    return {'interests': []}


@app.post("/api/user-interests")
async def save_user_interests(request: Request):
    """Save user's selected interests/tags"""
    
    data = await request.json()
    interests = data.get('interests', [])
    
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    # Create user_preferences table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Delete then insert to avoid duplicate-row buildup from missing UNIQUE constraint
    cursor.execute("DELETE FROM user_preferences WHERE user_id = 1 AND key = 'selected_interests'")
    cursor.execute('''
        INSERT INTO user_preferences (user_id, key, value, updated_at)
        VALUES (1, 'selected_interests', ?, datetime('now'))
    ''', (json.dumps(interests),))
    
    conn.commit()
    conn.close()
    
    return {'success': True, 'interests': interests}


# ============================================================================
# User Preferences (Toggle States)
# ============================================================================

@app.get("/api/user-preferences")
def get_user_preferences(keys: str = None):
    """Get user preferences by keys (comma-separated)"""
    
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Create user_preferences table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    if keys:
        key_list = [k.strip() for k in keys.split(',')]
        placeholders = ','.join('?' * len(key_list))
        # Use MAX(id) subquery to get the most-recently written row per key
        cursor.execute(f'''
            SELECT key, value FROM user_preferences
            WHERE user_id = 1 AND key IN ({placeholders})
            AND id IN (
                SELECT MAX(id) FROM user_preferences
                WHERE user_id = 1 AND key IN ({placeholders})
                GROUP BY key
            )
        ''', key_list + key_list)
    else:
        cursor.execute('''
            SELECT key, value FROM user_preferences
            WHERE user_id = 1
            AND id IN (
                SELECT MAX(id) FROM user_preferences
                WHERE user_id = 1
                GROUP BY key
            )
        ''')
    
    rows = cursor.fetchall()
    conn.close()
    
    # Convert to dict and parse boolean values
    preferences = {}
    for row in rows:
        key = row['key']
        value = row['value']
        if value in ('true', 'false'):
            preferences[key] = value == 'true'
        else:
            preferences[key] = value
    
    return preferences


@app.put("/api/user-preferences")
def save_user_preferences(preferences: dict):
    """Save user preferences (supports multiple key-value pairs)"""
    
    conn = sqlite3.connect(config.DB_PATH)
    cursor = conn.cursor()
    
    # Create user_preferences table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Save each preference (delete + insert to handle missing UNIQUE constraint)
    for key, value in preferences.items():
        # Convert boolean to string for storage
        if isinstance(value, bool):
            value = 'true' if value else 'false'
        
        cursor.execute('DELETE FROM user_preferences WHERE user_id = 1 AND key = ?', (key,))
        cursor.execute('''
            INSERT INTO user_preferences (user_id, key, value, updated_at)
            VALUES (1, ?, ?, datetime('now'))
        ''', (key, value))
    
    conn.commit()
    conn.close()
    
    return {'success': True, 'saved': list(preferences.keys())}


# ============================================================================
# Server Startup
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    print(f"Starting Fluo Backend on {config.SERVER_HOST}:{config.SERVER_PORT}")
    uvicorn.run(app, host=config.SERVER_HOST, port=config.SERVER_PORT)

