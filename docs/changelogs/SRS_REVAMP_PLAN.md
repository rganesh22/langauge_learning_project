# SRS System Revamp Plan

## Overview
Complete revamp of the Spaced Repetition System (SRS) to give users granular control over their learning pace and review schedule.

## Key Features

### 1. Per-Language Configuration
- **New Cards per Week**: Number of new words to introduce weekly
- **Reviews per Week**: Number of review sessions weekly
- **Validation**: Reviews ≥ 10 × New Cards (to ensure adequate practice)

### 2. Card Scheduling
- Track cards in different states:
  - **New**: Not yet introduced to user
  - **Learning**: Currently being learned (seen but not mastered)
  - **Review**: Due for review based on SRS algorithm
  - **Mastered**: Well-learned, longer intervals

### 3. Daily Distribution
- Distribute weekly goals across days evenly
- Show daily quotas on dashboard
- Track completion for each day

### 4. Flashcard Screen Updates
- Show **due reviews** count (cards needing review today)
- Show **new cards** count (new words available today)
- Only show cards that are:
  - Due for review (next_review_date ≤ today)
  - OR New cards within daily quota
- Hide cards not yet introduced or not due

### 5. Practice Screen Improvements
- Vocab practice card shows:
  - "X reviews due"
  - "X new cards"
  - Visual progress indicator

## Database Schema Changes

### New Table: `srs_settings`
```sql
CREATE TABLE IF NOT EXISTS srs_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1,
    language TEXT NOT NULL,
    new_cards_per_week INTEGER DEFAULT 20,
    reviews_per_week INTEGER DEFAULT 200,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, language),
    FOREIGN KEY (user_id) REFERENCES user_profile(id)
);
```

### Update `word_states` table (already exists, verify fields):
- `mastery_level`: new, learning, review, mastered
- `next_review_date`: Date when card is next due
- `review_count`: Number of times reviewed
- `ease_factor`: SRS ease factor
- `last_reviewed`: Last review date
- **Add**: `introduced_date`: When card was first shown to user

### New Table: `srs_daily_quota`
```sql
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
);
```

## API Endpoints

### Get SRS Settings
`GET /api/srs/settings/{language}`
- Returns current SRS settings for language

### Update SRS Settings
`PUT /api/srs/settings/{language}`
- Body: `{ new_cards_per_week, reviews_per_week }`
- Validates: reviews_per_week ≥ 10 × new_cards_per_week
- Updates settings and recalculates daily quotas

### Get SRS Stats
`GET /api/srs/stats/{language}`
- Returns:
  - `due_count`: Reviews due today
  - `new_count`: New cards available today
  - `total_new`: Total unintroduced cards
  - `total_learning`: Cards in learning state
  - `total_review`: Cards in review state
  - `total_mastered`: Mastered cards
  - `today_new_completed`: New cards completed today
  - `today_reviews_completed`: Reviews completed today
  - `today_new_quota`: New cards quota for today
  - `today_reviews_quota`: Reviews quota for today

### Get Flashcards
`GET /api/flashcards/{language}`
- Returns only cards that are:
  - Due for review (next_review_date ≤ today) OR
  - New cards within today's quota
- Prioritizes:
  1. Overdue reviews (oldest first)
  2. Due reviews (by ease_factor, hardest first)
  3. New cards (random selection from quota)

## UI Changes

### Practice Screen - Vocab Practice Card
```
┌─────────────────────────────────┐
│ 📚 Flashcards                   │
│                                 │
│ ⭕ 15 reviews due               │
│ ✨ 3 new cards                 │
│                                 │
│ Progress: ████████░░░  45/60    │
└─────────────────────────────────┘
```

### Flashcard Screen Header
```
┌─────────────────────────────────┐
│ ← Flashcards            ⚙️      │
│                                 │
│ Today's Progress:               │
│ Reviews: 12/30 ⭕                │
│ New: 2/5 ✨                     │
└─────────────────────────────────┘
```

### Settings Modal (New)
```
┌─────────────────────────────────┐
│      SRS Settings               │
│                                 │
│ Language: Kannada 🇮🇳           │
│                                 │
│ New Cards per Week:             │
│ [20] (slider: 0-100)            │
│                                 │
│ Reviews per Week:               │
│ [200] (slider: 0-1000)          │
│                                 │
│ ⚠️ Minimum: 200 (10x new cards) │
│                                 │
│ Daily Distribution:             │
│ • New: ~3 cards/day             │
│ • Reviews: ~29 cards/day        │
│                                 │
│ [Cancel]  [Save]                │
└─────────────────────────────────┘
```

### Profile Screen - Add SRS Settings Section
- Show current settings per language
- Quick access to modify settings
- Stats overview (total cards, mastery distribution)

## Implementation Steps

1. ✅ Database schema updates (migrations)
2. ✅ Backend API endpoints for SRS settings
3. ✅ Backend API endpoint for SRS stats
4. ✅ Update flashcard query logic
5. ✅ Frontend: Practice Screen card update
6. ✅ Frontend: Flashcard Screen header update
7. ✅ Frontend: Settings modal
8. ✅ Frontend: Profile Screen SRS section
9. ✅ Testing and validation

## Configuration Defaults
- `DEFAULT_NEW_CARDS_PER_WEEK`: 20
- `DEFAULT_REVIEWS_PER_WEEK`: 200
- `MIN_REVIEWS_MULTIPLIER`: 10 (reviews must be ≥ 10 × new cards)
- Daily quotas calculated: `weekly_quota / 7` (distributed evenly)

## Benefits
1. **User Control**: Users set their own pace
2. **Sustainable Learning**: Enforced review-to-new-card ratio prevents overwhelm
3. **Clear Progress**: Always know what's due and what's new
4. **Focused Practice**: Only relevant cards shown
5. **Per-Language**: Different paces for different languages
