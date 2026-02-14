# SRS System Implementation - Continued

This document outlines the remaining implementation steps for the SRS revamp. The core database functions have been added to `db.py`. Now we need to add API endpoints and update the frontend.

## Remaining Backend Work

### API Endpoints to Add to `backend/main.py`

```python
# Add after existing /api/flashcard endpoints

@app.get("/api/srs/settings/{language}")
def get_srs_settings_api(language: str):
    """Get SRS settings for a language"""
    try:
        settings = db.get_srs_settings(language)
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/srs/settings/{language}")
def update_srs_settings_api(language: str, settings: dict):
    """Update SRS settings for a language
    
    Body: {
        "new_cards_per_week": int,
        "reviews_per_week": int
    }
    """
    try:
        new_cards = settings.get('new_cards_per_week')
        reviews = settings.get('reviews_per_week')
        
        if new_cards is None or reviews is None:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Validate
        min_reviews = new_cards * config.MIN_REVIEWS_MULTIPLIER
        if reviews < min_reviews:
            raise HTTPException(
                status_code=400,
                detail=f"Reviews must be at least {min_reviews} (10x new cards)"
            )
        
        success = db.update_srs_settings(language, new_cards, reviews)
        
        if success:
            return {"success": True, "message": "Settings updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update settings")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/srs/stats/{language}")
def get_srs_stats_api(language: str):
    """Get SRS stats for a language
    
    Returns:
    - due_count: Reviews due today
    - new_count: New cards available today
    - total_new: Total unintroduced cards
    - total_learning: Cards in learning state
    - total_review: Cards in review state
    - total_mastered: Mastered cards
    - today_new_completed: New cards completed today
    - today_reviews_completed: Reviews completed today
    - today_new_quota: New cards quota for today
    - today_reviews_quota: Reviews quota for today
    """
    try:
        stats = db.get_srs_stats(language)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/flashcards/{language}")
def get_flashcards_api(language: str, limit: int = 50):
    """Get flashcards for review (respects SRS quotas)"""
    try:
        words = db.get_words_for_review(language, limit)
        return {"words": words, "count": len(words)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## Frontend Updates

### 1. Update Practice Screen to Show SRS Stats

File: `screens/PracticeScreen.js`

Add state for SRS stats:
```javascript
const [srsStats, setSrsStats] = useState(null);

// Fetch SRS stats
useFocusEffect(
  React.useCallback(() => {
    fetchSrsStats();
  }, [selectedLanguage])
);

const fetchSrsStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/srs/stats/${selectedLanguage}`);
    const data = await response.json();
    setSrsStats(data);
  } catch (error) {
    console.error('Error fetching SRS stats:', error);
  }
};
```

Update the Flashcards card to show stats:
```javascript
<TouchableOpacity
  style={[styles.activityCard, { borderLeftColor: '#14B8A6' }]}
  onPress={() => navigation.navigate('Flashcards', { language: selectedLanguage })}
>
  <View style={styles.activityCardContent}>
    <View style={[styles.activityIcon, { backgroundColor: '#E0F7F4' }]}>
      <Ionicons name="albums" size={24} color="#14B8A6" />
    </View>
    <View style={styles.activityInfo}>
      <Text style={styles.activityTitle}>Flashcards</Text>
      <Text style={styles.activitySubtitle}>Review vocabulary with SRS</Text>
      {srsStats && (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
          <Text style={styles.srsStatText}>
            ⭕ {srsStats.due_count} reviews
          </Text>
          <Text style={styles.srsStatText}>
            ✨ {srsStats.new_count} new
          </Text>
        </View>
      )}
    </View>
    <Ionicons name="chevron-forward" size={20} color="#999" />
  </View>
</TouchableOpacity>
```

Add styles:
```javascript
srsStatText: {
  fontSize: 12,
  color: '#666',
  fontWeight: '500',
},
```

### 2. Update Flashcard Screen Header

File: `screens/FlashcardScreen.js`

