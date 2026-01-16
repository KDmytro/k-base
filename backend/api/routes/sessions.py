"""Sessions API routes."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.auth import get_current_user
from models.database import Session, Topic, Node, NodeType, User, get_db
from models.schemas import SessionCreate, SessionUpdate, SessionResponse, NodeResponse, SideChatThreadSummary

router = APIRouter(prefix="/sessions", tags=["sessions"])


async def verify_topic_ownership(topic_id: UUID, user: User, db: AsyncSession) -> Topic:
    """Verify that a topic belongs to the current user."""
    result = await db.execute(
        select(Topic).where(Topic.id == topic_id, Topic.user_id == user.id)
    )
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


async def verify_session_ownership(session_id: UUID, user: User, db: AsyncSession) -> Session:
    """Verify that a session belongs to the current user (via topic)."""
    result = await db.execute(
        select(Session)
        .join(Topic)
        .where(Session.id == session_id, Topic.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Session:
    """Create a new session."""
    # Verify topic exists and belongs to user
    await verify_topic_ownership(session.topic_id, current_user, db)

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Session:
    """Get a session by ID."""
    return await verify_session_ownership(session_id, current_user, db)


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: UUID,
    update: SessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Session:
    """Update a session."""
    session = await verify_session_ownership(session_id, current_user, db)

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a session and all its nodes."""
    session = await verify_session_ownership(session_id, current_user, db)
    await db.delete(session)


@router.get("/{session_id}/tree", response_model=List[NodeResponse])
async def get_session_tree(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[Node]:
    """Get the conversation tree for a session (excludes notes and side chats)."""
    await verify_session_ownership(session_id, current_user, db)

    result = await db.execute(
        select(Node)
        .where(
            Node.session_id == session_id,
            Node.node_type.in_([NodeType.USER_MESSAGE, NodeType.ASSISTANT_MESSAGE])
        )
        .order_by(Node.created_at)
    )
    return list(result.scalars().all())


@router.get("/{session_id}/side-chat-threads", response_model=List[SideChatThreadSummary])
async def get_session_side_chat_threads(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[SideChatThreadSummary]:
    """Get all unique side chat threads across all nodes in a session."""
    await verify_session_ownership(session_id, current_user, db)

    result = await db.execute(
        select(Node)
        .where(
            Node.session_id == session_id,
            Node.node_type.in_([NodeType.SIDE_CHAT_USER.value, NodeType.SIDE_CHAT_ASSISTANT.value])
        )
        .order_by(Node.created_at)
    )
    side_chat_nodes = list(result.scalars().all())

    # Group by parent_id + selected_text to identify unique threads
    threads: dict[tuple[UUID, str | None], list[Node]] = {}
    for node in side_chat_nodes:
        key = (node.parent_id, node.selected_text)
        if key not in threads:
            threads[key] = []
        threads[key].append(node)

    # Build summaries
    summaries = []
    for (parent_id, selected_text), nodes in threads.items():
        first_user_msg = next(
            (n for n in nodes if n.node_type == NodeType.SIDE_CHAT_USER.value),
            nodes[0] if nodes else None
        )
        preview_text = (first_user_msg.content[:100] + "...") if first_user_msg and len(first_user_msg.content) > 100 else (first_user_msg.content if first_user_msg else "")
        last_message_at = max(n.created_at for n in nodes)

        summaries.append(SideChatThreadSummary(
            node_id=parent_id,
            selected_text=selected_text,
            message_count=len(nodes),
            last_message_at=last_message_at,
            preview_text=preview_text,
        ))

    summaries.sort(key=lambda s: s.last_message_at, reverse=True)
    return summaries


# Nested route for sessions within a topic
topics_sessions_router = APIRouter(prefix="/topics/{topic_id}/sessions", tags=["sessions"])


@topics_sessions_router.get("", response_model=List[SessionResponse])
async def list_topic_sessions(
    topic_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[Session]:
    """List all sessions in a topic."""
    await verify_topic_ownership(topic_id, current_user, db)

    result = await db.execute(
        select(Session)
        .where(Session.topic_id == topic_id)
        .order_by(Session.updated_at.desc())
    )
    return list(result.scalars().all())
