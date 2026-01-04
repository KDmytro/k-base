"""Chat API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import json

from models.database import Session, Node, NodeType, get_db, async_session_maker
from models.schemas import ChatRequest, ChatResponse, NodeResponse, SideChatRequest
from services.chat_service import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
) -> ChatResponse:
    """Send a message and get AI response."""
    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == request.session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify parent node exists if specified
    if request.parent_node_id:
        result = await db.execute(select(Node).where(Node.id == request.parent_node_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Parent node not found")

    # Create user message node
    user_node = await chat_service.create_user_node(
        db=db,
        session_id=request.session_id,
        parent_id=request.parent_node_id,
        content=request.content
    )

    # Build conversation context
    path = []
    if request.parent_node_id:
        path = await chat_service.get_conversation_path(db, request.parent_node_id)

    messages = chat_service.build_messages(path, request.content)

    # Generate AI response
    response_content = await chat_service.generate_response(messages)

    # Create assistant message node
    assistant_node = await chat_service.create_assistant_node(
        db=db,
        session_id=request.session_id,
        parent_id=user_node.id,
        content=response_content
    )

    return ChatResponse(
        user_node=NodeResponse.model_validate(user_node),
        assistant_node=NodeResponse.model_validate(assistant_node),
        memories_used=[]  # RAG not implemented yet
    )


@router.post("/stream")
async def send_message_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send a message and get streaming AI response."""
    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == request.session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify parent node exists if specified
    if request.parent_node_id:
        result = await db.execute(select(Node).where(Node.id == request.parent_node_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Parent node not found")

    # Create user message node
    user_node = await chat_service.create_user_node(
        db=db,
        session_id=request.session_id,
        parent_id=request.parent_node_id,
        content=request.content
    )
    # Commit user node immediately so it's saved even if streaming fails
    await db.commit()

    # Build conversation context
    path = []
    if request.parent_node_id:
        path = await chat_service.get_conversation_path(db, request.parent_node_id)

    messages = chat_service.build_messages(path, request.content)

    # Capture values needed in generator (db session will be closed)
    session_id = request.session_id
    user_node_id = user_node.id
    user_node_response = NodeResponse.model_validate(user_node).model_dump(mode='json')

    async def stream_response():
        full_response = ""

        # Send user node info first
        yield f"data: {json.dumps({'type': 'user_node', 'node': user_node_response})}\n\n"

        # Stream AI response tokens
        async for token in chat_service.generate_response_stream(messages):
            full_response += token
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        # Create assistant node with full response using a NEW database session
        async with async_session_maker() as stream_db:
            try:
                assistant_node = await chat_service.create_assistant_node(
                    db=stream_db,
                    session_id=session_id,
                    parent_id=user_node_id,
                    content=full_response
                )
                await stream_db.commit()

                # Send completion with assistant node
                yield f"data: {json.dumps({'type': 'complete', 'node': NodeResponse.model_validate(assistant_node).model_dump(mode='json')})}\n\n"
            except Exception as e:
                await stream_db.rollback()
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/side-chat/stream")
async def send_side_chat_stream(
    request: SideChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send a message in a side chat and get streaming AI response."""
    # Verify parent node exists
    result = await db.execute(select(Node).where(Node.id == request.parent_node_id))
    parent_node = result.scalar_one_or_none()
    if not parent_node:
        raise HTTPException(status_code=404, detail="Parent node not found")

    # Get the main conversation path up to the parent node
    main_path = await chat_service.get_conversation_path(db, request.parent_node_id)

    # Get existing side chat history
    result = await db.execute(
        select(Node)
        .where(
            Node.parent_id == request.parent_node_id,
            Node.node_type.in_([NodeType.SIDE_CHAT_USER, NodeType.SIDE_CHAT_ASSISTANT])
        )
        .order_by(Node.created_at)
    )
    side_chat_history = list(result.scalars().all())

    # Create user side chat node
    user_node = await chat_service.create_user_node(
        db=db,
        session_id=parent_node.session_id,
        parent_id=request.parent_node_id,
        content=request.content,
        node_type='side_chat_user',
        selected_text=request.selected_text  # Store the text that started this thread
    )
    await db.commit()

    # Build side chat context
    messages = chat_service.build_side_chat_messages(
        main_path, side_chat_history, request.content, request.selected_text,
        request.include_main_context
    )

    # Capture values for generator
    session_id = parent_node.session_id
    user_node_id = user_node.id
    parent_node_id = request.parent_node_id
    selected_text = request.selected_text  # Capture for assistant node
    user_node_response = NodeResponse.model_validate(user_node).model_dump(mode='json')

    async def stream_response():
        full_response = ""

        # Send user node info first
        yield f"data: {json.dumps({'type': 'user_node', 'node': user_node_response})}\n\n"

        # Stream AI response tokens
        async for token in chat_service.generate_response_stream(messages):
            full_response += token
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        # Create assistant node with full response using a NEW database session
        async with async_session_maker() as stream_db:
            try:
                assistant_node = await chat_service.create_assistant_node(
                    db=stream_db,
                    session_id=session_id,
                    parent_id=parent_node_id,  # Side chat assistant is also child of parent node
                    content=full_response,
                    node_type='side_chat_assistant',
                    selected_text=selected_text  # Store the same text as the user node
                )
                await stream_db.commit()

                # Send completion with assistant node
                yield f"data: {json.dumps({'type': 'complete', 'node': NodeResponse.model_validate(assistant_node).model_dump(mode='json')})}\n\n"
            except Exception as e:
                await stream_db.rollback()
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/regenerate/{node_id}", response_model=NodeResponse)
async def regenerate_response(
    node_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> NodeResponse:
    """Regenerate an assistant response (creates sibling)."""
    # Get the node to regenerate
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    if node.node_type != "assistant_message":
        raise HTTPException(status_code=400, detail="Can only regenerate assistant messages")

    # Get the parent (user message)
    if not node.parent_id:
        raise HTTPException(status_code=400, detail="Cannot regenerate root node")

    # Get conversation path up to the user message
    path = await chat_service.get_conversation_path(db, node.parent_id)

    # Get the user message content
    result = await db.execute(select(Node).where(Node.id == node.parent_id))
    user_node = result.scalar_one()

    messages = chat_service.build_messages(path[:-1] if path else [], user_node.content)

    # Generate new response
    response_content = await chat_service.generate_response(messages)

    # Create new assistant node as sibling
    result = await db.execute(
        select(Node).where(Node.parent_id == node.parent_id)
    )
    siblings = result.scalars().all()

    new_node = Node(
        session_id=node.session_id,
        parent_id=node.parent_id,
        content=response_content,
        node_type=node.node_type,
        sibling_index=len(siblings),
        is_selected_path=True,
        generation_config={
            "provider": "openai",
            "model": chat_service.default_model,
            "temperature": chat_service.default_temperature
        }
    )

    # Mark old node as not selected
    node.is_selected_path = False

    db.add(new_node)
    await db.flush()
    await db.refresh(new_node)

    return NodeResponse.model_validate(new_node)
