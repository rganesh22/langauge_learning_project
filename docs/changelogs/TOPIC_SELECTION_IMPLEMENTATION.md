# Topic Selection Feature Implementation

## Overview
Implemented a topic selection feature that allows users to either:
1. **Enter a custom topic** - Type their own topic (e.g., "cooking Italian food", "learning to drive")
2. **Use random topic** - Let the AI select a topic based on their interests and CEFR level

## Completed Changes

### 1. Frontend - Shared Component
**File**: `/screens/activities/shared/components/TopicSelectionModal.js` (NEW)
- Created reusable modal component for topic selection
- Two sections:
  - **Custom Topic**: Text input (200 char max) with "Use This Topic" button
  - **Random Topic**: "Pick Random Topic" button that uses AI + user interests
- Props:
  - `visible`: Boolean to show/hide modal
  - `onClose`: Callback when modal closes
  - `onSelectTopic`: Callback with selected topic (null for random)
  - `activityType`: String ('reading', 'listening', etc.)
  - `color`: Primary color for the activity type
- Loading state shows ActivityIndicator while generating

**File**: `/screens/activities/shared/components/index.js`
- Added export for `TopicSelectionModal`

### 2. Frontend - Hooks Update
**File**: `/screens/activities/shared/hooks/useActivityData.js`
- Added `customTopic` parameter to `useActivityData` hook
- Added `topic` state variable
- Updated `loadActivity` function to accept `selectedTopic` parameter
- Modified fetch call to include topic in request body:
  ```javascript
  if (topicToUse !== null) {
    fetchOptions.body = JSON.stringify({ topic: topicToUse });
  }
  ```
- Added `topic` and `setTopic` to return object

### 3. Frontend - Reading Activity (EXAMPLE)
**File**: `/screens/activities/ReadingActivity.js`
- Imported `TopicSelectionModal`
- Added state: `showTopicModal` (defaults to `true` for new activities, `false` for history)
- Added `handleTopicSelection` function that closes modal and calls `loadActivity(selectedTopic)`
- Modified `useEffect` to only auto-load if `fromHistory` is true
- Added modal to render section before closing `</View>`
- Modal closes and navigates back if user cancels without selecting

### 4. Backend - Endpoint Update (EXAMPLE: Reading)
**File**: `/backend/main.py`
- Changed `create_reading_activity` from sync to async
- Added `Request` parameter to parse JSON body
- Extract `topic` from request body: `body.get('topic')`
- Fetch user interests from database if topic is None (random):
  ```python
  user_interests = []
  if custom_topic is None:
      # Query user_preferences table for selected_interests
      user_interests = json.loads(row[0])
  ```
- Pass `custom_topic` and `user_interests` to `api_client.generate_reading_activity()`

### 5. Backend - API Client Update (EXAMPLE: Reading)
**File**: `/backend/api_client.py`
- Updated `generate_reading_activity` signature to include:
  - `custom_topic: str = None`
  - `user_interests: list = None`
- Logic for topic selection:
  - If `custom_topic` provided: use it directly
  - If `user_interests` provided: 
    - Match interests to base topics (e.g., "Food & Cooking" → "food and cooking")
    - 70% chance to pick from matching topics
    - 30% chance to pick from all topics (for variety)
  - If no interests: pick completely random from base topics
- Expanded base topics list to 23 topics (from 15)
- Added logging for topic selection method

## Implementation Status

### ✅ Completed
1. **Reading Activity** - Fully implemented (frontend + backend)

### 🔄 Remaining Work

Need to implement for 4 more activities using the same pattern:

#### 2. Listening Activity
**Files to modify**:
- `/screens/activities/ListeningActivity.js` - Add modal and topic handling (same as Reading)
- `/backend/main.py` - Update `create_listening_activity` (async, parse topic, fetch interests)
- `/backend/api_client.py` - Update `generate_listening_activity` signature and logic

**Note**: Listening uses async background generation. Need to pass topic through `generate_listening_activity_background` function.

#### 3. Writing Activity
**Files to modify**:
- `/screens/activities/WritingActivity.js` - Add modal and topic handling
- `/backend/main.py` - Update `create_writing_activity` (async, parse topic, fetch interests)
- `/backend/api_client.py` - Update `generate_writing_activity` signature and logic
  - Currently picks random topic at line ~2162
  - Add same logic as reading for custom topic + interest-based selection

#### 4. Speaking Activity
**Files to modify**:
- `/screens/activities/SpeakingActivity.js` - Add modal and topic handling
- `/backend/main.py` - Update `create_speaking_activity` (async, parse topic, fetch interests)
- `/backend/api_client.py` - Update `generate_speaking_activity` signature and logic
  - Currently picks random topic similar to writing
  - Add custom topic + interest-based selection

