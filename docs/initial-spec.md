# K-Base: Branching Brainstorming & Learning App

## Technical Specification Document v1.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Core Concepts](#3-core-concepts)
4. [Architecture Overview](#4-architecture-overview)
5. [Data Models](#5-data-models)
6. [API Specification](#6-api-specification)
7. [Frontend Architecture](#7-frontend-architecture)
8. [RAG & Memory System](#8-rag--memory-system)
9. [LLM Integration](#9-llm-integration)
10. [Implementation Phases](#10-implementation-phases)
11. [Development Setup](#11-development-setup)
12. [Future Considerations](#12-future-considerations)

---

## 1. Executive Summary

K-Base is a brainstorming and learning application that treats conversations as trees rather than linear logs. Users can branch conversations at any point, collapse tangents, and maintain shared memory across related sessions.

### V1 Scope

- Branching chat tree with parent/child relationships
- Collapsible branches with auto-generated summaries
- Basic RAG for topic-scoped shared memory
- Single LLM provider (OpenAI) with architecture ready for multi-provider
- PostgreSQL + pgvector for unified data and vector storage

### Out of Scope for V1

- Multi-model switching per branch
- Cross-topic memory linking
- Real-time collaboration
- Mobile apps

---

## 2. Problem Statement

### Current LLM Interface Limitations

Current chat interfaces (ChatGPT, Claude) force linear progression:

1. **Context Pollution**: Going down a "rabbit hole" pollutes the main conversation's context window
2. **Context Loss**: Starting a new chat loses all context from the original goal
3. **No Structure**: Insights are buried in flat message logs with no hierarchy
4. **Session Isolation**: Each chat session is completely isolated; no shared learning

### The Solution

Treat conversations like a Git repository or Abstract Syntax Tree (AST):

- **Branching**: Fork conversations at any point without losing the main thread
- **Collapsing**: Hide tangent details while preserving their summaries
- **Shared Memory**: Related sessions share context via RAG

---

## 3. Core Concepts

### 3.1 The Conversation Tree

```
Root (Topic: "Learning Rust")
├── Session A: "Getting Started"
│   ├── msg_001: User asks about installation
│   ├── msg_002: AI responds with steps
│   ├── msg_003: User asks about cargo
│   │   ├── msg_004a: AI explains cargo (SELECTED PATH)
│   │   │   ├── msg_005: User asks about cargo.toml
│   │   │   └── msg_006: AI explains manifest
│   │   └── msg_004b: AI alternative response (ABANDONED)
│   └── msg_007: User asks about ownership (BRANCH POINT)
│       ├── Branch B1: "Borrowing Deep Dive" [COLLAPSED]
│       └── msg_008: Continue main thread
└── Session B: "Async Programming"
    └── ... (shares memory with Session A)
```

### 3.2 Node Types

| Type | Description | Persistence |
|------|-------------|-------------|
| `user_message` | User's input prompt | Always stored |
| `assistant_message` | AI's response | Always stored |
| `user_note` | User's annotation/comment | Always stored, high RAG priority |
| `branch_summary` | Auto-generated when collapsing | Generated on collapse |
| `system` | System prompts, context injections | Internal only |

### 3.3 Branch States

| State | Description | Visual |
|-------|-------------|--------|
| `active` | Currently being worked on | Full display |
| `collapsed` | Hidden, summary shown | One-line summary with [+] expand |
| `abandoned` | User navigated away | Dimmed or hidden |
| `merged` | Integrated back into parent | Shows "merged" badge |

---

## 4. Architecture Overview

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend                                │
│                     React + TypeScript                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Chat View  │  │  Tree View  │  │  Topic/Session Sidebar  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Backend                                 │
│                    Python (FastAPI)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Chat API   │  │  RAG Engine │  │  LLM Gateway (LiteLLM)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL + pgvector                         │
│  ┌─────────────────────────┐  ┌───────────────────────────────┐ │
│  │  Relational Data        │  │  Vector Embeddings            │ │
│  │  (topics, sessions,     │  │  (memory_chunks table)        │ │
│  │   nodes, branches)      │  │                               │ │
│  └─────────────────────────┘  └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 18 + TypeScript | Component model fits tree structure |
| State Management | Zustand | Simple, handles complex tree state well |
| Styling | Tailwind CSS | Rapid prototyping |
| Backend | FastAPI (Python 3.11+) | Async support, easy LLM integration |
| Database | PostgreSQL 15+ | Relational + pgvector in one DB |
| Vector Search | pgvector | No separate service, SQL filtering |
| LLM Gateway | LiteLLM | Provider abstraction (prep for multi-model) |
| Embeddings | OpenAI text-embedding-3-small | Cost-effective, 1536 dimensions |

---

## 5. Data Models

### 5.1 Database Schema

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- TOPICS: Top-level grouping (e.g., "Learning Rust")
-- ============================================
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topics_created_at ON topics(created_at DESC);

-- ============================================
-- SESSIONS: Individual chat sessions within a topic
-- ============================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    root_node_id UUID, -- Set after first node created
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_topic_id ON sessions(topic_id);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at DESC);

-- ============================================
-- NODES: Every message/note in the conversation tree
-- ============================================
CREATE TYPE node_type AS ENUM (
    'user_message',
    'assistant_message', 
    'user_note',
    'branch_summary',
    'system'
);

CREATE TYPE node_status AS ENUM (
    'active',
    'collapsed',
    'abandoned',
    'merged'
);

CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
    
    -- Content
    content TEXT NOT NULL,
    node_type node_type NOT NULL,
    
    -- Branch state
    status node_status DEFAULT 'active',
    branch_name VARCHAR(255), -- Optional name for significant branches
    collapsed_summary TEXT, -- AI-generated summary when collapsed
    
    -- Generation metadata (for assistant messages)
    generation_config JSONB DEFAULT '{}',
    -- Example: {"provider": "openai", "model": "gpt-4o", "temperature": 0.7}
    
    -- Token tracking
    token_count INTEGER,
    
    -- Ordering within siblings (for multiple regenerations)
    sibling_index INTEGER DEFAULT 0,
    is_selected_path BOOLEAN DEFAULT TRUE, -- The "chosen" branch
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nodes_session_id ON nodes(session_id);
CREATE INDEX idx_nodes_parent_id ON nodes(parent_id);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_type ON nodes(node_type);
CREATE INDEX idx_nodes_created_at ON nodes(created_at);

-- ============================================
-- MEMORY_CHUNKS: RAG vector storage
-- ============================================
CREATE TYPE chunk_type AS ENUM (
    'note',      -- User notes (highest priority)
    'summary',   -- Branch summaries (medium priority)
    'message'    -- Regular messages (lower priority)
);

CREATE TABLE memory_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Hierarchy
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL,
    content_type chunk_type NOT NULL,
    
    -- Vector embedding (OpenAI text-embedding-3-small = 1536 dims)
    embedding vector(1536),
    
    -- Retrieval weighting
    priority_boost FLOAT DEFAULT 1.0, -- note=2.0, summary=1.5, message=1.0
    
    -- Metadata
    token_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memory_topic_id ON memory_chunks(topic_id);
CREATE INDEX idx_memory_session_id ON memory_chunks(session_id);
CREATE INDEX idx_memory_node_id ON memory_chunks(node_id);
CREATE INDEX idx_memory_content_type ON memory_chunks(content_type);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_memory_embedding ON memory_chunks 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get full path from root to a specific node
CREATE OR REPLACE FUNCTION get_node_path(target_node_id UUID)
RETURNS TABLE(node_id UUID, depth INTEGER) AS $$
WITH RECURSIVE path AS (
    SELECT id, parent_id, 0 as depth
    FROM nodes
    WHERE id = target_node_id
    
    UNION ALL
    
    SELECT n.id, n.parent_id, p.depth + 1
    FROM nodes n
    INNER JOIN path p ON n.id = p.parent_id
)
SELECT id as node_id, depth FROM path ORDER BY depth DESC;
$$ LANGUAGE SQL;

-- Get all children of a node (for tree rendering)
CREATE OR REPLACE FUNCTION get_node_children(parent_node_id UUID)
RETURNS TABLE(
    node_id UUID,
    content TEXT,
    node_type node_type,
    status node_status,
    sibling_index INTEGER,
    is_selected_path BOOLEAN,
    child_count BIGINT
) AS $$
SELECT 
    n.id as node_id,
    n.content,
    n.node_type,
    n.status,
    n.sibling_index,
    n.is_selected_path,
    (SELECT COUNT(*) FROM nodes c WHERE c.parent_id = n.id) as child_count
FROM nodes n
WHERE n.parent_id = parent_node_id
ORDER BY n.sibling_index, n.created_at;
$$ LANGUAGE SQL;
```

### 5.2 TypeScript Interfaces

```typescript
// types/models.ts

export type NodeType = 
    | 'user_message' 
    | 'assistant_message' 
    | 'user_note' 
    | 'branch_summary' 
    | 'system';

export type NodeStatus = 
    | 'active' 
    | 'collapsed' 
    | 'abandoned' 
    | 'merged';

export type ChunkType = 'note' | 'summary' | 'message';

export interface Topic {
    id: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Session {
    id: string;
    topicId: string;
    name: string;
    description?: string;
    rootNodeId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface GenerationConfig {
    provider: string;      // 'openai', 'anthropic', etc.
    model: string;         // 'gpt-4o', 'claude-3-5-sonnet', etc.
    temperature?: number;
    maxTokens?: number;
}

export interface Node {
    id: string;
    sessionId: string;
    parentId?: string;
    
    content: string;
    nodeType: NodeType;
    
    status: NodeStatus;
    branchName?: string;
    collapsedSummary?: string;
    
    generationConfig?: GenerationConfig;
    tokenCount?: number;
    
    siblingIndex: number;
    isSelectedPath: boolean;
    
    createdAt: Date;
    updatedAt: Date;
    
    // Frontend-only: populated during tree building
    children?: Node[];
}

export interface MemoryChunk {
    id: string;
    topicId: string;
    sessionId: string;
    nodeId?: string;
    content: string;
    contentType: ChunkType;
    priorityBoost: number;
    tokenCount?: number;
    createdAt: Date;
}

// Tree-building helper
export interface NodeWithChildren extends Node {
    children: NodeWithChildren[];
    depth: number;
}

// For the chat context builder
export interface ConversationContext {
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    totalTokens: number;
    retrievedMemories: MemoryChunk[];
}
```

### 5.3 Pydantic Models (Backend)

```python
# models/schemas.py

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import uuid

class NodeType(str, Enum):
    USER_MESSAGE = "user_message"
    ASSISTANT_MESSAGE = "assistant_message"
    USER_NOTE = "user_note"
    BRANCH_SUMMARY = "branch_summary"
    SYSTEM = "system"

class NodeStatus(str, Enum):
    ACTIVE = "active"
    COLLAPSED = "collapsed"
    ABANDONED = "abandoned"
    MERGED = "merged"

class ChunkType(str, Enum):
    NOTE = "note"
    SUMMARY = "summary"
    MESSAGE = "message"


# ============================================
# Topic Schemas
# ============================================

class TopicCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None

class TopicUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None

class TopicResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ============================================
# Session Schemas
# ============================================

class SessionCreate(BaseModel):
    topic_id: uuid.UUID
    name: str = Field(..., max_length=255)
    description: Optional[str] = None

class SessionUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None

class SessionResponse(BaseModel):
    id: uuid.UUID
    topic_id: uuid.UUID
    name: str
    description: Optional[str]
    root_node_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ============================================
# Node Schemas
# ============================================

class GenerationConfig(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 4096

class NodeCreate(BaseModel):
    session_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    content: str
    node_type: NodeType
    branch_name: Optional[str] = None
    generation_config: Optional[GenerationConfig] = None

class NodeUpdate(BaseModel):
    status: Optional[NodeStatus] = None
    branch_name: Optional[str] = None
    collapsed_summary: Optional[str] = None
    is_selected_path: Optional[bool] = None

class NodeResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    parent_id: Optional[uuid.UUID]
    content: str
    node_type: NodeType
    status: NodeStatus
    branch_name: Optional[str]
    collapsed_summary: Optional[str]
    generation_config: Optional[Dict[str, Any]]
    token_count: Optional[int]
    sibling_index: int
    is_selected_path: bool
    created_at: datetime
    updated_at: datetime
    children: List["NodeResponse"] = []
    
    class Config:
        from_attributes = True


# ============================================
# Chat/Completion Schemas
# ============================================

class ChatRequest(BaseModel):
    """Request to send a message and get AI response"""
    session_id: uuid.UUID
    parent_node_id: Optional[uuid.UUID] = None  # None = start new thread
    content: str
    create_branch: bool = False  # Force new branch even if continuing
    include_rag: bool = True  # Whether to include RAG context

class ChatResponse(BaseModel):
    """Response containing the created nodes"""
    user_node: NodeResponse
    assistant_node: NodeResponse
    memories_used: List[uuid.UUID] = []  # IDs of memory chunks used


# ============================================
# Branch Operation Schemas
# ============================================

class BranchCollapseRequest(BaseModel):
    """Request to collapse a branch"""
    node_id: uuid.UUID  # The branch root to collapse
    generate_summary: bool = True

class BranchCollapseResponse(BaseModel):
    node: NodeResponse
    generated_summary: Optional[str]


# ============================================
# RAG/Memory Schemas
# ============================================

class MemorySearchRequest(BaseModel):
    topic_id: uuid.UUID
    query: str
    limit: int = 10
    include_session_ids: Optional[List[uuid.UUID]] = None  # Filter to specific sessions

class MemorySearchResult(BaseModel):
    chunk_id: uuid.UUID
    content: str
    content_type: ChunkType
    session_id: uuid.UUID
    node_id: Optional[uuid.UUID]
    similarity: float
    priority_boost: float

class MemorySearchResponse(BaseModel):
    results: List[MemorySearchResult]
    query_tokens: int
```

---

## 6. API Specification

### 6.1 REST Endpoints

```yaml
# Base URL: /api/v1

# ============================================
# Topics
# ============================================

POST /topics
  Description: Create a new topic
  Request Body: TopicCreate
  Response: TopicResponse

GET /topics
  Description: List all topics
  Query Params: 
    - limit: int (default 50)
    - offset: int (default 0)
  Response: List[TopicResponse]

GET /topics/{topic_id}
  Description: Get topic by ID
  Response: TopicResponse

PATCH /topics/{topic_id}
  Description: Update topic
  Request Body: TopicUpdate
  Response: TopicResponse

DELETE /topics/{topic_id}
  Description: Delete topic and all sessions/nodes
  Response: 204 No Content

# ============================================
# Sessions
# ============================================

POST /sessions
  Description: Create a new session
  Request Body: SessionCreate
  Response: SessionResponse

GET /topics/{topic_id}/sessions
  Description: List sessions in a topic
  Response: List[SessionResponse]

GET /sessions/{session_id}
  Description: Get session with full node tree
  Query Params:
    - include_collapsed: bool (default false)
    - max_depth: int (default null = all)
  Response: SessionResponse with nested NodeResponse tree

DELETE /sessions/{session_id}
  Response: 204 No Content

# ============================================
# Nodes
# ============================================

GET /nodes/{node_id}
  Description: Get single node
  Response: NodeResponse

GET /nodes/{node_id}/path
  Description: Get path from root to this node
  Response: List[NodeResponse] (ordered root -> node)

GET /nodes/{node_id}/children
  Description: Get direct children of a node
  Response: List[NodeResponse]

PATCH /nodes/{node_id}
  Description: Update node (status, branch name, etc.)
  Request Body: NodeUpdate
  Response: NodeResponse

DELETE /nodes/{node_id}
  Description: Delete node and all descendants
  Response: 204 No Content

# ============================================
# Chat (Main Interaction)
# ============================================

POST /chat
  Description: Send message, get AI response
  Request Body: ChatRequest
  Response: ChatResponse (streaming via SSE)
  
  Notes:
    - If parent_node_id is null, creates new root thread
    - If parent_node_id has existing children and create_branch=false,
      continues the selected path
    - If create_branch=true, creates a new sibling branch

POST /chat/regenerate/{node_id}
  Description: Regenerate an assistant response (creates sibling)
  Response: NodeResponse (streaming via SSE)

# ============================================
# Branch Operations
# ============================================

POST /branches/collapse
  Description: Collapse a branch, optionally generate summary
  Request Body: BranchCollapseRequest
  Response: BranchCollapseResponse

POST /branches/expand/{node_id}
  Description: Expand a collapsed branch
  Response: NodeResponse

POST /branches/select/{node_id}
  Description: Mark this branch as the selected path
  Response: NodeResponse

# ============================================
# Notes
# ============================================

POST /nodes/{node_id}/notes
  Description: Add a user note attached to a node
  Request Body: { content: string }
  Response: NodeResponse (the created note node)

# ============================================
# Memory/RAG
# ============================================

POST /memory/search
  Description: Search memory chunks
  Request Body: MemorySearchRequest
  Response: MemorySearchResponse

GET /topics/{topic_id}/memory/stats
  Description: Get memory statistics for a topic
  Response: {
    total_chunks: int,
    by_type: { note: int, summary: int, message: int },
    total_tokens: int
  }
```

### 6.2 WebSocket Events (for streaming)

```typescript
// Client -> Server
interface WSMessage {
    type: 'chat' | 'regenerate' | 'cancel';
    payload: ChatRequest | { node_id: string };
}

// Server -> Client
interface WSResponse {
    type: 'token' | 'node_created' | 'complete' | 'error';
    payload: {
        token?: string;           // For streaming tokens
        node?: NodeResponse;      // When node is created/complete
        error?: string;           // Error message
    };
}
```

---

## 7. Frontend Architecture

### 7.1 Component Hierarchy

```
App
├── Sidebar
│   ├── TopicList
│   │   └── TopicItem (expandable)
│   │       └── SessionList
│   │           └── SessionItem
│   └── CreateTopicButton
│
├── MainView
│   ├── SessionHeader
│   │   ├── Breadcrumbs
│   │   ├── SessionTitle
│   │   └── SessionActions (settings, export)
│   │
│   ├── ChatThread
│   │   └── NodeTree (recursive)
│   │       └── NodeComponent
│   │           ├── NodeContent
│   │           │   ├── MessageBubble
│   │           │   ├── CollapsedSummary (if collapsed)
│   │           │   └── UserNote (if note type)
│   │           ├── BranchIndicator (if has siblings)
│   │           ├── NodeActions
│   │           │   ├── BranchButton
│   │           │   ├── CollapseButton
│   │           │   ├── AddNoteButton
│   │           │   └── RegenerateButton
│   │           └── ChildNodes (recursive)
│   │
│   └── ChatInput
│       ├── TextArea
│       ├── BranchModeToggle
│       └── SendButton
│
└── Modals
    ├── BranchSelectorModal
    ├── ContextPreviewModal
    └── SettingsModal
```

### 7.2 State Management (Zustand)

```typescript
// stores/chatStore.ts

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ChatState {
    // Current context
    currentTopicId: string | null;
    currentSessionId: string | null;
    currentNodeId: string | null;  // The node we're "at" in the tree
    
    // Data
    topics: Map<string, Topic>;
    sessions: Map<string, Session>;
    nodes: Map<string, Node>;
    
    // UI state
    expandedNodes: Set<string>;  // Which collapsed nodes are temporarily expanded
    selectedBranches: Map<string, string>;  // parentId -> selected childId
    isStreaming: boolean;
    
    // Actions
    setCurrentTopic: (topicId: string) => void;
    setCurrentSession: (sessionId: string) => void;
    navigateToNode: (nodeId: string) => void;
    
    // Node operations
    addNode: (node: Node) => void;
    updateNode: (nodeId: string, updates: Partial<Node>) => void;
    deleteNode: (nodeId: string) => void;
    
    // Branch operations
    selectBranch: (parentId: string, childId: string) => void;
    toggleNodeExpanded: (nodeId: string) => void;
    collapseNode: (nodeId: string, summary: string) => void;
    
    // Tree helpers
    getNodePath: (nodeId: string) => Node[];
    getNodeChildren: (nodeId: string) => Node[];
    buildContextMessages: (nodeId: string) => ConversationMessage[];
}

export const useChatStore = create<ChatState>()(
    immer((set, get) => ({
        // Initial state
        currentTopicId: null,
        currentSessionId: null,
        currentNodeId: null,
        topics: new Map(),
        sessions: new Map(),
        nodes: new Map(),
        expandedNodes: new Set(),
        selectedBranches: new Map(),
        isStreaming: false,
        
        // Implementation...
        setCurrentTopic: (topicId) => set((state) => {
            state.currentTopicId = topicId;
            state.currentSessionId = null;
            state.currentNodeId = null;
        }),
        
        navigateToNode: (nodeId) => set((state) => {
            state.currentNodeId = nodeId;
            // Auto-expand path to this node
            const path = get().getNodePath(nodeId);
            path.forEach(n => state.expandedNodes.add(n.id));
        }),
        
        buildContextMessages: (nodeId) => {
            const path = get().getNodePath(nodeId);
            const messages: ConversationMessage[] = [];
            
            for (const node of path) {
                if (node.status === 'collapsed' && node.collapsedSummary) {
                    // Use summary for collapsed branches
                    messages.push({
                        role: 'system',
                        content: `[Summary of previous discussion: ${node.collapsedSummary}]`
                    });
                } else if (node.nodeType === 'user_message') {
                    messages.push({ role: 'user', content: node.content });
                } else if (node.nodeType === 'assistant_message') {
                    messages.push({ role: 'assistant', content: node.content });
                }
            }
            
            return messages;
        },
        
        // ... rest of implementation
    }))
);
```

### 7.3 Key UI Interactions

#### Branching Flow

```
1. User is at node_005 (assistant response)
2. User clicks "Branch" button on node_005
3. UI creates a new branch indicator below node_005
4. User types in ChatInput
5. On send:
   - POST /chat with parent_node_id=node_005, create_branch=true
   - Creates node_006a (user) and node_007a (assistant)
   - Original path continues as node_006b if it existed
6. BranchIndicator shows "2 branches" with selector
```

#### Collapse Flow

```
1. User clicks "Collapse" on a branch root (e.g., node_006a)
2. Modal asks: "Generate summary?" [Yes] [No, just hide]
3. If Yes:
   - POST /branches/collapse with generate_summary=true
   - Backend generates summary via LLM
   - Returns collapsed node with summary
4. UI replaces expanded branch with CollapsedSummary component
5. [+] icon allows re-expansion
```

#### Navigation with Breadcrumbs

```
Topic: Learning Rust > Session: Ownership > [Main Thread] > Branch: Lifetimes

Clicking any breadcrumb item navigates to that node.
Branch names auto-generated or user-named.
```

---

## 8. RAG & Memory System

### 8.1 Embedding Pipeline

```python
# services/embedding.py

from openai import OpenAI
import tiktoken

class EmbeddingService:
    def __init__(self):
        self.client = OpenAI()
        self.model = "text-embedding-3-small"
        self.dimensions = 1536
        self.tokenizer = tiktoken.encoding_for_model("gpt-4o")
    
    def count_tokens(self, text: str) -> int:
        return len(self.tokenizer.encode(text))
    
    async def embed(self, text: str) -> list[float]:
        response = await self.client.embeddings.create(
            model=self.model,
            input=text,
            dimensions=self.dimensions
        )
        return response.data[0].embedding
    
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        response = await self.client.embeddings.create(
            model=self.model,
            input=texts,
            dimensions=self.dimensions
        )
        return [d.embedding for d in response.data]
```

### 8.2 Memory Indexing Strategy

```python
# services/memory.py

from enum import Enum

class IndexingTrigger(Enum):
    """When to index content into the memory system"""
    USER_NOTE = "user_note"           # Index immediately
    BRANCH_COLLAPSE = "branch_collapse"  # Index the summary
    ASSISTANT_ACCEPTED = "assistant_accepted"  # Index when user continues from this response
    NEVER = "never"  # Dead branches, abandoned threads

PRIORITY_BOOSTS = {
    ChunkType.NOTE: 2.0,      # User notes are highest priority
    ChunkType.SUMMARY: 1.5,   # Branch summaries are medium
    ChunkType.MESSAGE: 1.0,   # Regular messages are baseline
}

class MemoryService:
    def __init__(self, db: Database, embedding_service: EmbeddingService):
        self.db = db
        self.embedder = embedding_service
    
    async def index_node(
        self, 
        node: Node, 
        chunk_type: ChunkType,
        force: bool = False
    ) -> Optional[MemoryChunk]:
        """Index a node's content into the memory system."""
        
        # Skip if already indexed (unless forced)
        if not force and await self._is_indexed(node.id):
            return None
        
        # Skip abandoned/dead branches
        if node.status == NodeStatus.ABANDONED:
            return None
        
        # Generate embedding
        content = node.collapsed_summary if node.status == NodeStatus.COLLAPSED else node.content
        embedding = await self.embedder.embed(content)
        
        # Get topic_id via session
        session = await self.db.get_session(node.session_id)
        
        chunk = MemoryChunk(
            topic_id=session.topic_id,
            session_id=node.session_id,
            node_id=node.id,
            content=content,
            content_type=chunk_type,
            embedding=embedding,
            priority_boost=PRIORITY_BOOSTS[chunk_type],
            token_count=self.embedder.count_tokens(content)
        )
        
        return await self.db.create_memory_chunk(chunk)
    
    async def search(
        self,
        topic_id: str,
        query: str,
        limit: int = 10,
        session_filter: Optional[list[str]] = None
    ) -> list[MemorySearchResult]:
        """Search for relevant memories within a topic."""
        
        query_embedding = await self.embedder.embed(query)
        
        # SQL with pgvector
        sql = """
            SELECT 
                id,
                content,
                content_type,
                session_id,
                node_id,
                1 - (embedding <=> $1::vector) as similarity,
                priority_boost,
                (1 - (embedding <=> $1::vector)) * priority_boost as weighted_score
            FROM memory_chunks
            WHERE topic_id = $2
              AND ($3::uuid[] IS NULL OR session_id = ANY($3))
            ORDER BY weighted_score DESC
            LIMIT $4
        """
        
        results = await self.db.fetch_all(
            sql, 
            query_embedding, 
            topic_id, 
            session_filter, 
            limit
        )
        
        return [MemorySearchResult(**r) for r in results]
```

### 8.3 Context Construction

```python
# services/context_builder.py

class ContextBuilder:
    """Builds the full context for an LLM call, including RAG."""
    
    def __init__(
        self, 
        db: Database, 
        memory_service: MemoryService,
        max_context_tokens: int = 8000
    ):
        self.db = db
        self.memory = memory_service
        self.max_tokens = max_context_tokens
    
    async def build_context(
        self,
        session_id: str,
        current_node_id: Optional[str],
        user_message: str,
        include_rag: bool = True
    ) -> ConversationContext:
        """Build the full context for sending to the LLM."""
        
        messages = []
        total_tokens = 0
        retrieved_memories = []
        
        # 1. System prompt
        system_prompt = self._get_system_prompt()
        messages.append({"role": "system", "content": system_prompt})
        total_tokens += count_tokens(system_prompt)
        
        # 2. RAG memories (if enabled)
        if include_rag:
            session = await self.db.get_session(session_id)
            memories = await self.memory.search(
                topic_id=session.topic_id,
                query=user_message,
                limit=5
            )
            
            if memories:
                memory_context = self._format_memories(memories)
                messages.append({"role": "system", "content": memory_context})
                total_tokens += count_tokens(memory_context)
                retrieved_memories = [m.chunk_id for m in memories]
        
        # 3. Conversation history (path to current node)
        if current_node_id:
            history = await self._get_conversation_path(current_node_id)
            for msg in history:
                msg_tokens = count_tokens(msg["content"])
                if total_tokens + msg_tokens > self.max_tokens - 1000:  # Reserve for response
                    break
                messages.append(msg)
                total_tokens += msg_tokens
        
        # 4. Current user message
        messages.append({"role": "user", "content": user_message})
        total_tokens += count_tokens(user_message)
        
        return ConversationContext(
            messages=messages,
            total_tokens=total_tokens,
            retrieved_memories=retrieved_memories
        )
    
    def _format_memories(self, memories: list[MemorySearchResult]) -> str:
        """Format retrieved memories for injection into context."""
        lines = ["Relevant context from previous conversations in this topic:"]
        
        for mem in memories:
            source_type = mem.content_type.value.title()
            lines.append(f"<memory type=\"{source_type}\">")
            lines.append(mem.content)
            lines.append("</memory>")
        
        return "\n".join(lines)
    
    async def _get_conversation_path(
        self, 
        node_id: str
    ) -> list[dict]:
        """Get the conversation history as a list of messages."""
        path = await self.db.get_node_path(node_id)
        messages = []
        
        for node in path:
            if node.status == NodeStatus.COLLAPSED and node.collapsed_summary:
                # Use summary for collapsed branches
                messages.append({
                    "role": "assistant",
                    "content": f"[Previous discussion summary: {node.collapsed_summary}]"
                })
            elif node.node_type == NodeType.USER_MESSAGE:
                messages.append({"role": "user", "content": node.content})
            elif node.node_type == NodeType.ASSISTANT_MESSAGE:
                messages.append({"role": "assistant", "content": node.content})
            elif node.node_type == NodeType.USER_NOTE:
                # Notes are injected as system context
                messages.append({
                    "role": "system", 
                    "content": f"[User note: {node.content}]"
                })
        
        return messages
    
    def _get_system_prompt(self) -> str:
        return """You are a helpful AI assistant for brainstorming and learning. 
You are part of a branching conversation system where the user can explore 
multiple lines of thinking. Stay focused on the current branch's topic.

When relevant context from other conversations is provided, use it to give 
more informed and consistent responses, but don't explicitly reference 
"previous conversations" unless directly relevant."""
```

---

## 9. LLM Integration

### 9.1 LLM Gateway (LiteLLM)

```python
# services/llm_gateway.py

import litellm
from litellm import acompletion
import asyncio
from typing import AsyncGenerator

class LLMGateway:
    """Unified interface for multiple LLM providers."""
    
    # Model mappings for easy reference
    MODELS = {
        "default": "gpt-4o",
        "fast": "gpt-4o-mini", 
        "reasoning": "o1-mini",
        "claude": "claude-3-5-sonnet-20241022",
    }
    
    def __init__(self):
        # LiteLLM reads API keys from environment variables:
        # OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
        litellm.set_verbose = False
    
    async def complete(
        self,
        messages: list[dict],
        model: str = "gpt-4o",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """Generate a completion, streaming tokens."""
        
        response = await acompletion(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream
        )
        
        if stream:
            async for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        else:
            yield response.choices[0].message.content
    
    async def complete_full(
        self,
        messages: list[dict],
        model: str = "gpt-4o",
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """Generate a completion, return full response."""
        
        response = await acompletion(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False
        )
        
        return response.choices[0].message.content
    
    async def generate_summary(
        self,
        conversation: list[dict],
        max_summary_tokens: int = 200
    ) -> str:
        """Generate a summary of a conversation branch."""
        
        summary_prompt = [{
            "role": "system",
            "content": """Summarize this conversation branch in 2-3 sentences. 
Focus on: key decisions made, important information discovered, and conclusions reached.
Be concise but capture the essential points."""
        }]
        
        # Add conversation
        summary_prompt.extend(conversation)
        summary_prompt.append({
            "role": "user",
            "content": "Please summarize the above conversation."
        })
        
        return await self.complete_full(
            messages=summary_prompt,
            model="gpt-4o-mini",  # Use fast model for summaries
            temperature=0.3,
            max_tokens=max_summary_tokens
        )
```

### 9.2 Chat Service

```python
# services/chat_service.py

class ChatService:
    """Main service for handling chat interactions."""
    
    def __init__(
        self,
        db: Database,
        llm: LLMGateway,
        context_builder: ContextBuilder,
        memory_service: MemoryService
    ):
        self.db = db
        self.llm = llm
        self.context = context_builder
        self.memory = memory_service
    
    async def send_message(
        self,
        request: ChatRequest
    ) -> AsyncGenerator[ChatResponse, None]:
        """Process a chat message and stream the response."""
        
        # 1. Create user node
        user_node = await self.db.create_node(NodeCreate(
            session_id=request.session_id,
            parent_id=request.parent_node_id,
            content=request.content,
            node_type=NodeType.USER_MESSAGE
        ))
        
        # Yield user node creation event
        yield {"type": "node_created", "node": user_node}
        
        # 2. Build context
        context = await self.context.build_context(
            session_id=request.session_id,
            current_node_id=user_node.id,
            user_message=request.content,
            include_rag=request.include_rag
        )
        
        # 3. Stream LLM response
        full_response = ""
        async for token in self.llm.complete(
            messages=context.messages,
            model="gpt-4o",
            stream=True
        ):
            full_response += token
            yield {"type": "token", "token": token}
        
        # 4. Create assistant node
        assistant_node = await self.db.create_node(NodeCreate(
            session_id=request.session_id,
            parent_id=user_node.id,
            content=full_response,
            node_type=NodeType.ASSISTANT_MESSAGE,
            generation_config=GenerationConfig(
                provider="openai",
                model="gpt-4o"
            )
        ))
        
        # 5. Index for RAG (mark user's previous choice as "accepted")
        if request.parent_node_id:
            parent = await self.db.get_node(request.parent_node_id)
            if parent.node_type == NodeType.ASSISTANT_MESSAGE:
                await self.memory.index_node(
                    parent, 
                    ChunkType.MESSAGE
                )
        
        yield {
            "type": "complete",
            "user_node": user_node,
            "assistant_node": assistant_node,
            "memories_used": context.retrieved_memories
        }
    
    async def collapse_branch(
        self,
        node_id: str,
        generate_summary: bool = True
    ) -> NodeResponse:
        """Collapse a branch, optionally generating a summary."""
        
        summary = None
        
        if generate_summary:
            # Get all nodes in this branch
            branch_nodes = await self.db.get_node_descendants(node_id)
            
            # Build conversation for summarization
            conversation = []
            for node in branch_nodes:
                if node.node_type == NodeType.USER_MESSAGE:
                    conversation.append({"role": "user", "content": node.content})
                elif node.node_type == NodeType.ASSISTANT_MESSAGE:
                    conversation.append({"role": "assistant", "content": node.content})
            
            if conversation:
                summary = await self.llm.generate_summary(conversation)
        
        # Update node status
        updated_node = await self.db.update_node(
            node_id,
            NodeUpdate(
                status=NodeStatus.COLLAPSED,
                collapsed_summary=summary
            )
        )
        
        # Index the summary for RAG
        if summary:
            await self.memory.index_node(
                updated_node,
                ChunkType.SUMMARY
            )
        
        return updated_node
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Basic chat with tree storage (no branching UI yet)

- [ ] Set up PostgreSQL with pgvector
- [ ] Implement database models and migrations
- [ ] Create FastAPI project structure
- [ ] Basic CRUD for topics, sessions, nodes
- [ ] Simple chat endpoint (non-streaming)
- [ ] Basic React app with single-thread chat view
- [ ] Connect frontend to backend

**Deliverable**: Can create topics, sessions, and have linear conversations

### Phase 2: Branching (Week 3-4)

**Goal**: Full branching and navigation

- [ ] Tree rendering in frontend
- [ ] Branch creation (fork from any node)
- [ ] Branch selection UI (when multiple children exist)
- [ ] Breadcrumb navigation
- [ ] Node path calculation
- [ ] Regenerate response (creates sibling)
- [ ] Streaming responses via WebSocket

**Deliverable**: Can create, navigate, and switch between branches

### Phase 3: Collapse & Notes (Week 5)

**Goal**: Branch management and annotation

- [ ] Collapse branch functionality
- [ ] Summary generation for collapsed branches
- [ ] Expand/collapse UI
- [ ] User notes (add note to any node)
- [ ] Notes display in tree

**Deliverable**: Can collapse tangents, add notes to conversations

### Phase 4: RAG Integration (Week 6)

**Goal**: Shared memory across sessions

- [ ] Embedding service integration
- [ ] Memory chunk indexing
- [ ] RAG search endpoint
- [ ] Context builder with RAG injection
- [ ] "Memory used" indicator in UI
- [ ] Priority boosting for notes/summaries

**Deliverable**: Sessions within a topic share knowledge

### Phase 5: Polish & Testing (Week 7-8)

**Goal**: Production-ready v1

- [ ] Error handling and edge cases
- [ ] Loading states and optimistic updates
- [ ] Keyboard shortcuts
- [ ] Export conversation to markdown
- [ ] Basic settings (model selection for future)
- [ ] Performance optimization
- [ ] Testing (unit + integration)

**Deliverable**: Shippable v1

---

## 11. Development Setup

### 11.1 Prerequisites

```bash
# Required software
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- pnpm (or npm/yarn)
```

### 11.2 Database Setup

```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb kbase

# Install pgvector extension
# Option 1: If using Homebrew postgres
brew install pgvector

# Option 2: From source
cd /tmp
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
make install

# Enable extension in database
psql kbase -c "CREATE EXTENSION vector;"
```

### 11.3 Backend Setup

```bash
# Create project directory
mkdir kbase && cd kbase
mkdir backend frontend

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy asyncpg 
pip install pgvector python-dotenv pydantic
pip install litellm tiktoken openai
pip install alembic  # for migrations

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql+asyncpg://localhost/kbase
OPENAI_API_KEY=sk-your-key-here
EOF

# Run migrations
alembic upgrade head

# Start server
uvicorn main:app --reload
```

### 11.4 Frontend Setup

```bash
cd ../frontend

# Create React app with Vite
pnpm create vite . --template react-ts

# Install dependencies
pnpm install zustand immer
pnpm install @tanstack/react-query
pnpm install tailwindcss postcss autoprefixer
pnpm install lucide-react  # icons

# Initialize Tailwind
npx tailwindcss init -p

# Start dev server
pnpm dev
```

### 11.5 Project Structure

```
kbase/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── topics.py
│   │   │   ├── sessions.py
│   │   │   ├── nodes.py
│   │   │   ├── chat.py
│   │   │   └── memory.py
│   │   └── deps.py           # Dependency injection
│   ├── models/
│   │   ├── __init__.py
│   │   ├── database.py       # SQLAlchemy models
│   │   └── schemas.py        # Pydantic schemas
│   ├── services/
│   │   ├── __init__.py
│   │   ├── chat_service.py
│   │   ├── context_builder.py
│   │   ├── embedding.py
│   │   ├── llm_gateway.py
│   │   └── memory.py
│   ├── main.py
│   ├── config.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatThread.tsx
│   │   │   │   ├── NodeComponent.tsx
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   └── BranchIndicator.tsx
│   │   │   ├── sidebar/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopicList.tsx
│   │   │   │   └── SessionList.tsx
│   │   │   └── common/
│   │   │       ├── Breadcrumbs.tsx
│   │   │       └── LoadingSpinner.tsx
│   │   ├── stores/
│   │   │   └── chatStore.ts
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── types/
│   │   │   └── models.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

---

## 12. Future Considerations

### V2 Features (Post-Launch)

1. **Multi-Model Switching**: Select different models per branch
2. **Cross-Topic Memory**: Link related topics for broader context
3. **Graph View**: Visual map of conversation branches
4. **Export Options**: PDF, Notion, Obsidian formats
5. **Collaboration**: Share topics with team members
6. **Local LLM Support**: Ollama integration for privacy

### Performance Considerations

1. **Token Budgeting**: Implement hard limits on context size
2. **Lazy Loading**: Load branch children on demand
3. **Caching**: Cache embeddings and common queries
4. **Pruning**: Auto-archive old/unused branches

### Security Considerations

1. **API Key Management**: Never store keys in frontend
2. **Rate Limiting**: Prevent abuse of LLM calls
3. **Input Validation**: Sanitize all user content
4. **Auth**: Add authentication before multi-user support

---

## Appendix A: Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/kbase

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

---

## Appendix B: Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | PostgreSQL + pgvector | Single DB for relational + vectors; simpler ops |
| Vector DB | pgvector over Chroma | Already using Postgres; SQL filtering; fewer services |
| Backend | FastAPI | Async support; good for streaming; Python ecosystem |
| Frontend State | Zustand | Simple; handles complex tree state; good immer support |
| LLM Gateway | LiteLLM | Provider abstraction; easy to add models later |
| Embeddings | text-embedding-3-small | Cost-effective; 1536 dims sufficient for RAG |
| V1 Scope | No multi-model | Reduce complexity; architecture supports future addition |

---

*Document Version: 1.0*  
*Last Updated: 2026-01-02*  
*Author: AI-assisted specification*
