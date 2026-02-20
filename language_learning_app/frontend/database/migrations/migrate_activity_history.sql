-- Migration script to update activity_history schema
-- This removes the DEFAULT CURRENT_TIMESTAMP from completed_at column

-- Step 1: Create new table with updated schema
CREATE TABLE IF NOT EXISTS activity_history_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1,
    language TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    activity_data TEXT,
    score REAL,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

-- Step 2: Copy all existing data (keep all completed_at timestamps as-is)
INSERT INTO activity_history_new (id, user_id, language, activity_type, activity_data, score, completed_at)
SELECT id, user_id, language, activity_type, activity_data, score, completed_at
FROM activity_history;

-- Step 3: Drop old table
DROP TABLE activity_history;

-- Step 4: Rename new table to original name
ALTER TABLE activity_history_new RENAME TO activity_history;

-- Verify migration
SELECT COUNT(*) as total_activities FROM activity_history;
SELECT COUNT(*) as completed_activities FROM activity_history WHERE completed_at IS NOT NULL;
