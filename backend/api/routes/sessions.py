"""Sessions API routes."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.database import Session, Topic, Node, get_db
from models.schemas import SessionCreate, SessionUpdate, SessionResponse, NodeResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session: SessionCreate,
    db: AsyncSession = Depends(get_db)
) -> Session:
    """Create a new session."""
    # Verify topic exists
    result = await db.execute(select(Topic).where(Topic.id == session.topic_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Topic not found")

    db_session = Session(
        topic_id=session.topic_id,
        name=session.name,
        description=session.description
    )
    db.add(db_session)
    await db.flush()
    await db.refresh(db_session)
    return db_session


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> Session:
    """Get a session by ID."""
    result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: UUID,
    update: SessionUpdate,
    db: AsyncSession = Depends(get_db)
) -> Session:
    """Update a session."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if update.name is not None:
        session.name = update.name
    if update.description is not None:
        session.description = update.description

    await db.flush()
    await db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a session and all its nodes."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)


@router.get("/{session_id}/tree", response_model=List[NodeResponse])
async def get_session_tree(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> List[Node]:
    """Get the full tree of nodes for a session."""
    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all nodes for this session, ordered by creation time
    result = await db.execute(
        select(Node)
        .where(Node.session_id == session_id)
        .order_by(Node.created_at)
    )
    return list(result.scalars().all())


# Nested route for sessions within a topic
topics_sessions_router = APIRouter(prefix="/topics/{topic_id}/sessions", tags=["sessions"])


@topics_sessions_router.get("", response_model=List[SessionResponse])
async def list_topic_sessions(
    topic_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> List[Session]:
    """List all sessions in a topic."""
    # Verify topic exists
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Topic not found")

    result = await db.execute(
        select(Session)
        .where(Session.topic_id == topic_id)
        .order_by(Session.updated_at.desc())
    )
    return list(result.scalars().all())
