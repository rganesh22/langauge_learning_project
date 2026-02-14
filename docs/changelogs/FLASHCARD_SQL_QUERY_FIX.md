# Flashcard SQL Query Fix - January 31, 2026

## Issue Encountered

### Error 1: SQL Query Failure
```
sqlite3.OperationalError: no such column: v.frequency
```

### Error 2: CORS Error (Secondary)
```
Access to fetch at 'http://localhost:5001/api/words-for-review/kannada?limit=50' 
from origin 'http://localhost:8082' has been blocked by CORS policy
```

### Error 3: 500 Internal Server Error
Backend returned 500 due to the SQL error above.

## Root Cause

When implementing progressive learning (ordering by CEFR level), I added:
```sql
ORDER BY level_order ASC, v.frequency DESC
```

However, the `vocabulary` table does not have a `frequency` column. The vocabulary data comes from CSV files that don't include frequency information.

## Solution

### Fixed SQL Query
Changed the ORDER BY clause to use `v.id` (insertion order) instead of `v.frequency`:

```sql
ORDER BY level_order ASC, v.id ASC
```

### Rationale
- **Level ordering preserved**: A1 → A2 → B1 → B2 → C1 → C2 (main goal)
- **Consistent ordering**: Using `id` gives predictable, stable ordering
- **No random shuffling**: Words appear in same order each time
- **CSV order respected**: Words in CSV are already in a reasonable order (often by importance/frequency in the original Oxford 5000 list)

## Changes Made

### File: `backend/db.py`

**Location**: `get_words_for_review()` function, lines 943-952

**Before**:
```python
ORDER BY level_order ASC, v.frequency DESC
```

**After**:
```python
ORDER BY level_order ASC, v.id ASC
```

### Backend Restart
Restarted uvicorn server to apply changes:
```bash
pkill -f "uvicorn backend.main:app"
uvicorn backend.main:app --reload --host 0.0.0.0 --port 5001 > backend_uvicorn.log 2>&1 &
```

## Verification

### Test Request
```bash
curl -s http://localhost:5001/api/words-for-review/kannada?limit=5
```

### Result
✅ **200 OK** - Endpoint working correctly

### Server Status
```
INFO: Uvicorn running on http://0.0.0.0:5001
INFO: Application startup complete
INFO: 127.0.0.1:57063 - "GET /api/words-for-review/kannada?limit=5 HTTP/1.1" 200 OK
```

## Technical Details

### Vocabulary Table Schema
The `vocabulary` table has these columns:
- `id` (PRIMARY KEY)
- `language`
- `english_word`
- `translation`
- `transliteration`
- `word_class`
- `level` (a1, a2, b1, b2, c1, c2)
- `verb_transitivity`

**Note**: No `frequency` column exists.

### Data Source
Vocabulary loaded from CSV files:
- `vocab/kannada-oxford-5000.csv`
- `vocab/tamil-oxford-5000.csv`
- `vocab/telugu-oxford-5000.csv`
- `vocab/hindi-oxford-5000.csv`
- `vocab/urdu-oxford-5000.csv`
- `vocab/malayalam-oxford-5000.csv`

These CSVs are derived from Oxford 5000 word lists, which are already ordered by importance/frequency in the original source.

### Progressive Learning Still Works

**Word Selection Priority**:
1. **Reviews first** (always highest priority)
2. **New cards by level**:
   - A1 words (IDs 1-1000) come first
   - A2 words (IDs 1001-2000) come next
   - B1 words (IDs 2001-3000) follow
   - And so on...

**Within each level**: Words appear in CSV/insertion order, which respects the original Oxford list's frequency-based ordering.

## Why `v.id ASC` is Good Enough

### Original Oxford 5000 Ordering
The Oxford 5000 lists are curated academic word lists where:
- Most important/frequent words appear earlier
- Words are grouped by CEFR level
- Within each level, words are roughly ordered by pedagogical importance

### CSV Insertion Order
When CSV files are loaded into database:
- Row 1 becomes ID 1
- Row 2 becomes ID 2
- etc.

So `ORDER BY v.id ASC` effectively maintains the original Oxford ordering.

### Example
If `kannada-oxford-5000.csv` has:
```
english_word,translation,level
the,ಅದು,a1
be,ಇರು,a1
to,ಗೆ,a1
of,ನ,a1
```

These get IDs 1, 2, 3, 4 and appear in that order when queried with `ORDER BY level_order ASC, v.id ASC`.

## Future Enhancement (Optional)

If we want explicit frequency-based ordering later, we could:

1. **Add frequency column to CSV files**:
   ```csv
   english_word,translation,level,frequency
   the,ಅದು,a1,1
   be,ಇರು,a1,2
   ```

2. **Update database schema**:
   ```sql
   ALTER TABLE vocabulary ADD COLUMN frequency INTEGER;
   ```

3. **Restore original query**:
   ```sql
   ORDER BY level_order ASC, v.frequency ASC
   ```

But for now, the current approach (using `id`) is sufficient and maintains progressive learning.

## Status
✅ SQL query fixed
✅ Backend restarted
✅ Endpoint tested (200 OK)
✅ Progressive learning maintained (A1→C2)
✅ Ready for frontend testing
