# Testing Checklist - Goal-Based Streak & SRS UI

## ✅ Pre-Implementation Tests (Completed)

### Backend Verification
- [x] Streak endpoint responds: `GET /api/streak`
- [x] SRS settings endpoint responds: `GET /api/srs/settings/{language}`
- [x] Both endpoints return valid JSON
- [x] Backend running on port 5001

### Code Quality
- [x] ProfileScreen.js has no syntax errors
- [x] All imports are valid
- [x] All styles are properly defined
- [x] State management is correct

---

## 🧪 Post-Implementation Tests (To Do)

### Streak Functionality
1. [ ] **Initial Load**
   - Open ProfileScreen
   - Verify streak shows "0 Days" initially
   - No checkmark should show (today not complete)
   - Best streak not shown if 0

2. [ ] **Complete Daily Goals**
   - Go to DashboardScreen
   - View today's goals
   - Complete ALL activities for today
   - Return to ProfileScreen
   - Verify checkmark (✓) appears next to streak
   - Streak should increment to 1

3. [ ] **Multi-Day Streak**
   - Complete goals for 3-4 consecutive days
   - Verify streak increments each day
   - Checkmark should appear each day goals are met
   - If you miss goals, streak should reset

4. [ ] **Longest Streak**
   - Build a streak of 5+ days
   - Break the streak (miss a day)
   - Verify "Best: 5" appears when current < longest

5. [ ] **Edge Cases**
   - Try viewing before midnight (today incomplete)
   - Complete goals and verify checkmark appears
   - View after midnight (new day, goals reset)

### SRS Configuration Functionality

6. [ ] **Language Selector**
   - Open Review Scheduling section
   - Verify all learning languages appear as chips
   - Click different language chips
   - Verify active chip is highlighted
   - Verify settings load for each language

7. [ ] **New Cards Input**
   - Click + button to increase
   - Click - button to decrease
   - Type directly in input field
   - Verify can't go below 0
   - Verify daily average shown (~X per day)

8. [ ] **Reviews Input**
   - Click + button to increase
   - Click - button to decrease
   - Type directly in input field
   - Verify minimum validation message updates

9. [ ] **Validation**
   - Set new cards to 100
   - Try to set reviews to 500 (< 10x)
   - Click Save
   - Verify validation alert appears
   - Message should say "must be at least 1000"
   - Cancel and fix the value

10. [ ] **Save Settings**
    - Set valid values (e.g., 70 new, 700 reviews)
    - Click Save Settings
    - Verify success alert appears
    - Reload page
    - Verify settings persist

11. [ ] **SRS Stats Display**
    - Verify "Learning" count shows correctly
    - Verify "Mastered" count shows correctly
    - Verify "Due Today" count shows correctly
    - Complete some flashcards
    - Return and verify counts updated

12. [ ] **Per-Language Settings**
    - Configure Kannada: 70 new, 700 reviews
    - Save
    - Switch to Tamil
    - Configure Tamil: 50 new, 500 reviews
    - Save
    - Switch back to Kannada
    - Verify Kannada settings retained (70/700)

### Visual/UI Tests

13. [ ] **Streak Display**
    - Flame icon (🔥) shows correctly
    - Text is readable and properly sized
    - Checkmark appears aligned correctly
    - "Best: X" text is subtle but visible
    - Layout doesn't break on small screens

14. [ ] **SRS Language Chips**
    - Chips wrap properly on small screens
    - Active chip has blue border/background
    - Urdu text displays in Nastaliq font
    - Text is centered in chips

15. [ ] **SRS Input Controls**
    - +/- buttons are touchable (44x44 minimum)
    - Input field is centered and readable
    - Input accepts keyboard input
    - Validation note is visible

16. [ ] **SRS Stats Cards**
    - Icons display correctly
    - Numbers are large and readable
    - Labels are clear
    - Cards align properly in grid

### Integration Tests

17. [ ] **Navigation Flow**
    - ProfileScreen → DashboardScreen → Complete activity
    - Return to ProfileScreen
    - Verify streak updates

18. [ ] **Multi-Language Flow**
    - Select Kannada in ProfileScreen language selector
    - Configure SRS for Kannada
    - Switch to Tamil
    - Do activity in Tamil
    - Return to profile, switch to Tamil in SRS
    - Verify Tamil stats updated

