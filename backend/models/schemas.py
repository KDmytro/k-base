"""Pydantic schemas for request/response validation."""

from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid

from pydantic import BaseModel, Field

from models.database import NodeType, NodeStatus, ChunkType


# ============================================
# Available LLM Models Registry
# ============================================

AVAILABLE_MODELS = {
    "gpt-4o": {"provider": "openai", "display": "GPT-4o"},
    "gpt-4o-mini": {"provider": "openai", "display": "GPT-4o Mini"},
    "anthropic/claude-opus-4-5-20251101": {"provider": "anthropic", "display": "Claude Opus 4.5"},
    "anthropic/claude-sonnet-4-20250514": {"provider": "anthropic", "display": "Claude Sonnet 4"},
    "anthropic/claude-3-5-haiku-20241022": {"provider": "anthropic", "display": "Claude Haiku 3.5"},
    "gemini/gemini-2.0-flash": {"provider": "google", "display": "Gemini 2.0 Flash"},
    "gemini/gemini-2.0-pro-exp-02-05": {"provider": "google", "display": "Gemini 2.0 Pro"},
}


# ============================================
# Topic Schemas
# ============================================

class TopicCreate(BaseModel):
    """Schema for creating a new topic."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None


class TopicUpdate(BaseModel):
    """Schema for updating a topic."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None


class TopicResponse(BaseModel):
    """Schema for topic responses."""
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
    """Schema for creating a new session."""
    topic_id: uuid.UUID
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    default_model: Optional[str] = None


class SessionUpdate(BaseModel):
    """Schema for updating a session."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    default_model: Optional[str] = None


class SessionResponse(BaseModel):
    """Schema for session responses."""
    id: uuid.UUID
    topic_id: uuid.UUID
    name: str
    description: Optional[str]
    root_node_id: Optional[uuid.UUID]
    default_model: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Node Schemas
# ============================================

class GenerationConfig(BaseModel):
    """Configuration for LLM generation."""
    provider: str = "openai"
    model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 4096


class NodeCreate(BaseModel):
    """Schema for creating a new node."""
    session_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    content: str
    node_type: NodeType
    branch_name: Optional[str] = None
    generation_config: Optional[GenerationConfig] = None


class NodeUpdate(BaseModel):
    """Schema for updating a node."""
    status: Optional[NodeStatus] = None
    branch_name: Optional[str] = None
    collapsed_summary: Optional[str] = None
    is_selected_path: Optional[bool] = None


class NoteRequest(BaseModel):
    """Schema for creating/updating a note on a node."""
    content: str


class NodeResponse(BaseModel):
    """Schema for node responses."""
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
    selected_text: Optional[str] = None  # For side chat nodes - the text that started this thread
    selection_start: Optional[int] = None  # Start position for highlighting
    selection_end: Optional[int] = None  # End position for highlighting
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Chat/Completion Schemas
# ============================================

class ChatRequest(BaseModel):
    """Request to send a message and get AI response."""
    session_id: uuid.UUID
    parent_node_id: Optional[uuid.UUID] = None  # None = start new thread
    content: str
    create_branch: bool = False  # Force new branch even if continuing
    include_rag: bool = True  # Whether to include RAG context
    model: Optional[str] = None  # Per-message model override


class ChatResponse(BaseModel):
    """Response containing the created nodes."""
    user_node: NodeResponse
    assistant_node: NodeResponse
    memories_used: List[uuid.UUID] = []  # IDs of memory chunks used


class SideChatRequest(BaseModel):
    """Request to send a message in a side chat."""
    parent_node_id: uuid.UUID  # The main thread message this side chat is attached to
    content: str
    selected_text: Optional[str] = None  # Optional text selection from parent message
    selection_start: Optional[int] = None  # Start position in parent content (for highlighting)
    selection_end: Optional[int] = None  # End position in parent content (for highlighting)
    include_main_context: bool = False  # Include main thread context even with selected text
    model: Optional[str] = None  # Per-message model override


class SideChatThreadSummary(BaseModel):
    """Summary of a side chat thread for navigation display."""
    node_id: uuid.UUID  # Parent message node
    selected_text: Optional[str]  # null for general side chats
    message_count: int
    last_message_at: datetime
    preview_text: str  # First message preview


# ============================================
# Branch Operation Schemas
# ============================================

class BranchCollapseRequest(BaseModel):
    """Request to collapse a branch."""
    node_id: uuid.UUID  # The branch root to collapse
    generate_summary: bool = True


class BranchCollapseResponse(BaseModel):
    """Response for branch collapse operation."""
    node: NodeResponse
    generated_summary: Optional[str]


# ============================================
# RAG/Memory Schemas
# ============================================

class MemorySearchRequest(BaseModel):
    """Request to search memory chunks."""
    topic_id: uuid.UUID
    query: str
    limit: int = 10
    include_session_ids: Optional[List[uuid.UUID]] = None  # Filter to specific sessions


class MemorySearchResult(BaseModel):
    """Single memory search result."""
    chunk_id: uuid.UUID
    content: str
    content_type: ChunkType
    session_id: uuid.UUID
    node_id: Optional[uuid.UUID]
    similarity: float
    priority_boost: float


class MemorySearchResponse(BaseModel):
    """Response for memory search."""
    results: List[MemorySearchResult]
    query_tokens: int


class MemoryStats(BaseModel):
    """Statistics about memory chunks."""
    total_chunks: int
    by_type: Dict[str, int]
    total_tokens: int


# ============================================
# User Preferences Schemas
# ============================================

class UserPreferencesUpdate(BaseModel):
    """Schema for updating user preferences."""
    background: Optional[str] = Field(None, max_length=2000)
    interests: Optional[str] = Field(None, max_length=1000)
    custom_instructions: Optional[str] = Field(None, max_length=4000)
    preferred_model: Optional[str] = None


class UserPreferencesResponse(BaseModel):
    """Schema for user preferences responses."""
    id: uuid.UUID
    user_id: uuid.UUID
    background: Optional[str]
    interests: Optional[str]
    custom_instructions: Optional[str]
    preferred_model: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
