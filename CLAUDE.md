# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

K-Base is a branching brainstorming and learning application that treats conversations as trees rather than linear chat logs. Users can fork conversations at any point, start side chats on selected text, add notes, and collapse branches with summaries.

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- Backend: FastAPI (Python 3.11+) with async SQLAlchemy 2.0
- Database: PostgreSQL 15+ with pgvector extension
- LLM: LiteLLM abstraction (currently gpt-4o-mini)

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

## Current Implementation Status

**Complete:** Basic chat, branching, tree visualization, streaming, markdown rendering, side chat threads, user notes, inline collapsed branches, cross-element highlighting, thread isolation

**Next Phase (RAG):** Embedding service, memory chunk indexing, RAG search endpoint, context builder with RAG injection

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
