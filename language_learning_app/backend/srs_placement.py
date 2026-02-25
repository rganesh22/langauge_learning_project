"""
srs_placement.py
────────────────
Assigns SRS states and staggered review dates to every vocabulary word
for a language after a CEFR placement test, based on where each word
sits relative to the user's assessed level.

CEFR hierarchy (configurable at module level):
    A1 → A2 → B1 → B2 → C1 → C2

Gap rules (also configurable):
  ┌────────────────────────────────────────────────────────────────────┐
  │ Gap   │ Label         │ mastery_level │ Ease factor │ Interval base│
  ├────────────────────────────────────────────────────────────────────┤
  │ < 0   │ below level   │ 'review'      │ 3.0 (high)  │ 14–60 days  │
  │  0    │ at level      │ 'learning'    │ 2.8 (high)  │ 1–7 days    │
  │ +1    │ one above     │ 'learning'    │ 2.5 (normal)│ 1–3 days    │
  │ +2    │ two above     │ 'new'         │ 2.5         │ None (queue)│
  │ ≥ +3  │ far above     │ 'new'         │ 2.5         │ None (queue)│
  └────────────────────────────────────────────────────────────────────┘

Review dates are spread across a configurable window so that cards don't
all come due on the same day (avoids review avalanches).
"""

import sqlite3
import random
import math
from datetime import date, timedelta, datetime
from typing import Dict, List, Optional, Tuple

from . import config

# ─────────────────────────────────────────────────────────────────────────────
# Public configuration knobs
# ─────────────────────────────────────────────────────────────────────────────

# Ordered list of CEFR levels (lowest → highest)
CEFR_ORDER: List[str] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

# How the gap between word-level and user-level maps to SRS state
# Gap = cefr_rank(word) - cefr_rank(user)
# Negative → word is below user's level; 0 → at level; positive → above
#
# Each entry:  gap_min, gap_max (inclusive), mastery_level, ease_factor,
#              interval_min_days, interval_max_days
#   (interval_* only used when mastery_level != 'new')
GAP_RULES: List[Dict] = [
    # Below the user's level → already "known-ish", long review interval
    {
        'gap_min': None,   # any negative
        'gap_max': -1,
        'mastery_level': 'review',
        'ease_factor': 3.0,
        'interval_min': 14,
        'interval_max': 60,
    },
    # Exactly at the user's level → accelerated learning
    {
        'gap_min': 0,
        'gap_max': 0,
        'mastery_level': 'learning',
        'ease_factor': 2.8,
        'interval_min': 1,
        'interval_max': 7,
    },
    # One CEFR level above → normal learning schedule
    {
        'gap_min': 1,
        'gap_max': 1,
        'mastery_level': 'learning',
        'ease_factor': 2.5,
        'interval_min': 1,
        'interval_max': 3,
    },
    # Two or more levels above → queued as new, no date yet
    {
        'gap_min': 2,
        'gap_max': None,   # any positive ≥ 2
        'mastery_level': 'new',
        'ease_factor': 2.5,
        'interval_min': None,
        'interval_max': None,
    },
]

# Stagger window (days) over which review cards are spread.
# Larger → lighter daily load but longer before all cards are touched.
STAGGER_WINDOW_BELOW: int = 30   # 'review' cards (below level)
STAGGER_WINDOW_AT: int = 14      # 'learning' cards at user's level
STAGGER_WINDOW_ABOVE_1: int = 7  # 'learning' cards one level above

# Maximum words that receive an immediate (today) review date within each
# category.  The rest are spread across the stagger window.
IMMEDIATE_BATCH_BELOW: int = 20
IMMEDIATE_BATCH_AT: int = 15
IMMEDIATE_BATCH_ABOVE_1: int = 10


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _cefr_rank(level: str) -> int:
    """Return 0-based rank of a CEFR level.  Unknown levels → -1."""
    try:
        return CEFR_ORDER.index(level.upper())
    except (ValueError, AttributeError):
        return -1


def _match_rule(gap: int) -> Dict:
    """Return the first GAP_RULES entry whose [gap_min, gap_max] includes gap."""
    for rule in GAP_RULES:
        lo = rule['gap_min'] if rule['gap_min'] is not None else -9999
        hi = rule['gap_max'] if rule['gap_max'] is not None else 9999
        if lo <= gap <= hi:
            return rule
    # Fallback — treat as 'new'
    return GAP_RULES[-1]


