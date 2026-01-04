"""Topics API routes."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import Topic, get_db
from models.schemas import TopicCreate, TopicUpdate, TopicResponse

router = APIRouter(prefix="/topics", tags=["topics"])


@router.post("", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
async def create_topic(
    topic: TopicCreate,
    db: AsyncSession = Depends(get_db)
) -> Topic:
    """Create a new topic."""
    db_topic = Topic(name=topic.name, description=topic.description)
    db.add(db_topic)
    await db.flush()
    await db.refresh(db_topic)
    return db_topic


@router.get("", response_model=List[TopicResponse])
async def list_topics(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
) -> List[Topic]:
    """List all topics."""
    result = await db.execute(
        select(Topic)
        .order_by(Topic.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{topic_id}", response_model=TopicResponse)
async def get_topic(
    topic_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> Topic:
    """Get a topic by ID."""
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.patch("/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: UUID,
    topic_update: TopicUpdate,
    db: AsyncSession = Depends(get_db)
) -> Topic:
    """Update a topic."""
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    update_data = topic_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(topic, field, value)

    await db.flush()
    await db.refresh(topic)
    return topic


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(
    topic_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a topic and all its sessions/nodes."""
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    await db.delete(topic)
