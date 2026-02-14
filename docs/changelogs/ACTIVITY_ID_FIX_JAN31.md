# Activity Completion ID Type Mismatch Fix

**Date**: January 31, 2026

## Problem

When completing listening, reading, and translation activities, the app was throwing a 422 error:

```
POST http://localhost:5001/api/activity/complete 422 (Unprocessable Content)

{"detail":[{"type":"int_parsing","loc":["body","activity_id"],"msg":"Input should be a valid integer, unable to parse string as an integer","input":"a85295a8-c146-43b4-a2e4-31627da56ee6"}]}
```

## Root Cause

The issue was a type mismatch between what the frontend was sending and what the backend expected:

1. **Backend expectation**: The `/api/activity/complete` endpoint expects `activity_id` to be an `Optional[int]` (database row ID)

2. **Frontend was sending**: The frontend was sending either:
   - `sessionId` (a UUID string like "a85295a8-c146-43b4-a2e4-31627da56ee6")
   - `activity.id` (undefined or incorrect field)

3. **Missing field**: The backend was setting `activity['activity_id']` with the database integer ID, but the frontend was looking for `activity.id` or using `sessionId`

## Fix Applied

### Backend Changes (`backend/main.py`)

1. **Reading Activity** (lines ~530):
   - Now captures the returned `activity_id` from `db.log_activity()`
   - Stores it in `activity['activity_id']`

2. **Translation Activity** (lines ~1151):
   - Now captures the returned `activity_id` from `db.log_activity()`
   - Stores it in `activity['activity_id']`

3. **Listening Activity** (line ~685):
   - Already correctly stores `activity['activity_id']` ✓

### Frontend Changes

1. **ListeningActivity.js** (line ~593):
   ```javascript
   // Before:
   activityId: activityData.sessionId || activityData.id
   
   // After:
   activityId: activityData.activity?.activity_id || null
   ```

2. **ReadingActivity.js** (line ~209):
   ```javascript
   // Before:
   activityId: activityData.sessionId || activityData.id
   
   // After:
   activityId: activityData.activity?.activity_id || null
   ```

3. **TranslationActivity.js** (line ~261):
   ```javascript
   // Before:
   activityId: activityData.activity.id
   
   // After:
   activityId: activityData.activity?.activity_id || null
   ```

## Data Flow

1. **Activity Generation**:
   - Backend generates activity
   - Backend saves to database with `db.log_activity()` → returns integer ID
   - Backend stores ID in `activity['activity_id']`
   - Frontend receives activity with `activity_id` field

2. **Activity Completion**:
   - Frontend submits completion with `activityId: activity.activity_id`
   - Backend receives integer ID (or null)
   - Backend updates existing activity record via `db.update_activity_score()`

## Files Modified

### Backend
- `backend/main.py` (3 changes)

### Frontend
- `screens/activities/ListeningActivity.js`
- `screens/activities/ReadingActivity.js`
- `screens/activities/TranslationActivity.js`

## Testing

### Backend Tests (API Endpoint)

✅ **Test 1: With null activity_id**
```bash
curl -X POST http://localhost:5001/api/activity/complete \
  -H "Content-Type: application/json" \
  -d '{"language":"kannada","activity_type":"listening","score":0.8,"word_updates":[],"activity_data":{"test":"data"},"activity_id":null}'
```
Result: `{"success":true,"message":"Activity completed"}`

✅ **Test 2: With integer activity_id**
```bash
curl -X POST http://localhost:5001/api/activity/complete \
  -H "Content-Type: application/json" \
  -d '{"language":"kannada","activity_type":"listening","score":0.85,"word_updates":[],"activity_data":{"test":"data"},"activity_id":123}'
```
Result: `{"success":true,"message":"Activity completed"}`

❌ **Test 3: With UUID string (should reject)**
```bash
curl -X POST http://localhost:5001/api/activity/complete \
  -H "Content-Type: application/json" \
  -d '{"language":"kannada","activity_type":"listening","score":0.85,"word_updates":[],"activity_data":{"test":"data"},"activity_id":"a85295a8-c146-43b4-a2e4-31627da56ee6"}'
```
Result: `{"detail":[{"type":"int_parsing","loc":["body","activity_id"],"msg":"Input should be a valid integer, unable to parse string as an integer","input":"a85295a8-c146-43b4-a2e4-31627da56ee6"}]}`
(This is the expected rejection - UUID strings are not valid)

### Frontend Tests

Test by completing activities in the app:
1. **Listening Activity**:
   - Start a listening activity
   - Wait for generation to complete
   - Answer questions
   - Submit results
   - Should see "✓ Activity completed and logged successfully" (no 422 error)

2. **Reading Activity**:
   - Start a reading activity
   - Answer questions
   - Submit results
   - Should complete without errors

3. **Translation Activity**:
   - Start a translation activity
   - Translate sentences
   - Submit results
   - Should complete without errors

## Notes

- `sessionId` is still used for tracking SSE progress during generation, but should NOT be used as the database activity ID
- `activityId` being `null` is acceptable - it means a new activity record will be created on completion
- Only listening, reading, and translation activities pre-save to the database during generation
- Writing and speaking activities save only on completion (which is fine since they don't have the same completion flow)
