"""Chat API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import json

from api.auth import get_current_user
from models.database import Session, Node, Topic, User, UserPreferences, NodeType, get_db, async_session_maker
from models.schemas import ChatRequest, ChatResponse, NodeResponse, SideChatRequest, AVAILABLE_MODELS
from services.chat_service import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


async def get_user_preferences(user_id: UUID, db: AsyncSession) -> UserPreferences | None:
    """Fetch user preferences for the current user."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )
    return result.scalar_one_or_none()


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


async def verify_node_ownership(node_id: UUID, user: User, db: AsyncSession) -> Node:
    """Verify that a node belongs to the current user (via session -> topic)."""
    result = await db.execute(
        select(Node)
        .join(Session)
        .join(Topic)
        .where(Node.id == node_id, Topic.user_id == user.id)
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.post("", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Send a message and get AI response."""
    session = await verify_session_ownership(request.session_id, current_user, db)

    if request.parent_node_id:
        await verify_node_ownership(request.parent_node_id, current_user, db)

    # Fetch user preferences for system prompt injection
    preferences = await get_user_preferences(current_user.id, db)

    # Resolve which model to use
    model = chat_service.resolve_model(
        request.model,
        session.default_model,
        preferences.preferred_model if preferences else None
    )

    user_node = await chat_service.create_user_node(
        db=db,
        session_id=request.session_id,
        parent_id=request.parent_node_id,
        content=request.content
    )

    path = []
    if request.parent_node_id:
        path = await chat_service.get_conversation_path(db, request.parent_node_id)

    messages = chat_service.build_messages(path, request.content, preferences)
    response_content = await chat_service.generate_response(messages, model=model)

    assistant_node = await chat_service.create_assistant_node(
        db=db,
        session_id=request.session_id,
        parent_id=user_node.id,
        content=response_content,
        model=model
    )

    return ChatResponse(
        user_node=NodeResponse.model_validate(user_node),
        assistant_node=NodeResponse.model_validate(assistant_node),
        memories_used=[]
    )


@router.post("/stream")
async def send_message_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message and get streaming AI response."""
    session = await verify_session_ownership(request.session_id, current_user, db)

    if request.parent_node_id:
        await verify_node_ownership(request.parent_node_id, current_user, db)

    # Fetch user preferences for system prompt injection
    preferences = await get_user_preferences(current_user.id, db)

    # Resolve which model to use
    model = chat_service.resolve_model(
        request.model,
        session.default_model,
        preferences.preferred_model if preferences else None
    )

    user_node = await chat_service.create_user_node(
        db=db,
        session_id=request.session_id,
        parent_id=request.parent_node_id,
        content=request.content
    )
    await db.commit()

    path = []
    if request.parent_node_id:
        path = await chat_service.get_conversation_path(db, request.parent_node_id)

    messages = chat_service.build_messages(path, request.content, preferences)

    session_id = request.session_id
    user_node_id = user_node.id
    user_node_response = NodeResponse.model_validate(user_node).model_dump(mode='json')

    async def stream_response():
        full_response = ""
        yield f"data: {json.dumps({'type': 'user_node', 'node': user_node_response})}\n\n"

        async for token in chat_service.generate_response_stream(messages, model=model):
            full_response += token
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        async with async_session_maker() as stream_db:
            try:
                assistant_node = await chat_service.create_assistant_node(
                    db=stream_db,
                    session_id=session_id,
                    parent_id=user_node_id,
                    content=full_response,
                    model=model
                )
                await stream_db.commit()
                yield f"data: {json.dumps({'type': 'complete', 'node': NodeResponse.model_validate(assistant_node).model_dump(mode='json')})}\n\n"
            except Exception as e:
                await stream_db.rollback()
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.post("/side-chat/stream")
async def send_side_chat_stream(
    request: SideChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message in a side chat and get streaming AI response."""
    parent_node = await verify_node_ownership(request.parent_node_id, current_user, db)

    # Fetch session for model resolution
    result = await db.execute(select(Session).where(Session.id == parent_node.session_id))
    session = result.scalar_one()

    # Fetch user preferences for system prompt injection
    preferences = await get_user_preferences(current_user.id, db)

    # Resolve which model to use
    model = chat_service.resolve_model(
        request.model,
        session.default_model,
        preferences.preferred_model if preferences else None
    )

    main_path = await chat_service.get_conversation_path(db, request.parent_node_id)

    side_chat_query = (
        select(Node)
        .where(
            Node.parent_id == request.parent_node_id,
            Node.node_type.in_([NodeType.SIDE_CHAT_USER, NodeType.SIDE_CHAT_ASSISTANT])
        )
    )
    if request.selected_text is not None:
        side_chat_query = side_chat_query.where(Node.selected_text == request.selected_text)
    else:
        side_chat_query = side_chat_query.where(Node.selected_text.is_(None))

    side_chat_query = side_chat_query.order_by(Node.created_at)
    result = await db.execute(side_chat_query)
    side_chat_history = list(result.scalars().all())

    user_node = await chat_service.create_user_node(
        db=db,
        session_id=parent_node.session_id,
        parent_id=request.parent_node_id,
        content=request.content,
        node_type='side_chat_user',
        selected_text=request.selected_text,
        selection_start=request.selection_start,
        selection_end=request.selection_end
    )
    await db.commit()

    messages = chat_service.build_side_chat_messages(
        main_path, side_chat_history, request.content, request.selected_text,
        request.include_main_context, preferences
    )

    session_id = parent_node.session_id
    parent_node_id = request.parent_node_id
    selected_text = request.selected_text
    selection_start = request.selection_start
    selection_end = request.selection_end
    user_node_response = NodeResponse.model_validate(user_node).model_dump(mode='json')

    async def stream_response():
        full_response = ""
        yield f"data: {json.dumps({'type': 'user_node', 'node': user_node_response})}\n\n"

        async for token in chat_service.generate_response_stream(messages, model=model):
            full_response += token
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        async with async_session_maker() as stream_db:
            try:
                assistant_node = await chat_service.create_assistant_node(
                    db=stream_db,
                    session_id=session_id,
                    parent_id=parent_node_id,
                    content=full_response,
                    node_type='side_chat_assistant',
                    selected_text=selected_text,
                    selection_start=selection_start,
                    selection_end=selection_end,
                    model=model
                )
                await stream_db.commit()
                yield f"data: {json.dumps({'type': 'complete', 'node': NodeResponse.model_validate(assistant_node).model_dump(mode='json')})}\n\n"
            except Exception as e:
                await stream_db.rollback()
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.post("/regenerate/{node_id}", response_model=NodeResponse)
async def regenerate_response(
    node_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NodeResponse:
    """Regenerate an assistant response (creates sibling)."""
    node = await verify_node_ownership(node_id, current_user, db)

    if node.node_type != "assistant_message":
        raise HTTPException(status_code=400, detail="Can only regenerate assistant messages")

    if not node.parent_id:
        raise HTTPException(status_code=400, detail="Cannot regenerate root node")

    # Fetch session for model resolution
    result = await db.execute(select(Session).where(Session.id == node.session_id))
    session = result.scalar_one()

    # Fetch user preferences for system prompt injection
    preferences = await get_user_preferences(current_user.id, db)

    # Resolve which model to use (use original node's model if available)
    original_model = node.generation_config.get("model") if node.generation_config else None
    model = chat_service.resolve_model(
        original_model,
        session.default_model,
        preferences.preferred_model if preferences else None
    )

    path = await chat_service.get_conversation_path(db, node.parent_id)

    result = await db.execute(select(Node).where(Node.id == node.parent_id))
    user_node = result.scalar_one()

    messages = chat_service.build_messages(path[:-1] if path else [], user_node.content, preferences)
    response_content = await chat_service.generate_response(messages, model=model)

    result = await db.execute(select(Node).where(Node.parent_id == node.parent_id))
    siblings = result.scalars().all()

    new_node = Node(
        session_id=node.session_id,
        parent_id=node.parent_id,
        content=response_content,
        node_type=node.node_type,
        sibling_index=len(siblings),
        is_selected_path=True,
        generation_config={
            "provider": chat_service.get_provider(model),
            "model": model,
            "temperature": chat_service.default_temperature
        }
    )

    node.is_selected_path = False
    db.add(new_node)
    await db.flush()
    await db.refresh(new_node)

    return NodeResponse.model_validate(new_node)


@router.get("/models")
async def list_models():
    """Return available LLM models."""
    from config import settings
    return {"models": AVAILABLE_MODELS, "default": settings.default_model}
