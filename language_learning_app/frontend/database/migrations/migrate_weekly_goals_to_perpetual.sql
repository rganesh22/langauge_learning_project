-- Migration: Make Weekly Goals Perpetual
-- Date: February 13, 2026
-- 
-- This migration updates the weekly_goals system to be perpetual.
-- Instead of storing goals per week, we store a "default" template
-- that applies to all future weeks until explicitly changed.
--
-- Strategy:
-- 1. Find the most recent week's goals for each language
-- 2. Copy those to a 'default' template
-- 3. Keep old week-specific goals for historical reference

-- For each language, get the most recent weekly goals and copy to 'default'
-- This makes those goals apply perpetually to all future weeks

-- Step 1: Get all unique languages
-- Step 2: For each language, copy most recent week's goals to 'default'

-- Find most recent goals for each language and copy to 'default'
INSERT OR REPLACE INTO weekly_goals (language, activity_type, day_of_week, week_start_date, target_count, created_at, updated_at)
SELECT 
    language,
    activity_type,
    day_of_week,
    'default' as week_start_date,
    target_count,
    created_at,
    datetime('now') as updated_at
FROM weekly_goals wg1
WHERE week_start_date = (
    SELECT MAX(week_start_date) 
    FROM weekly_goals wg2 
    WHERE wg2.language = wg1.language 
    AND wg2.week_start_date != 'default'
)
AND NOT EXISTS (
    SELECT 1 FROM weekly_goals wg3 
    WHERE wg3.language = wg1.language 
    AND wg3.week_start_date = 'default'
    AND wg3.day_of_week = wg1.day_of_week
    AND wg3.activity_type = wg1.activity_type
);

-- Verify the migration
SELECT 
    language,
    week_start_date,
    day_of_week,
    activity_type,
    target_count
FROM weekly_goals
WHERE week_start_date = 'default'
ORDER BY language, day_of_week, activity_type;