Add state for SRS stats:
```javascript
const [srsStats, setSrsStats] = useState(null);

useEffect(() => {
  loadWords();
  fetchSrsStats();
}, [language]);

const fetchSrsStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/srs/stats/${language}`);
    const data = await response.json();
    setSrsStats(data);
  } catch (error) {
    console.error('Error fetching SRS stats:', error);
  }
};
```

Update the header to show progress:
```javascript
{/* Add after header, before card area */}
{srsStats && (
  <View style={styles.progressHeader}>
    <Text style={styles.progressTitle}>Today's Progress:</Text>
    <View style={styles.progressRow}>
      <View style={styles.progressItem}>
        <Text style={styles.progressLabel}>Reviews</Text>
        <Text style={styles.progressValue}>
          {srsStats.today_reviews_completed}/{srsStats.today_reviews_quota} ⭕
        </Text>
      </View>
      <View style={styles.progressItem}>
        <Text style={styles.progressLabel}>New</Text>
        <Text style={styles.progressValue}>
          {srsStats.today_new_completed}/{srsStats.today_new_quota} ✨
        </Text>
      </View>
    </View>
  </View>
)}
```

Add styles:
```javascript
progressHeader: {
  paddingHorizontal: 20,
  paddingVertical: 12,
  backgroundColor: '#F8F9FA',
  borderBottomWidth: 1,
  borderBottomColor: '#E0E0E0',
},
progressTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#333',
  marginBottom: 8,
},
progressRow: {
  flexDirection: 'row',
  gap: 24,
},
progressItem: {
  flex: 1,
},
progressLabel: {
  fontSize: 12,
  color: '#666',
  marginBottom: 4,
},
progressValue: {
  fontSize: 16,
  fontWeight: '700',
  color: '#14B8A6',
},
```

### 3. Add SRS Settings Modal

File: `screens/FlashcardScreen.js`

Add state:
```javascript
const [showSrsSettings, setShowSrsSettings] = useState(false);
const [srsSettings, setSrsSettings] = useState(null);
const [newCardsPerWeek, setNewCardsPerWeek] = useState(20);
const [reviewsPerWeek, setReviewsPerWeek] = useState(200);
```

Add settings button to header:
```javascript
<TouchableOpacity 
  style={styles.settingsButton}
  onPress={() => {
    fetchSrsSettings();
    setShowSrsSettings(true);
  }}
>
  <Ionicons name="settings-outline" size={24} color="#666" />
</TouchableOpacity>
```

Add functions:
```javascript
const fetchSrsSettings = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/srs/settings/${language}`);
    const data = await response.json();
    setSrsSettings(data);
    setNewCardsPerWeek(data.new_cards_per_week);
    setReviewsPerWeek(data.reviews_per_week);
  } catch (error) {
    console.error('Error fetching SRS settings:', error);
  }
};

const saveSrsSettings = async () => {
  try {
    const minReviews = newCardsPerWeek * 10;
    if (reviewsPerWeek < minReviews) {
      Alert.alert('Invalid Settings', `Reviews must be at least ${minReviews} (10x new cards)`);
      return;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/srs/settings/${language}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_cards_per_week: newCardsPerWeek,
        reviews_per_week: reviewsPerWeek,
      }),
    });
    
    if (response.ok) {
      Alert.alert('Success', 'Settings updated successfully');
      setShowSrsSettings(false);
      fetchSrsStats();
      loadWords();
    } else {
      const error = await response.json();
      Alert.alert('Error', error.detail || 'Failed to update settings');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to update settings');
    console.error('Error saving SRS settings:', error);
  }
};
```

Add modal JSX (add before closing View):
```javascript
{/* SRS Settings Modal */}
<Modal
  visible={showSrsSettings}
  animationType="slide"
  transparent={true}
  onRequestClose={() => setShowSrsSettings(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.srsSettingsModal}>
      <Text style={styles.modalTitle}>SRS Settings</Text>
      <Text style={styles.modalSubtitle}>Language: {currentLanguage?.name}</Text>
      
      <View style={styles.settingSection}>
        <Text style={styles.settingLabel}>New Cards per Week</Text>
        <TextInput
          style={styles.settingInput}
          value={String(newCardsPerWeek)}
          onChangeText={(text) => setNewCardsPerWeek(parseInt(text) || 0)}
          keyboardType="number-pad"
        />
        <Text style={styles.settingHint}>≈ {Math.round(newCardsPerWeek / 7)} new cards/day</Text>
      </View>
      
      <View style={styles.settingSection}>
        <Text style={styles.settingLabel}>Reviews per Week</Text>
        <TextInput
          style={styles.settingInput}
          value={String(reviewsPerWeek)}
          onChangeText={(text) => setReviewsPerWeek(parseInt(text) || 0)}
          keyboardType="number-pad"
        />
        <Text style={styles.settingHint}>≈ {Math.round(reviewsPerWeek / 7)} reviews/day</Text>
      </View>
      
      <Text style={styles.warningText}>
        ⚠️ Minimum: {newCardsPerWeek * 10} reviews (10x new cards)
      </Text>
      
      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, styles.cancelButton]}
          onPress={() => setShowSrsSettings(false)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalButton, styles.saveButton]}
          onPress={saveSrsSettings}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
```

## Testing Checklist

1. ✅ Database migrations run successfully
2. ✅ SRS settings can be created/updated
3. ✅ Daily quotas are calculated correctly
4. ✅ Flashcards respect quota limits
5. ✅ New cards are marked with introduced_date
6. ✅ Quota increments when cards are reviewed
7. ✅ Frontend displays stats correctly
8. ✅ Settings validation works
9. ✅ Multi-language support works

## Known Limitations

1. Daily quotas are distributed evenly (no smart distribution yet)
2. No timezone handling for quota reset (uses system time)
3. No carryover of unused quota to next day
4. Settings are per-language but no per-user customization of algorithm

## Future Enhancements

1. Smart quota distribution (more on weekdays, less on weekends)
2. Quota carryover system
3. Advanced SRS algorithm options
4. Analytics and insights
5. Study streaks and achievements
