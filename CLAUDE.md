# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

K-Base is a branching brainstorming and learning application that treats conversations as trees rather than linear chat logs. Users can fork conversations at any point, start side chats on selected text, add notes, and collapse branches with summaries.

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- Backend: FastAPI (Python 3.11+) with async SQLAlchemy 2.0
- Database: PostgreSQL 15+ with pgvector extension
- LLM: LiteLLM abstraction (currently gpt-4o-mini)
- Auth: Google OAuth + JWT

**Production URLs:**
- Frontend: https://kbase.kdmytro.com (custom domain) or https://k-base-app.web.app (Firebase Hosting)
- Backend: https://kbase-backend-589116738750.us-central1.run.app (Cloud Run)
- Database: Cloud SQL PostgreSQL (k-base-app:us-central1:kbase-db)

## Development Commands

### Backend
```bash
cd backend
source .venv/bin/activate    # or: python3 -m venv venv && source venv/bin/activate
uv pip install -e ".[dev]"   # faster than pip, or use: pip install -r requirements.txt
alembic upgrade head         # run migrations
python main.py               # start server (port 8000)
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # start dev server (port 5173)
npm run build    # production build
npm run lint     # ESLint with max-warnings 0
```

### Database
```bash
createdb kbase
psql kbase -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql kbase -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

## Architecture

### Core Data Model

Conversations are stored as a tree of **Nodes** with self-referential `parent_id`. Key node types:
- `user_message`, `assistant_message` - main conversation
- `side_chat_user`, `side_chat_assistant` - selection-based threads
- `user_note` - annotations on any message
- `branch_summary` - collapsed branch summaries

Node states: `active`, `collapsed`, `abandoned`, `merged`

Side chats track text selection via `selected_text`, `selection_start`, `selection_end` for cross-element highlighting.

### Frontend State (App.tsx)

Complex state management using Maps for O(1) lookups:
- `forkPointBranches` - tracks nodes with multiple children
- `sideChatThreads` - position-based highlighting info
- `nodeNotes` - cached note nodes
- `nodes` - flat array of all session nodes

Tree building happens dynamically in components. Text highlighting uses character positions, not DOM nodes.

### Backend Request Flow

1. Create `user_message` node
2. Build conversation path (walk parent pointers to root)
3. Convert to LLM messages (respects collapsed summaries, includes notes as system context)
4. Stream/fetch AI response via LiteLLM
5. Create `assistant_message` node

### Key API Endpoints

- `POST /api/v1/chat/stream` - SSE streaming responses
- `GET /api/v1/nodes/{id}/side-chat-threads` - get side chat threads with positions
- Standard CRUD: `/topics`, `/sessions`, `/nodes`

API docs: http://localhost:8000/api/docs

## Code Patterns

### Frontend
- Import alias `@/` for src directory
- camelCase in frontend, snake_case in backend (API client converts)
- Position-based text highlighting (character offsets)
- Message selection logic handles both assistant messages and side chats

### Backend
- Async-first with `async def` and `Depends(get_db)`
- Chat service encapsulates LLM logic in `services/chat_service.py`
- UUID primary keys throughout
- Cascade deletes configured for data integrity

## Known Gotchas

Issues encountered during development - be aware of these patterns:

### FastAPI StreamingResponse + Database Session
FastAPI closes the DB session BEFORE the StreamingResponse generator finishes. Any database operations after streaming starts need a new session:
```python
# Inside the streaming generator:
async with AsyncSession(engine) as new_session:
    # Create assistant node here, not with the original session
```

### PostgreSQL Enum Values
SQLAlchemy passes enum names (`USER_MESSAGE`) not values (`user_message`). Use `.value`:
```python
node_type=NodeType.USER_MESSAGE.value  # correct
node_type=NodeType.USER_MESSAGE        # wrong - stores "USER_MESSAGE"
```

### Sibling/Branch Counting Must Filter by Type
Notes and side chats are children of message nodes. Branch indicators must filter by node type:
```python
# Correct - only count same-type siblings
siblings = [n for n in children if n.node_type == current_node.node_type]
```

### is_selected_path Flag Updates
When creating new branches, mark the new node `is_selected_path=True` and existing siblings `is_selected_path=False`. See `regenerate` endpoint for reference implementation.

### Cross-Element Text Selection
Selections spanning multiple DOM elements (heading + paragraph) won't match any single element's text. The highlighting logic uses substring/partial matching to handle this. Position-based tracking (`selection_start`, `selection_end`) is the source of truth.

### Side Chat Context Design
Side chats intentionally exclude full conversation context - only selected text + parent summary. This is by design for focus and token efficiency, not a bug.

### Pydantic/SQLAlchemy Field Conflicts
SQLAlchemy relationship names (like `children`) can conflict with Pydantic schema fields. Either rename or exclude from ORM mapping.

## Current Implementation Status

**Complete:** Basic chat, branching, tree visualization, streaming, markdown rendering, side chat threads, user notes, inline collapsed branches, cross-element highlighting, thread isolation, Google OAuth authentication, per-user data isolation, production deployment

**Next Phase (RAG):** Embedding service, memory chunk indexing, RAG search endpoint, context builder with RAG injection

## Production Deployment

### GCP Project Setup
The project uses `kdmytro-personal` gcloud configuration. direnv auto-switches when entering this directory.

```bash
# Verify gcloud config
gcloud config get project  # should show: k-base-app
gcloud auth list           # should show: kdmytro@gmail.com
```

### Deploy Backend (Cloud Run)
```bash
cd backend