#### 5. Conversation Activity
**Files to modify**:
- `/screens/activities/ConversationActivity.js` - Add modal and topic handling
- `/backend/main.py` - Update `create_conversation_activity` (already async, add topic/interests)
- `/backend/api_client.py` - Update `generate_conversation_activity` signature and logic
  - Currently picks random topic at line ~2860
  - Add custom topic + interest-based selection

## Template for Remaining Activities

### Frontend Template (for each activity):
```javascript
// 1. Import TopicSelectionModal
import { TopicSelectionModal } from './shared/components';

// 2. Add state
const [showTopicModal, setShowTopicModal] = useState(!fromHistory);

// 3. Add handler
const handleTopicSelection = (selectedTopic) => {
  setShowTopicModal(false);
  activityData.loadActivity(selectedTopic);
};

// 4. Modify useEffect
useEffect(() => {
  if (fromHistory) {
    activityData.loadActivity();
  }
}, []);

// 5. Add modal before closing </View>
<TopicSelectionModal
  visible={showTopicModal}
  onClose={() => {
    setShowTopicModal(false);
    if (!activityData.activity) {
      navigation.goBack();
    }
  }}
  onSelectTopic={handleTopicSelection}
  activityType="[activity_type]"  // listening, writing, speaking, conversation
  color={colors.primary}
/>
```

### Backend main.py Template:
```python
@app.post("/api/activity/[activity_type]/{language}")
async def create_[activity_type]_activity(language: str, request: Request):
    # Parse topic from request
    body = await request.json() if request.headers.get('content-type') == 'application/json' else {}
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
    
    # ... rest of existing code ...
    
    # Pass to API client
    activity = api_client.generate_[activity_type]_activity(
        # ... existing params ...,
        custom_topic=custom_topic,
        user_interests=user_interests
    )
```

### Backend api_client.py Template:
```python
def generate_[activity_type]_activity(..., custom_topic: str = None, user_interests: list = None) -> dict:
    # Determine topic
    if custom_topic:
        selected_topic = custom_topic
        print(f"Using custom topic: {custom_topic}")
    else:
        base_topics = [
            "daily life and routines", "travel and adventure", "food and cooking",
            # ... full list of 23 topics ...
        ]
        
        if user_interests and len(user_interests) > 0:
            interest_topics = [interest.lower() for interest in user_interests]
            matching_topics = [topic for topic in base_topics if any(interest_word in topic for interest_word in interest_topics)]
            
            if matching_topics:
                if random.random() < 0.7:
                    selected_topic = random.choice(matching_topics)
                    print(f"Selected topic based on user interests: {selected_topic}")
                else:
                    selected_topic = random.choice(base_topics)
            else:
                selected_topic = random.choice(base_topics)
        else:
            selected_topic = random.choice(base_topics)
    
    # Use selected_topic in prompt
```

## User Experience Flow

1. User clicks "Start Reading" (or any activity)
2. Modal appears with two options:
   - **Custom Topic**: User types topic and clicks "Use This Topic"
   - **Random Topic**: User clicks "Pick Random Topic"
3. Modal closes, loading spinner appears
4. Backend:
   - If custom topic: use it directly in prompt
   - If random: check user's interests from profile, weight selection
5. Activity generates with chosen topic
6. User completes activity as normal

## Benefits

1. **Personalization**: Activities align with user interests
2. **Flexibility**: Users can explore specific topics they're curious about
3. **Variety**: Random selection considers 23+ different topics
4. **Engagement**: Users feel more invested when choosing their own topics
5. **Practical**: Custom topics allow practicing specific real-world scenarios

## Testing Checklist

For each activity, test:
- [ ] Modal appears for new activities
- [ ] Modal doesn't appear for history activities
- [ ] Custom topic input works (generates activity with that topic)
- [ ] Random topic works (generates with AI-selected topic)
- [ ] Cancel button navigates back if no selection
- [ ] User interests influence random topic selection
- [ ] Works without user interests (fallback to random)
- [ ] Loading state shows during generation
- [ ] Error handling if generation fails

## Notes

- **History Activities**: Topic modal is not shown when reopening from history (topic already determined)
- **Conversation Activity**: Already uses /create endpoint, just needs topic parameter added
- **Listening Activity**: Uses background tasks, ensure topic is passed through the background generation function
- **Database**: No schema changes needed, topic is not stored (it's ephemeral per activity)
- **Interests**: Stored in `user_preferences` table with key `selected_interests` (JSON array)

## Full Topic List (23 topics)

1. daily life and routines
2. travel and adventure
3. food and cooking
4. technology and modern life
5. hobbies and interests
6. work and career
7. nature and environment
8. culture and traditions
9. family and relationships
10. education and learning
11. health and wellness
12. shopping and markets
13. sports and activities
14. music and arts
15. cities and places
16. festivals and celebrations
17. weather and seasons
18. transportation
19. entertainment and media
20. science and discovery
21. history and heritage
22. art and creativity
23. business and economy
24. social issues
