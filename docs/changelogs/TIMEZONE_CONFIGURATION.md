# Timezone Configuration

## Overview
The app now uses timezone-aware datetime handling to ensure all activity timestamps, weekly goals, and progress tracking reflect your local timezone instead of server time (UTC).

## Configuration

### Backend Timezone Settings

Edit `/backend/config.py` to set your timezone:

```python
# Timezone Configuration
TIMEZONE_OFFSET_HOURS = -8  # Change this to your timezone offset from UTC
```

### Common Timezone Offsets

| Timezone | Offset | Example Cities |
|----------|--------|----------------|
| US Pacific (PST) | -8 | Los Angeles, San Francisco |
| US Pacific (PDT) | -7 | Los Angeles, San Francisco (Daylight Saving) |
| US Mountain (MST) | -7 | Denver, Phoenix |
| US Mountain (MDT) | -6 | Denver (Daylight Saving) |
| US Central (CST) | -6 | Chicago, Dallas |
| US Central (CDT) | -5 | Chicago, Dallas (Daylight Saving) |
| US Eastern (EST) | -5 | New York, Miami |
| US Eastern (EDT) | -4 | New York, Miami (Daylight Saving) |
| India (IST) | +5.5 | Mumbai, Delhi, Bangalore |
| UK (GMT) | 0 | London |
| UK (BST) | +1 | London (Daylight Saving) |
| Europe Central (CET) | +1 | Paris, Berlin, Rome |
| Europe Central (CEST) | +2 | Paris, Berlin, Rome (Daylight Saving) |
| Australia Eastern (AEST) | +10 | Sydney, Melbourne |
| Japan (JST) | +9 | Tokyo |
| China (CST) | +8 | Beijing, Shanghai |

### How to Update Your Timezone

1. Open `/backend/config.py`
2. Find the line: `TIMEZONE_OFFSET_HOURS = -8`
3. Change `-8` to your timezone offset (use the table above)
4. Save the file
5. Restart the backend server

## What's Affected

The timezone configuration affects:

- **Activity completion timestamps** - When you complete activities
- **Weekly goals** - Which day of the week it is for goal tracking
- **Dashboard stats** - Daily and weekly progress calculations
- **Activity history** - When activities were completed
- **Conversation timestamps** - When conversation messages were sent
- **Rating timestamps** - When activities were rated

## Technical Details

### Backend Changes

1. **config.py** - Added timezone configuration and utility functions:
   - `APP_TIMEZONE`: The configured timezone object
   - `get_current_time()`: Returns current datetime in app timezone
   - `get_current_date_str()`: Returns current date as 'YYYY-MM-DD' string

2. **main.py** - Updated all `datetime.now()` calls to `config.get_current_time()`

3. **websocket_conversation.py** - Updated WebSocket timestamps

### Database Considerations

- Existing timestamps in the database remain unchanged
- New timestamps will use the configured timezone
- For consistent reporting, it's best to set the timezone once and keep it consistent

## Troubleshooting

### Activities showing wrong dates
- Check that `TIMEZONE_OFFSET_HOURS` in config.py matches your timezone
- Restart the backend after changing the configuration

### Weekly goals on wrong day
- Verify your timezone offset is correct
- The week starts on Monday in your local timezone

### Timestamps in API responses
- All timestamps are returned in ISO 8601 format
- They include timezone information (e.g., `2026-01-29T10:30:00-08:00`)

## Notes

- **Daylight Saving Time**: Currently the app uses a fixed offset. If your region observes DST, you'll need to manually update the offset when DST starts/ends.
- **Future Enhancement**: Consider using `pytz` or `zoneinfo` for automatic DST handling if needed.
