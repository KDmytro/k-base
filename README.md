# K-Base: Branching Brainstorming & Learning App

K-Base is a brainstorming and learning application that treats conversations as trees rather than linear logs. Users can branch conversations at any point, collapse tangents with AI-generated summaries, and maintain shared memory across related sessions.

## Features

- **Branching Conversations**: Fork conversations at any point without losing the main thread
- **Inline Branch Switching**: Non-active branches appear as collapsed preview cards at fork points
- **Side Chat Threads**: Select any text in a message to start a focused side conversation
- **User Notes**: Add notes to any message for annotations and reminders
- **Tree Navigation**: Navigate complex discussion trees with mini tree visualization
- **Streaming Responses**: Real-time token streaming with markdown rendering
- **Multi-Provider LLM Support**: Ready for multiple LLM providers (via LiteLLM)

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI (Python 3.11+) with async support
- **Database**: PostgreSQL 15+ with pgvector extension
- **LLM Gateway**: LiteLLM for provider abstraction
- **Embeddings**: OpenAI text-embedding-3-small

## Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv) - Fast Python package installer
- Node.js 18+
- PostgreSQL 15+
- pnpm (or npm/yarn)

## Setup Instructions

### 1. Database Setup

```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb kbase

# Install pgvector extension
brew install pgvector

# Enable extension in database
psql kbase -c "CREATE EXTENSION vector;"
```

### 2. Backend Setup

First, install uv if you haven't already:
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or using Homebrew
brew install uv

# Or using pip
pip install uv
```

Then set up the backend:
```bash
# Navigate to backend directory
cd backend

# Create virtual environment and install dependencies with uv
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies (uv is much faster than pip!)
uv pip install -e .

# Or install with dev dependencies
uv pip install -e ".[dev]"

# Create .env file from example
cp .env.example .env

# Edit .env and add your OpenAI API key
# DATABASE_URL=postgresql+asyncpg://localhost:5432/kbase
# OPENAI_API_KEY=sk-your-key-here

# Run database migrations
alembic upgrade head

# Start the backend server
python main.py
# Or use uvicorn directly:
# uvicorn main:app --reload
```

The backend API will be available at `http://localhost:8000`

API Documentation: `http://localhost:8000/api/docs`

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
pnpm install
# Or: npm install / yarn install

# Create .env file from example (optional)
cp .env.example .env

# Start the development server
pnpm dev
# Or: npm run dev / yarn dev
```

The frontend will be available at `http://localhost:5173`

## Project Structure

```
k-base/
├── backend/
│   ├── alembic/              # Database migrations
│   │   ├── versions/         # Migration files
│   │   └── env.py           # Alembic environment config
│   ├── api/                  # API routes
│   │   └── routes/          # Route handlers (TODO)
│   ├── models/              # Data models
│   │   ├── database.py      # SQLAlchemy models
│   │   └── schemas.py       # Pydantic schemas
│   ├── services/            # Business logic (TODO)
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration management
│   └── requirements.txt     # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components (TODO)
│   │   │   ├── chat/
│   │   │   ├── sidebar/
│   │   │   └── common/
│   │   ├── stores/          # Zustand stores
│   │   │   └── chatStore.ts # Main chat state store
│   │   ├── api/            # API client
│   │   │   └── client.ts   # Backend API client
│   │   ├── types/          # TypeScript types
│   │   │   └── models.ts   # Type definitions
│   │   ├── App.tsx         # Main app component
│   │   ├── main.tsx        # Entry point
│   │   └── index.css       # Global styles
│   ├── package.json
│   └── vite.config.ts
│
├── initial-spec.md          # Detailed technical specification
└── README.md               # This file
```

## Development Workflow

1. **Start PostgreSQL**: Ensure PostgreSQL is running with pgvector extension enabled
2. **Start Backend**: Run the FastAPI server in development mode
3. **Start Frontend**: Run the Vite development server
4. **Access**: Open `http://localhost:5173` in your browser

## Database Migrations

```bash
# Create a new migration after model changes
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Show current revision
alembic current
```

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://localhost:5432/kbase

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...  # For future use

# Application
APP_ENV=development
DEBUG=true
LOG_LEVEL=INFO

# Limits
MAX_CONTEXT_TOKENS=8000
MAX_MEMORY_RESULTS=10
```

### Frontend (.env)

```bash
# API Configuration
VITE_API_URL=http://localhost:8000/api/v1
```

## Implementation Roadmap

The project follows a phased implementation approach:

### Phase 1: Foundation ✅ (COMPLETE)
- [x] Database setup with pgvector
- [x] Database models and migrations
- [x] FastAPI project structure
- [x] Basic CRUD for topics, sessions, nodes
- [x] Simple chat endpoint with LLM integration (LiteLLM/GPT-4o-mini)
- [x] Basic React app with single-thread chat view
- [x] Sidebar for topic/session management
- [x] API client with snake_case/camelCase conversion

### Phase 2: Branching ✅ (COMPLETE)
- [x] Branch creation (fork from any node)
- [x] Branch selection UI (indicator + dropdown switcher)
- [x] Tree rendering in frontend (mini tree sidebar with SVG visualization)
- [x] Streaming responses via SSE (real-time token streaming)
- [x] Markdown rendering with syntax highlighting
- [x] Session renaming (double-click or pencil icon)
- [x] URL routing (`/topic/:id/session/:id` for deep linking)

### Phase 3: Notes & Side Chats ✅ (COMPLETE)
- [x] User notes (add note to any node with slide-out panel)
- [x] Inline note display below messages
- [x] Side chat threads (select text to start focused discussion)
- [x] Multiple side chat threads per message (different selections)
- [x] Text highlighting for existing side chat threads
- [x] Cross-element highlighting (selections spanning markdown elements)
- [x] Thread isolation (separate LLM context per selection)
- [x] Inline collapsed branches (replaced dropdown with preview cards)

### Phase 4: RAG Integration
- [ ] Embedding service integration
- [ ] Memory chunk indexing
- [ ] RAG search endpoint
- [ ] Context builder with RAG injection
- [ ] Priority boosting for notes/summaries

### Phase 5: Polish & Testing
- [ ] Error handling and edge cases
- [ ] Loading states and optimistic updates
- [ ] Keyboard shortcuts
- [ ] Export conversation to markdown
- [ ] Performance optimization
- [ ] Testing (unit + integration)

## Next Steps

1. **RAG Integration**: Shared memory across sessions via embeddings
2. **Collapse Branches**: Hide tangent details with AI-generated summaries
3. **Regenerate Response**: Re-roll AI responses (creates sibling branch)
4. **Export to Markdown**: Export conversation threads to markdown files

## Documentation

For detailed technical specifications, architecture decisions, and implementation details, see [initial-spec.md](./docs/initial-spec.md).

## License

This project is in active development.

---

*Last Updated: 2026-01-04*
