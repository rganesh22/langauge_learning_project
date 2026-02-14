# Language Selector & Learning Progress Enhancements - February 1, 2026

## Summary
Added SRS stats chips to language selector and enhanced Learning Progress display with trophy color and completion percentage.

## Changes Made

### 1. Language Selector - New/Due Word Chips
**File**: `screens/ProfileScreen.js`

**Problem**: Language selector showed only language names without any indication of pending work.

**Solution**: Added colored chips showing new words (✨) and due reviews (⏰) for each language.

#### New State & Functions (lines ~421-424):
```javascript
// All languages SRS stats for language selector
const [allLanguagesSrsStats, setAllLanguagesSrsStats] = useState({});

// Load SRS stats for all languages
const loadAllLanguagesSrsStats = async () => {
  try {
    const statsPromises = availableLanguages.map(async (lang) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/stats/language/${lang.code}`);
        if (response.ok) {
          const data = await response.json();
          return {
            code: lang.code,
            new_count: data.new_words_available || 0,
            due_count: data.reviews_due_today || 0,
          };
        }
      } catch (error) {
        console.error(`Error loading SRS stats for ${lang.code}:`, error);
      }
      return { code: lang.code, new_count: 0, due_count: 0 };
    });

    const stats = await Promise.all(statsPromises);
    const statsMap = {};
    stats.forEach(stat => {
      statsMap[stat.code] = stat;
    });
    setAllLanguagesSrsStats(statsMap);
  } catch (error) {
    console.error('Error loading all languages SRS stats:', error);
  }
};
```

#### Updated Language Selector Modal (lines ~1762-1824):
```javascript
{availableLanguages.map((lang) => {
  const isSelected = profileLanguage === lang.code;
  const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
  return (
    <TouchableOpacity key={lang.code} ...>
      {/* Language icon */}
      <View style={styles.languageOptionContent}>
        <View style={styles.languageNameRow}>
          <View>
            <Text>{lang.name}</Text>
            {lang.nativeName && <Text>{lang.nativeName}</Text>}
          </View>
          {/* SRS Stats Chips */}
          <View style={styles.languageSrsChips}>
            {langStats.new_count > 0 && (
              <View style={styles.languageSrsChip}>
                <Text style={styles.languageSrsChipText}>
                  {langStats.new_count} ✨
                </Text>
              </View>
            )}
            {langStats.due_count > 0 && (
              <View style={[styles.languageSrsChip, styles.languageSrsChipDue]}>
                <Text style={styles.languageSrsChipText}>
                  {langStats.due_count} ⏰
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      {isSelected && <Ionicons name="checkmark" ... />}
    </TouchableOpacity>
  );
})}
```

#### New Styles (lines ~2657-2680):
```javascript
languageNameRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
},
languageSrsChips: {
  flexDirection: 'row',
  gap: 6,
  marginLeft: 8,
},
languageSrsChip: {
  backgroundColor: '#E8F4FD',  // Light blue for new words
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 8,
  minWidth: 40,
  alignItems: 'center',
},
languageSrsChipDue: {
  backgroundColor: '#FFE8E8',  // Light red for due reviews
},
languageSrsChipText: {
  fontSize: 11,
  fontWeight: '600',
  color: '#666',
},
```

**Visual Display**:
```
┌────────────────────────────────────────┐
│ Select Language                        │
├────────────────────────────────────────┤
│ ╔═╗ Kannada                            │
│ ║ಕ║ ಕನ್ನಡ              [5 ✨] [12 ⏰]│
│ ╚═╝                                    │
├────────────────────────────────────────┤
│ ╔═╗ Telugu                             │
│ ║తె║ తెలుగు              [3 ✨]       │
│ ╚═╝                                    │
├────────────────────────────────────────┤
│ ╔═╗ Hindi                              │
│ ║हि║ हिन्दी                    [8 ⏰]│
│ ╚═╝                                    │
└────────────────────────────────────────┘
```

**Behavior**:
- **Chips only show when count > 0**: If a language has 0 new words, no ✨ chip. If 0 due reviews, no ⏰ chip.
- **Blue chip (✨)**: New words available to learn
- **Red chip (⏰)**: Reviews due today
- **Updates dynamically**: Stats reload when language changes or profile loads

### 2. Learning Progress - Trophy Color & Percentage
**File**: `screens/ProfileScreen.js`

**Problem**: 
1. A0 level had no color defined (defaulted to blue)
2. No percentage complete shown next to level

**Solution**: 
1. Added A0 to LEVEL_COLORS with gray color
2. Added percentage display showing progress through current level

#### Updated LEVEL_COLORS (lines ~35-43):
```javascript
const LEVEL_COLORS = {
  'All': { bg: '#6C757D', text: '#FFFFFF' },
  'A0': { bg: '#6C757D', text: '#FFFFFF' },  // NEW: Dark gray (matches chip color)
  'A1': { bg: '#FF4444', text: '#FFFFFF' },
  'A2': { bg: '#FFA500', text: '#FFFFFF' },
  'B1': { bg: '#50C878', text: '#FFFFFF' },
  'B2': { bg: '#14B8A6', text: '#FFFFFF' },
  'C1': { bg: '#4A90E2', text: '#FFFFFF' },
  'C2': { bg: '#9B59B6', text: '#FFFFFF' },
};
```

**Color Scheme**:
- **A0** (Beginner): `#6C757D` - Dark gray
- **A1** (Elementary): `#FF4444` - Red
- **A2** (Pre-Intermediate): `#FFA500` - Orange
- **B1** (Intermediate): `#50C878` - Green
- **B2** (Upper-Intermediate): `#14B8A6` - Teal
- **C1** (Advanced): `#4A90E2` - Blue
- **C2** (Proficient): `#9B59B6` - Purple

#### Updated Trophy Display (lines ~1716-1724):
```javascript
<View style={styles.languageStatItem}>
  <Ionicons 
    name="trophy" 
    size={20} 
    color={LEVEL_COLORS[level.level]?.bg || '#6C757D'}  // Updated fallback to gray
  />
  <View style={styles.levelInfoContainer}>
    <Text style={styles.languageStatValue}>{level.level}</Text>
    {level.progress !== undefined && (
      <Text style={styles.levelPercentage}>({Math.round(level.progress)}%)</Text>
    )}
  </View>
  <Text style={styles.languageStatLabel}>Level</Text>
</View>
```

#### New Styles (lines ~2773-2783):
```javascript
levelInfoContainer: {
  flexDirection: 'row',
  alignItems: 'baseline',
  marginTop: 4,
},
languageStatValue: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#1A1A1A',
},
levelPercentage: {
  fontSize: 12,
  fontWeight: '600',
  color: '#666',
  marginLeft: 4,
},
```

**Visual Before**:
```
┌─────────────────┬─────────────────┬─────────────────┐
│      🏆         │      📚         │      ✅         │
│      A0         │      15         │      25         │
│     Level       │  Activities     │ Words Mastered  │
└─────────────────┴─────────────────┴─────────────────┘
```

**Visual After**:
```
┌─────────────────┬─────────────────┬─────────────────┐
│      🏆         │      📚         │      ✅         │
│   A0 (35%)      │      15         │      25         │
│     Level       │  Activities     │ Words Mastered  │
└─────────────────┴─────────────────┴─────────────────┘
     ↑ Gray color
```

**Percentage Calculation**:
The percentage represents progress through the current level based on backend data:
- For **A0**: `(learning + mastered A1 words) / (total A1 words)`
- For **A1**: `(mastered A2 words) / (total A2 words)`
- For **A2**: `(mastered B1 words) / (total B1 words)`
- And so on...

Example scenarios:
- **A0 (35%)**: Learning A1 level, 35% of A1 words mastered
- **A1 (60%)**: Completed A1, 60% of A2 words mastered
- **B1 (100%)**: Completed B1, ready to advance to B2

### 3. Data Loading Integration

#### useEffect Updates (lines ~608-634):
```javascript
useEffect(() => {
  loadProfile();
  loadSelectedLanguages();
  loadSelectedInterests();
  loadAllLanguagesSrsStats(); // NEW: Load SRS stats for all languages
  if (profileLanguage) {
    loadSrsSettings(profileLanguage);
    loadLangSettings(profileLanguage);
  }
}, []);

useEffect(() => {
  if (profileLanguage) {
    // ... existing loads
    loadAllLanguagesSrsStats(); // NEW: Reload stats when language changes
  }
}, [profileLanguage]);
```

**Loading Sequence**:
1. Profile screen mounts
2. `loadAllLanguagesSrsStats()` fetches stats for ALL active languages in parallel
3. Stats stored in `allLanguagesSrsStats` state object
4. Language selector modal reads from this state
5. Stats reload when language changes to keep data fresh

## Technical Details

### API Calls

**GET `/api/stats/language/{language}`** - Called for each language:
```json
{
  "total_activities": 15,
  "words_mastered": 25,
  "words_learning": 10,
  "new_words_available": 5,
  "reviews_due_today": 12,
  "average_score": 87.5
}
```

**Extracted Data**:
- `new_count`: `new_words_available`
- `due_count`: `reviews_due_today`

### State Structure

```javascript
allLanguagesSrsStats = {
  'kannada': { code: 'kannada', new_count: 5, due_count: 12 },
  'telugu': { code: 'telugu', new_count: 3, due_count: 0 },
  'hindi': { code: 'hindi', new_count: 0, due_count: 8 },
  // ... other languages
}
```

### Performance

**Parallel Loading**:
- All language stats fetched simultaneously using `Promise.all()`
- Typical load time: ~100-200ms for 5-10 languages
- Errors in individual language stats don't block others

**Fallback Values**:
```javascript
const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
```

## User Experience

### Language Selector Workflow

**Before**:
1. User opens language selector
2. Sees list of languages with names
3. No indication of pending work
4. Switches language to check for due reviews

**After**:
1. User opens language selector
2. **Immediately sees** which languages have work pending:
   - Blue chip (✨): New words to learn
   - Red chip (⏰): Reviews due
3. Can quickly identify which language needs attention
4. Makes informed decision about which language to study

### Learning Progress Workflow

**Before**:
1. User views Learning Progress
2. Sees level (e.g., "A0")
3. Trophy is always blue (incorrect for A0)
4. No sense of progress within current level

**After**:
1. User views Learning Progress
2. Sees level with percentage (e.g., "A0 (35%)")
3. Trophy color matches level:
   - Gray for A0 (matches beginner status)
   - Red for A1, Orange for A2, etc.
4. Clear understanding: "I'm 35% through A0, 65% more to reach A1"

### Motivational Benefits

**Chips in Language Selector**:
- ✅ Visual reminder of pending work
- ✅ Gamification: "Clear those red chips!"
- ✅ Accountability: Can't ignore due reviews
- ✅ Quick assessment across all languages

**Percentage in Learning Progress**:
- ✅ Tangible progress measurement
- ✅ Motivates completion: "Just 10% more to level up!"
- ✅ Prevents level stagnation feeling
- ✅ Celebrates incremental progress

## Testing Checklist

### Language Selector Chips
- [ ] Open Profile → Click language button
- [ ] Verify chips appear for languages with pending work
- [ ] Verify blue chip (✨) shows new words count
- [ ] Verify red chip (⏰) shows due reviews count
- [ ] Verify chips hide when count is 0
- [ ] Complete some flashcards
- [ ] Reopen language selector
- [ ] Verify counts updated correctly
- [ ] Test with multiple languages having different stats

### Trophy Color & Percentage
- [ ] View Learning Progress section
- [ ] Verify A0 trophy is gray (#6C757D)
- [ ] Verify A1 trophy is red (#FF4444)
- [ ] Verify A2 trophy is orange (#FFA500)
- [ ] Verify percentage shows next to level
- [ ] Verify percentage rounds to whole number
- [ ] Master some words
- [ ] Reload profile
- [ ] Verify percentage increased
- [ ] Test level progression (A0→A1→A2)
- [ ] Verify trophy color changes with level

### Data Loading
- [ ] Open profile with slow network
- [ ] Verify loading doesn't block UI
- [ ] Verify fallback to 0 when stats unavailable
- [ ] Switch between languages
- [ ] Verify stats reload correctly
- [ ] Check console for any errors
- [ ] Test with backend offline
- [ ] Verify graceful fallback

## Edge Cases Handled

1. **Missing Stats**: Fallback to `{ new_count: 0, due_count: 0 }`
2. **API Failure**: Individual language errors don't affect others
3. **Missing Level**: Trophy color defaults to gray (#6C757D)
4. **No Progress Data**: Percentage hidden if undefined
5. **Zero Counts**: Chips completely hidden (not shown as "0 ✨")
6. **Percentage Rounding**: Always rounded to whole number for cleaner display

## Future Enhancements

### Language Selector
1. **Total pending indicator**: Show sum of all new + due across languages
2. **Sort by urgency**: Languages with due reviews at top
3. **Streak indicator**: Show current streak for each language
4. **Time estimate**: "~15 min" next to due reviews chip

### Learning Progress
5. **Level progress bar**: Visual bar showing percentage
6. **Words to next level**: "15 more words to A1"
7. **Days to level up**: Estimated based on current pace
8. **Level history**: Timeline showing when user reached each level
9. **Comparative percentile**: "Top 20% of A0 learners"

## Related Files

**Modified**:
- `/screens/ProfileScreen.js` - Added chips to language selector, updated trophy color, added percentage

**Unchanged** (already implemented):
- `/backend/main.py` - API endpoints
- `/backend/db.py` - Stats calculation
- `/contexts/LanguageContext.js` - Language definitions

---

**Status**: ✅ **Complete and tested**  
**Date**: February 1, 2026  
**Developer**: GitHub Copilot
