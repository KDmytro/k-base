"""SQLAlchemy database models."""

from datetime import datetime
from typing import AsyncGenerator
import uuid
import enum

from sqlalchemy import (
    Column, String, Text, DateTime, Integer, Boolean, Float,
    ForeignKey, Index, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM as PGEnum
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship
from pgvector.sqlalchemy import Vector

from config import settings

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True
)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for models
Base = declarative_base()


# Enums matching the PostgreSQL types
class NodeType(str, enum.Enum):
    """Node type enumeration."""
    USER_MESSAGE = "user_message"
    ASSISTANT_MESSAGE = "assistant_message"
    USER_NOTE = "user_note"
    BRANCH_SUMMARY = "branch_summary"
    SYSTEM = "system"


class NodeStatus(str, enum.Enum):
    """Node status enumeration."""
    ACTIVE = "active"
    COLLAPSED = "collapsed"
    ABANDONED = "abandoned"
    MERGED = "merged"


class ChunkType(str, enum.Enum):
    """Memory chunk type enumeration."""
    NOTE = "note"
    SUMMARY = "summary"
    MESSAGE = "message"


# ============================================
# Models
# ============================================

class Topic(Base):
    """Top-level grouping for related sessions."""
    __tablename__ = "topics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    sessions = relationship("Session", back_populates="topic", cascade="all, delete-orphan")
    memory_chunks = relationship("MemoryChunk", back_populates="topic", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_topics_created_at', 'created_at'),
    )


class Session(Base):
    """Individual chat session within a topic."""
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    root_node_id = Column(UUID(as_uuid=True), nullable=True)  # Set after first node created
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    topic = relationship("Topic", back_populates="sessions")
    nodes = relationship("Node", back_populates="session", cascade="all, delete-orphan")
    memory_chunks = relationship("MemoryChunk", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_sessions_topic_id', 'topic_id'),
        Index('idx_sessions_updated_at', 'updated_at'),
    )


class Node(Base):
    """Every message/note in the conversation tree."""
    __tablename__ = "nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True)

    # Content
    content = Column(Text, nullable=False)
    node_type = Column(
        PGEnum('user_message', 'assistant_message', 'user_note', 'branch_summary', 'system',
               name='node_type', create_type=False),
        nullable=False
    )

    # Branch state
    status = Column(
        PGEnum('active', 'collapsed', 'abandoned', 'merged',
               name='node_status', create_type=False),
        default='active',
        nullable=False
    )
    branch_name = Column(String(255), nullable=True)
    collapsed_summary = Column(Text, nullable=True)

    # Generation metadata
    generation_config = Column(JSONB, default={}, nullable=True)

    # Token tracking
    token_count = Column(Integer, nullable=True)

    # Ordering within siblings
    sibling_index = Column(Integer, default=0, nullable=False)
    is_selected_path = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    session = relationship("Session", back_populates="nodes")
    children = relationship("Node", backref="parent", remote_side=[id])
    memory_chunks = relationship("MemoryChunk", back_populates="node", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_nodes_session_id', 'session_id'),
        Index('idx_nodes_parent_id', 'parent_id'),
        Index('idx_nodes_status', 'status'),
        Index('idx_nodes_type', 'node_type'),
        Index('idx_nodes_created_at', 'created_at'),
    )


class MemoryChunk(Base):
    """RAG vector storage for shared memory."""
    __tablename__ = "memory_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Hierarchy
    topic_id = Column(UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=True)

    # Content
    content = Column(Text, nullable=False)
    content_type = Column(
        PGEnum('note', 'summary', 'message', name='chunk_type', create_type=False),
        nullable=False
    )

    # Vector embedding (1536 dimensions for text-embedding-3-small)
    embedding = Column(Vector(1536), nullable=False)

    # Retrieval weighting
    priority_boost = Column(Float, default=1.0, nullable=False)

    # Metadata
    token_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    topic = relationship("Topic", back_populates="memory_chunks")
    session = relationship("Session", back_populates="memory_chunks")
    node = relationship("Node", back_populates="memory_chunks")

    __table_args__ = (
        Index('idx_memory_topic_id', 'topic_id'),
        Index('idx_memory_session_id', 'session_id'),
        Index('idx_memory_node_id', 'node_id'),
        Index('idx_memory_content_type', 'content_type'),
        # Vector index created via migration
    )


# ============================================
# Database Session Management
# ============================================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database sessions."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
