"""Nodes API routes."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import Node, Session, NodeType, get_db
from models.schemas import NodeUpdate, NodeResponse, NoteRequest

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


@router.get("/{node_id}/siblings", response_model=List[NodeResponse])
async def get_node_siblings(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> List[Node]:
    """Get all siblings of a node (nodes with the same parent).

    Only returns main conversation nodes (user_message, assistant_message)
    to exclude notes and side chats from branch switching.
    """
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    if not node.parent_id:
        # Root node has no siblings
        return [node]

    # Get all main conversation siblings (user_message or assistant_message)
    result = await db.execute(
        select(Node)
        .where(
            Node.parent_id == node.parent_id,
            Node.node_type.in_([NodeType.USER_MESSAGE, NodeType.ASSISTANT_MESSAGE])
        )
        .order_by(Node.sibling_index, Node.created_at)
    )
    return list(result.scalars().all())


@router.post("/{node_id}/select", response_model=NodeResponse)
async def select_branch(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> Node:
    """Select this node as the active branch (marks siblings as not selected).

    Only modifies main conversation siblings to avoid affecting notes and side chats.
    """
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    if node.parent_id:
        # Mark all main conversation siblings as not selected
        result = await db.execute(
            select(Node).where(
                Node.parent_id == node.parent_id,
                Node.node_type.in_([NodeType.USER_MESSAGE, NodeType.ASSISTANT_MESSAGE])
            )
        )
        siblings = result.scalars().all()
        for sibling in siblings:
            sibling.is_selected_path = (sibling.id == node_id)

    node.is_selected_path = True
    await db.flush()
    await db.refresh(node)
    return node


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


# ============================================
# Note Endpoints
# ============================================

@router.post("/{node_id}/note", response_model=NodeResponse)
async def add_note(
    node_id: UUID,
    request: NoteRequest,
    db: AsyncSession = Depends(get_db)
) -> Node:
    """Add or update a note on a node."""
    # Verify parent node exists
    result = await db.execute(select(Node).where(Node.id == node_id))
    parent_node = result.scalar_one_or_none()
    if not parent_node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Check if note already exists (child with node_type=user_note)
    result = await db.execute(
        select(Node)
        .where(Node.parent_id == node_id, Node.node_type == NodeType.USER_NOTE)
    )
    existing_note = result.scalar_one_or_none()

    if existing_note:
        # Update existing note
        existing_note.content = request.content
        await db.flush()
        await db.refresh(existing_note)
        return existing_note
    else:
        # Create new note
        note = Node(
            session_id=parent_node.session_id,
            parent_id=node_id,
            content=request.content,
            node_type=NodeType.USER_NOTE,
            sibling_index=0,
            is_selected_path=False,  # Notes don't participate in path selection
        )
        db.add(note)
        await db.flush()
        await db.refresh(note)
        return note


@router.get("/{node_id}/note", response_model=NodeResponse)
async def get_note(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> Node:
    """Get the note attached to a node."""
    # Verify parent node exists
    result = await db.execute(select(Node).where(Node.id == node_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Node not found")

    # Get note (child with node_type=user_note)
    result = await db.execute(
        select(Node)
        .where(Node.parent_id == node_id, Node.node_type == NodeType.USER_NOTE)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.delete("/{node_id}/note", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete the note attached to a node."""
    # Verify parent node exists
    result = await db.execute(select(Node).where(Node.id == node_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Node not found")

    # Get and delete note
    result = await db.execute(
        select(Node)
        .where(Node.parent_id == node_id, Node.node_type == NodeType.USER_NOTE)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)


# ============================================
# Side Chat Endpoints
# ============================================

@router.get("/{node_id}/side-chat-threads")
async def get_side_chat_threads(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get unique selected_text values that have side chats for a node.

    Returns a list of threads, each with the selected_text and message count.
    """
    # Verify parent node exists
    result = await db.execute(select(Node).where(Node.id == node_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Node not found")

    # Get unique selected_text values with counts
    result = await db.execute(
        select(Node.selected_text, func.count(Node.id).label('message_count'))
        .where(
            Node.parent_id == node_id,
            Node.node_type.in_([NodeType.SIDE_CHAT_USER, NodeType.SIDE_CHAT_ASSISTANT])
        )
        .group_by(Node.selected_text)
        .order_by(func.min(Node.created_at))  # Order by first message in thread
    )
    rows = result.all()
    return [{"selected_text": row.selected_text, "count": row.message_count} for row in rows]


@router.get("/{node_id}/side-chats", response_model=List[NodeResponse])
async def get_side_chats(
    node_id: UUID,
    selected_text: Optional[str] = Query(None, description="Filter to specific thread by selected text"),
    db: AsyncSession = Depends(get_db)
) -> List[Node]:
    """Get side chat messages for a node, optionally filtered by selected_text thread."""
    # Verify parent node exists
    result = await db.execute(select(Node).where(Node.id == node_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Node not found")

    # Build query
    query = select(Node).where(
        Node.parent_id == node_id,
        Node.node_type.in_([NodeType.SIDE_CHAT_USER, NodeType.SIDE_CHAT_ASSISTANT])
    )

    # Filter by selected_text if provided
    if selected_text is not None:
        query = query.where(Node.selected_text == selected_text)

    query = query.order_by(Node.created_at)
    result = await db.execute(query)
    return list(result.scalars().all())


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
