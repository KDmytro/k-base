"""Chat service for handling LLM interactions."""

from typing import List, Dict, Any, AsyncGenerator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import litellm

from models.database import Node, Session, NodeType, NodeStatus
from models.schemas import NodeResponse, GenerationConfig
from config import settings


class ChatService:
    """Service for handling chat interactions with LLM."""

    def __init__(self):
        self.default_model = "gpt-4o-mini"  # Cheaper model
        self.default_temperature = 0.7
        self.default_max_tokens = 4096

    async def get_conversation_path(
        self,
        db: AsyncSession,
        node_id: UUID
    ) -> List[Node]:
        """Get the full conversation path from root to the given node."""
        path = []
        current_id = node_id

        while current_id:
            result = await db.execute(select(Node).where(Node.id == current_id))
            node = result.scalar_one_or_none()
            if not node:
                break
            path.append(node)
            current_id = node.parent_id

        path.reverse()
        return path

    def build_messages(
        self,
        path: List[Node],
        user_message: str
    ) -> List[Dict[str, str]]:
        """Build the messages array for LLM from conversation path."""
        messages = [{
            "role": "system",
            "content": """You are a helpful AI assistant for brainstorming and learning.
You are part of a branching conversation system where the user can explore
multiple lines of thinking. Stay focused on the current branch's topic.

When relevant context from other conversations is provided, use it to give
more informed and consistent responses, but don't explicitly reference
"previous conversations" unless directly relevant."""
        }]

        for node in path:
            if node.status == 'collapsed' and node.collapsed_summary:
                messages.append({
                    "role": "assistant",
                    "content": f"[Previous discussion summary: {node.collapsed_summary}]"
                })
            elif node.node_type == 'user_message':
                messages.append({"role": "user", "content": node.content})
            elif node.node_type == 'assistant_message':
                messages.append({"role": "assistant", "content": node.content})
            elif node.node_type == 'user_note':
                messages.append({
                    "role": "system",
                    "content": f"[User note: {node.content}]"
                })

        # Add the new user message
        messages.append({"role": "user", "content": user_message})

        return messages

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = None,
        max_tokens: int = None,
    ) -> str:
        """Generate a response from the LLM."""
        response = await litellm.acompletion(
            model=model or self.default_model,
            messages=messages,
            temperature=temperature or self.default_temperature,
            max_tokens=max_tokens or self.default_max_tokens,
            stream=False
        )
        return response.choices[0].message.content

    async def generate_response_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = None,
        max_tokens: int = None,
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response from the LLM."""
        response = await litellm.acompletion(
            model=model or self.default_model,
            messages=messages,
            temperature=temperature or self.default_temperature,
            max_tokens=max_tokens or self.default_max_tokens,
            stream=True
        )

        async for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def create_user_node(
        self,
        db: AsyncSession,
        session_id: UUID,
        parent_id: UUID | None,
        content: str
    ) -> Node:
        """Create a user message node."""
        # Calculate sibling index if branching
        sibling_index = 0
        if parent_id:
            result = await db.execute(
                select(Node).where(Node.parent_id == parent_id)
            )
            siblings = result.scalars().all()
            sibling_index = len(siblings)

        node = Node(
            session_id=session_id,
            parent_id=parent_id,
            content=content,
            node_type='user_message',
            sibling_index=sibling_index
        )
        db.add(node)
        await db.flush()
        await db.refresh(node)

        # Update session root_node_id if this is the first node
        if not parent_id:
            result = await db.execute(
                select(Session).where(Session.id == session_id)
            )
            session = result.scalar_one()
            if not session.root_node_id:
                session.root_node_id = node.id
                await db.flush()

        return node

    async def create_assistant_node(
        self,
        db: AsyncSession,
        session_id: UUID,
        parent_id: UUID,
        content: str,
        generation_config: Dict[str, Any] = None
    ) -> Node:
        """Create an assistant message node."""
        node = Node(
            session_id=session_id,
            parent_id=parent_id,
            content=content,
            node_type='assistant_message',
            generation_config=generation_config or {
                "provider": "openai",
                "model": self.default_model,
                "temperature": self.default_temperature
            }
        )
        db.add(node)
        await db.flush()
        await db.refresh(node)
        return node


# Singleton instance
chat_service = ChatService()