19. [ ] **Data Persistence**
    - Configure SRS settings
    - Close app completely
    - Reopen app
    - Navigate to ProfileScreen
    - Verify settings persist

20. [ ] **Error Handling**
    - Disconnect from backend (kill uvicorn)
    - Try to load ProfileScreen
    - Verify graceful degradation (shows 0s, no crashes)
    - Reconnect backend
    - Pull to refresh
    - Verify data loads

---

## 🐛 Known Issues to Watch For

### Potential Issues
- [ ] Streak not updating immediately after completing activities
  - **Fix**: Ensure `loadStreak()` is called in `loadProfile()`
  
- [ ] SRS stats showing 0 when they shouldn't
  - **Fix**: Check that stats endpoint returns correct data
  
- [ ] Validation not preventing invalid saves
  - **Fix**: Ensure `reviewsPerWeek < minReviews` check works
  
- [ ] Language selector not loading available languages
  - **Fix**: Verify `availableLanguages` from context is populated

### Performance Issues
- [ ] Slow loading on ProfileScreen
  - **Check**: Multiple API calls loading in parallel?
  - **Fix**: Ensure Promise.all used for concurrent requests
  
- [ ] UI lag when typing in SRS inputs
  - **Check**: Re-renders on every keystroke?
  - **Fix**: Debounce if needed (current implementation should be fine)

---

## 📊 Success Criteria

### Streak Feature
- ✅ Accurately tracks consecutive days of goal completion
- ✅ Shows today's completion status
- ✅ Displays longest streak when different from current
- ✅ Updates automatically on profile load

### SRS Feature
- ✅ Per-language configuration works
- ✅ Numeric inputs are intuitive
- ✅ Validation prevents invalid settings
- ✅ Stats display current learning progress
- ✅ Settings persist across sessions
- ✅ UI is clean and uncluttered

### Overall
- ✅ No crashes or errors
- ✅ Smooth user experience
- ✅ Fast loading times
- ✅ Responsive on all screen sizes
- ✅ Accessible and intuitive

---

## 🔧 Testing Commands

### Backend Health Check
```bash
# Check if backend is running
curl http://localhost:5001/health

# Test streak endpoint
curl http://localhost:5001/api/streak | python3 -m json.tool

# Test SRS endpoint for each language
curl http://localhost:5001/api/srs/settings/kannada | python3 -m json.tool
curl http://localhost:5001/api/srs/settings/tamil | python3 -m json.tool
curl http://localhost:5001/api/srs/settings/telugu | python3 -m json.tool
```

### Database Verification
```bash
# Check streak calculation
sqlite3 backend/fluo.db "
SELECT 
  date,
  COUNT(*) as goals,
  SUM(CASE WHEN completed >= target THEN 1 ELSE 0 END) as completed
FROM (
  SELECT 
    DATE(wg.day_of_week) as date,
    wg.target_count as target,
    COUNT(ah.id) as completed
  FROM weekly_goals wg
  LEFT JOIN activity_history ah 
    ON ah.language = wg.language 
    AND ah.activity_type = wg.activity_type
    AND DATE(ah.completed_at) = DATE(wg.day_of_week)
  WHERE wg.user_id = 1
  GROUP BY wg.language, wg.activity_type, wg.day_of_week
)
GROUP BY date
ORDER BY date DESC
LIMIT 30;
"

# Check SRS settings
sqlite3 backend/fluo.db "
SELECT language, new_cards_per_week, reviews_per_week 
FROM srs_settings 
WHERE user_id = 1;
"
```

### React Native Logs
```bash
# Watch Metro logs
tail -f metro.log

# Watch backend logs
tail -f backend_uvicorn.log

# Clear cache if issues
rm -rf node_modules/.cache
```

---

## ✅ Sign-Off

### Developer Testing
- [ ] All unit functionality verified
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Edge cases handled

### Code Review
- [ ] Code follows project patterns
- [ ] No unnecessary complexity
- [ ] Comments where needed
- [ ] No TODOs left

### Documentation
- [x] Implementation documented (IMPLEMENTATION_COMPLETE.md)
- [x] UI changes documented (UI_BEFORE_AFTER.md)
- [x] Testing checklist created (this file)

---

**Ready for User Testing**: Once all checkboxes above are completed ✅