def _stagger_dates(
    n: int,
    immediate_n: int,
    window_days: int,
    start: date,
) -> List[date]:
    """
    Return a list of n review dates spread over [start, start + window_days).

    The first `immediate_n` entries get `start` (today).
    The remainder are uniformly distributed across the window with a small
    random jitter (±1 day) so cards don't cluster on integer boundaries.
    """
    if n == 0:
        return []

    dates: List[date] = []
    immediate = min(immediate_n, n)
    deferred = n - immediate

    # Immediate batch
    dates.extend([start] * immediate)

    if deferred == 0:
        return dates

    # Distribute deferred cards evenly across [1, window_days]
    for i in range(deferred):
        # Linear spread 1 → window_days
        base_day = 1 + int(i * (window_days - 1) / max(deferred - 1, 1))
        jitter = random.randint(-1, 1)
        day = max(1, min(window_days, base_day + jitter))
        dates.append(start + timedelta(days=day))

    return dates


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def compute_placement_states(
    language: str,
    user_cefr_level: str,
    user_id: int = 1,
) -> List[Dict]:
    """
    Compute the desired SRS state for every vocabulary word in `language`
    based on `user_cefr_level`.

    Returns a list of dicts ready to be persisted:
        {
            'word_id': int,
            'mastery_level': str,        # 'new' | 'learning' | 'review'
            'ease_factor': float,
            'next_review_date': str|None, # 'YYYY-MM-DD' or None
            'interval_days': int|None,
            'review_count': int,
        }

    Does NOT write to the database — call apply_placement_states() for that.
    """
    user_rank = _cefr_rank(user_cefr_level)
    is_a0 = user_cefr_level.upper() == 'A0'

    conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        '''SELECT id, level FROM vocabulary
           WHERE language = ? AND level IS NOT NULL AND level != ""''',
        (language,),
    )
    rows = cursor.fetchall()
    conn.close()

    today = date.today()

    # Bucket words by their gap so we can stagger per-bucket
    # bucket key → list of (word_id, rule)
    buckets: Dict[str, List[Tuple[int, Dict]]] = {
        'below': [],  # gap < 0
        'at': [],     # gap == 0
        'above_1': [], # gap == 1
        'new': [],    # gap >= 2
    }

    for row in rows:
        word_rank = _cefr_rank(row['level'])
        if word_rank < 0:
            # Unknown CEFR level → queue as new
            buckets['new'].append((row['id'], _match_rule(99)))
            continue

        gap = word_rank - user_rank

        # A0 rule: all words go to 'new' — user knows nothing yet
        if is_a0:
            buckets['new'].append((row['id'], _match_rule(99)))
            continue

        # For A1+: words AT or BELOW user's level → 'review' (already known-ish)
        # words one level ABOVE → 'learning' (active study)
        # words two+ levels above → 'new' (not ready yet)
        #
        # e.g. user=A1: A1 words → review, A2 words → learning, B1+ → new
        # e.g. user=A2: A1+A2 words → review, B1 words → learning, B2+ → new
        below_rule = _match_rule(-1)  # always gives mastery_level='review'
        if gap <= 0:
            buckets['below'].append((row['id'], below_rule))
        elif gap == 1:
            buckets['above_1'].append((row['id'], _match_rule(gap)))
        else:
            buckets['new'].append((row['id'], _match_rule(gap)))

    # Shuffle each bucket so stagger order is random (not alphabetical/id-order)
    for b in buckets.values():
        random.shuffle(b)

    # Generate staggered review dates per bucket
    def _dates_for_bucket(key: str) -> List[Optional[date]]:
        items = buckets[key]
        n = len(items)
        if key == 'below':
            return _stagger_dates(n, IMMEDIATE_BATCH_BELOW, STAGGER_WINDOW_BELOW, today)
        elif key == 'at':
            # 'at' bucket is unused with new rules (all at/below → 'below')
            return _stagger_dates(n, IMMEDIATE_BATCH_AT, STAGGER_WINDOW_AT, today)
        elif key == 'above_1':
            return _stagger_dates(n, IMMEDIATE_BATCH_ABOVE_1, STAGGER_WINDOW_ABOVE_1, today)
        else:  # 'new'
            return [None] * n

    result: List[Dict] = []

    for bucket_key, items in buckets.items():
        dates = _dates_for_bucket(bucket_key)
        for (word_id, rule), review_date in zip(items, dates):
            next_review = review_date.strftime('%Y-%m-%d') if review_date else None
            interval = (review_date - today).days if review_date else None

            # Estimate a sensible starting review_count:
            #   'review' → pretend 2 past reviews (has been seen before)
            #   'learning' → 1
            #   'new' → 0
            ml = rule['mastery_level']
            review_count = {'review': 2, 'learning': 1, 'new': 0}.get(ml, 0)

            result.append({
                'word_id': word_id,
                'mastery_level': ml,
                'ease_factor': rule['ease_factor'],
                'next_review_date': next_review,
                'interval_days': interval,
                'review_count': review_count,
            })

    return result