# Build and push Docker image
gcloud builds submit --tag us-central1-docker.pkg.dev/k-base-app/kbase-repo/kbase-backend --project=k-base-app

# Deploy to Cloud Run (uses existing config)
gcloud run deploy kbase-backend \
  --image=us-central1-docker.pkg.dev/k-base-app/kbase-repo/kbase-backend \
  --region=us-central1 \
  --project=k-base-app

# View logs
gcloud run services logs read kbase-backend --region=us-central1 --project=k-base-app
```

### Deploy Frontend (Firebase Hosting)
```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

### Run Migrations on Cloud SQL
```bash
# Start Cloud SQL proxy
cloud_sql_proxy -instances=k-base-app:us-central1:kbase-db=tcp:5433 &

# Run migrations
cd backend
source .venv/bin/activate
DATABASE_URL="postgresql+asyncpg://kbase_user:PASSWORD@127.0.0.1:5433/kbase" alembic upgrade head

# Stop proxy
pkill -f cloud_sql_proxy
```

### Secrets (stored in GCP Secret Manager)
- `openai-api-key`
- `google-client-id`
- `google-client-secret`
- `jwt-secret-key`
- `anthropic-api-key`
- `db-user-password`

## Working With This Codebase

### Key Files to Understand First
Most frequently modified files - read these to understand the codebase:
- `frontend/src/App.tsx` - Main state management, complex Maps for O(1) lookups
- `frontend/src/components/chat/ChatMessage.tsx` - Message rendering, text selection, highlighting
- `frontend/src/components/chat/ChatThread.tsx` - Tree traversal, branch rendering
- `backend/services/chat_service.py` - LLM integration, context building, node creation
- `backend/api/routes/chat.py` - Streaming endpoint, the tricky StreamingResponse handling
- `backend/api/routes/nodes.py` - CRUD + siblings/tree endpoints

### Useful Commands

```bash
# Kill process on port (use before restarting servers)
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Quick backend restart
lsof -ti:8000 | xargs kill -9 2>/dev/null; cd backend && source .venv/bin/activate && python main.py &

# Test API endpoints
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/v1/topics | jq

# Debug database state directly
psql kbase -c "SELECT id, node_type, LEFT(content, 50), parent_id FROM nodes ORDER BY created_at DESC LIMIT 10;"

# Check both servers running
lsof -i :8000 -i :5173 | grep LISTEN
```

### Development Workflow

1. **Backend changes**: FastAPI auto-reloads, but streaming endpoint changes may need manual restart
2. **Frontend changes**: Vite hot-reloads automatically
3. **Database changes**: Create migration with `alembic revision --autogenerate -m "desc"`, then `alembic upgrade head`
4. **Adding enum values**: Autogenerated migrations for enums are often wrong - manually add `op.execute("ALTER TYPE ... ADD VALUE ...")`

### Testing Changes

- **API testing**: Use `curl` or the Swagger UI at http://localhost:8000/api/docs
- **Database verification**: Query directly with `psql kbase -c "..."` to verify data state
- **Frontend state**: React DevTools or `console.log` in App.tsx state handlers

### Common Patterns

- **New node type**: Update `NodeType` enum in both `backend/models/database.py` and `frontend/src/types/models.ts`, create migration
- **New API endpoint**: Add route in `backend/api/routes/`, add client method in `frontend/src/api/client.ts`
- **New component**: Follow existing patterns in `frontend/src/components/chat/`

## Environment Variables

Backend `.env`:
```
DATABASE_URL=postgresql+asyncpg://localhost:5432/kbase
OPENAI_API_KEY=sk-...
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:8000/api/v1
```
