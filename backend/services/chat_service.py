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

    def build_side_chat_messages(
        self,
        main_path: List[Node],
        side_chat_history: List[Node],
        user_message: str,
        selected_text: str = None,
        include_main_context: bool = False
    ) -> List[Dict[str, str]]:
        """Build messages for side chat with main thread context."""
        # Build system prompt based on whether there's selected text
        if selected_text:
            system_content = f"""You are a helpful AI assistant having a side conversation.
The user has selected the following text from the conversation and wants to discuss it:

"{selected_text}"

Focus your responses on this specific selection. Be concise and relevant to the selected text."""
        else:
            system_content = """You are a helpful AI assistant having a side conversation.
The user is asking a follow-up question about a specific message in the main conversation.
Keep your responses focused and concise since this is a tangent discussion.
The main conversation context is provided for reference."""

        messages = [{"role": "system", "content": system_content}]

        # Add main thread context (summarized) - if no selected text OR explicitly requested
        if main_path and (not selected_text or include_main_context):
            context_summary = []
            for node in main_path[-5:]:  # Last 5 messages for context
                if node.node_type == 'user_message':
                    context_summary.append(f"User: {node.content[:200]}...")
                elif node.node_type == 'assistant_message':
                    context_summary.append(f"Assistant: {node.content[:200]}...")

            if context_summary:
                messages.append({
                    "role": "system",
                    "content": f"[Main conversation context:\n" + "\n".join(context_summary) + "]"
                })

        # Add side chat history
        for node in side_chat_history:
            if node.node_type == 'side_chat_user':
                messages.append({"role": "user", "content": node.content})
            elif node.node_type == 'side_chat_assistant':
                messages.append({"role": "assistant", "content": node.content})

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
        content: str,
        node_type: str = 'user_message',
        selected_text: str = None,
        selection_start: int = None,
        selection_end: int = None
    ) -> Node:
        """Create a user message node."""
        # For side chat messages, don't do sibling tracking
        is_side_chat = node_type == 'side_chat_user'

        # Calculate sibling index if branching (only for main chat)
        sibling_index = 0
        siblings = []
        if parent_id and not is_side_chat:
            # Only count siblings of the same type (excludes notes and side chats)
            result = await db.execute(
                select(Node).where(
                    Node.parent_id == parent_id,
                    Node.node_type == node_type
                )
            )
            siblings = result.scalars().all()
            sibling_index = len(siblings)

            # If branching (creating a sibling), mark existing siblings as not selected
            if sibling_index > 0:
                for sibling in siblings:
                    sibling.is_selected_path = False

        node = Node(
            session_id=session_id,
            parent_id=parent_id,
            content=content,
            node_type=node_type,
            sibling_index=sibling_index,
            is_selected_path=not is_side_chat,  # Side chat nodes don't participate in path
            selected_text=selected_text if is_side_chat else None,  # Only store for side chats
            selection_start=selection_start if is_side_chat else None,
            selection_end=selection_end if is_side_chat else None
        )
        db.add(node)
        await db.flush()
        await db.refresh(node)

        # Update session root_node_id if this is the first node (only for main chat)
        if not parent_id and not is_side_chat:
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
        generation_config: Dict[str, Any] = None,
        node_type: str = 'assistant_message',
        selected_text: str = None,
        selection_start: int = None,
        selection_end: int = None
    ) -> Node:
        """Create an assistant message node."""
        is_side_chat = node_type == 'side_chat_assistant'

        node = Node(
            session_id=session_id,
            parent_id=parent_id,
            content=content,
            node_type=node_type,
            is_selected_path=not is_side_chat,  # Side chat nodes don't participate in path
            selected_text=selected_text if is_side_chat else None,  # Only store for side chats
            selection_start=selection_start if is_side_chat else None,
            selection_end=selection_end if is_side_chat else None,
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