def apply_placement_states(
    language: str,
    user_cefr_level: str,
    user_id: int = 1,
    *,
    overwrite_mastered: bool = False,
) -> Dict:
    """
    Compute and persist placement SRS states for every word in `language`.

    Parameters
    ----------
    language : str
        Language code (e.g. 'kannada').
    user_cefr_level : str
        The CEFR level returned by the placement test (e.g. 'B1').
    user_id : int
        Defaults to 1 (single-user app).
    overwrite_mastered : bool
        If True, even words already marked 'mastered' in the DB will be
        re-evaluated.  Default False — mastered words are left untouched so
        the user doesn't lose hard-won progress.

    Returns
    -------
    dict
        Summary of changes: counts per mastery_level bucket plus skipped.
    """
    states = compute_placement_states(language, user_cefr_level, user_id)

    if not states:
        return {'updated': 0, 'skipped': 0, 'by_level': {}}

    conn = sqlite3.connect(config.DB_PATH, timeout=30.0)
    cursor = conn.cursor()

    today_str = date.today().strftime('%Y-%m-%d')

    # Fetch existing states in one query to avoid N+1 round-trips
    word_ids = [s['word_id'] for s in states]
    placeholders = ','.join('?' * len(word_ids))
    cursor.execute(
        f'''SELECT word_id, mastery_level FROM word_states
            WHERE user_id = ? AND word_id IN ({placeholders})''',
        [user_id] + word_ids,
    )
    existing: Dict[int, str] = {r[0]: r[1] for r in cursor.fetchall()}

    updated = 0
    skipped = 0
    by_level: Dict[str, int] = {}

    for s in states:
        wid = s['word_id']
        current_mastery = existing.get(wid)

        # Never downgrade a mastered word unless explicitly requested
        if current_mastery == 'mastered' and not overwrite_mastered:
            skipped += 1
            continue

        ml = s['mastery_level']
        by_level[ml] = by_level.get(ml, 0) + 1

        cursor.execute(
            '''INSERT INTO word_states
                   (word_id, user_id, mastery_level, next_review_date,
                    review_count, ease_factor, last_reviewed, interval_days,
                    introduced_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(word_id, user_id) DO UPDATE SET
                   mastery_level    = excluded.mastery_level,
                   next_review_date = excluded.next_review_date,
                   review_count     = excluded.review_count,
                   ease_factor      = excluded.ease_factor,
                   last_reviewed    = excluded.last_reviewed,
                   interval_days    = excluded.interval_days,
                   introduced_date  = COALESCE(introduced_date, excluded.introduced_date)
            ''',
            (
                wid,
                user_id,
                ml,
                s['next_review_date'],
                s['review_count'],
                s['ease_factor'],
                today_str,
                s['interval_days'],
                today_str if ml != 'new' else None,
            ),
        )
        updated += 1

    conn.commit()
    conn.close()

    return {
        'updated': updated,
        'skipped': skipped,
        'by_level': by_level,
        'user_cefr_level': user_cefr_level,
        'language': language,
    }


def preview_placement_distribution(
    language: str,
    user_cefr_level: str,
) -> Dict:
    """
    Return a dry-run summary of what apply_placement_states would do
    WITHOUT writing to the database.  Useful for the UI to show the user
    a preview before committing.
    """
    states = compute_placement_states(language, user_cefr_level)

    by_mastery: Dict[str, int] = {}
    by_cefr: Dict[str, Dict[str, int]] = {}

    # We need word CEFR levels to build the by_cefr breakdown
    conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    word_ids = [s['word_id'] for s in states]
    if word_ids:
        placeholders = ','.join('?' * len(word_ids))
        cursor.execute(
            f'SELECT id, level FROM vocabulary WHERE id IN ({placeholders})',
            word_ids,
        )
        level_map: Dict[int, str] = {r['id']: (r['level'] or 'unknown').upper() for r in cursor.fetchall()}
    else:
        level_map = {}
    conn.close()

    review_date_counts: Dict[str, int] = {}

    for s in states:
        ml = s['mastery_level']
        by_mastery[ml] = by_mastery.get(ml, 0) + 1

        cefr = level_map.get(s['word_id'], 'unknown')
        if cefr not in by_cefr:
            by_cefr[cefr] = {}
        by_cefr[cefr][ml] = by_cefr[cefr].get(ml, 0) + 1

        rd = s['next_review_date']
        if rd:
            review_date_counts[rd] = review_date_counts.get(rd, 0) + 1

    # Summarise review schedule (first 14 days)
    today = date.today()
    schedule: List[Dict] = []
    for i in range(14):
        d = (today + timedelta(days=i)).strftime('%Y-%m-%d')
        schedule.append({'date': d, 'count': review_date_counts.get(d, 0)})

    return {
        'language': language,
        'user_cefr_level': user_cefr_level,
        'total_words': len(states),
        'by_mastery': by_mastery,
        'by_cefr_level': by_cefr,
        'daily_schedule_preview': schedule,
    }
