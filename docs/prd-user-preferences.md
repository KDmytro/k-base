# PRD: User Preferences

## Overview
Allow users to customize how AI responses are presented to them via a settings page. Preferences are injected into the system prompt for all conversations.

## Scope
- User-level preferences only (no per-topic overrides in v1)
- Settings page accessible from main UI

## User Preferences

### Text Fields
| Field | Description |
|-------|-------------|
| Background | Brief user bio (e.g., "Software engineer, 10 years experience") |
| Interests | Domains of interest (e.g., "physics, distributed systems, ML") |
| Custom instructions | Freeform text appended to system prompt |

## Data Model

```sql
-- Option A: JSON column on users table
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';

-- Option B: Separate table (more flexible for future)
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  background TEXT,
  interests TEXT,
  custom_instructions TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

Recommend: **Option B** - explicit columns are easier to query/validate.

## API

```
GET  /api/v1/users/me/preferences
PUT  /api/v1/users/me/preferences
```

Response/request body:
```json
{
  "background": "Software engineer, interested in exact sciences",
  "interests": "physics, astronomy, systems programming",
  "custom_instructions": "Prefer examples over theory. Use metric units."
}
```

## System Prompt Injection

In `chat_service.py`, build a preferences block:

```
## User Preferences
- Background: Software engineer, interested in exact sciences
- Interests: physics, astronomy, systems programming
- Custom instructions: Prefer examples over theory. Use metric units.
```

Prepend to existing system prompt before LLM call.

## Frontend

### Settings Page (`/settings` or modal)
- Text inputs for background, interests
- Textarea for custom instructions
- Save button (optimistic update)
- Access via user menu or sidebar icon

### State
- Zustand store for preferences (or extend existing auth store)
- Fetch on app load, cache locally

## Implementation Order

1. Database: migration for `user_preferences` table
2. Backend: Pydantic schemas + CRUD endpoints
3. Backend: Modify `chat_service.py` to inject preferences
4. Frontend: Settings page UI
5. Frontend: Wire up API calls + state

## Out of Scope (v1)
- Toggle preferences (concise mode, academic tone, include sources, skip caveats)
- Per-topic/session preference overrides
- Preference presets/templates
- Modes & skills (separate feature)
