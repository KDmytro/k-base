"""Nodes API routes."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import Node, Session, get_db
from models.schemas import NodeUpdate, NodeResponse

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.get("/{node_id}", response_model=NodeResponse)
async def get_node(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> Node:
    """Get a single node."""
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.get("/{node_id}/path", response_model=List[NodeResponse])
async def get_node_path(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> List[Node]:
    """Get path from root to this node."""
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    path = []
    current = node
    while current:
        path.append(current)
        if current.parent_id:
            result = await db.execute(select(Node).where(Node.id == current.parent_id))
            current = result.scalar_one_or_none()
        else:
            current = None

    path.reverse()
    return path


@router.get("/{node_id}/children", response_model=List[NodeResponse])
async def get_node_children(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> List[Node]:
    """Get direct children of a node."""
    result = await db.execute(
        select(Node)
        .where(Node.parent_id == node_id)
        .order_by(Node.sibling_index, Node.created_at)
    )
    return list(result.scalars().all())


@router.patch("/{node_id}", response_model=NodeResponse)
async def update_node(
    node_id: UUID,
    node_update: NodeUpdate,
    db: AsyncSession = Depends(get_db)
) -> Node:
    """Update a node (status, branch name, etc.)."""
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    update_data = node_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(node, field, value)

    await db.flush()
    await db.refresh(node)
    return node


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a node and all its descendants."""
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Recursively delete descendants
    async def delete_descendants(parent_id: UUID):
        result = await db.execute(select(Node).where(Node.parent_id == parent_id))
        children = result.scalars().all()
        for child in children:
            await delete_descendants(child.id)
            await db.delete(child)

    await delete_descendants(node_id)
    await db.delete(node)


# Get nodes for a session (tree root)
sessions_nodes_router = APIRouter(prefix="/sessions/{session_id}/nodes", tags=["nodes"])


@sessions_nodes_router.get("", response_model=List[NodeResponse])
async def get_session_nodes(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> List[Node]:
    """Get all root-level nodes for a session (nodes with no parent)."""
    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == session_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(Node)
        .where(Node.session_id == session_id, Node.parent_id == None)
        .order_by(Node.created_at)
    )
    return list(result.scalars().all())
