# Changelog

All notable changes to K-Base are documented in this file.

## [Unreleased] - 2026-01-04

### Added

#### Side Chat Feature (Selection-based Threads)
- **Multiple side chat threads per message**: Users can now create separate side chat threads by selecting different text portions within an assistant message
- **Text highlighting**: Selected text that has associated side chats is highlighted with a blue underline and chat icon
- **Cross-element highlighting**: Text selections spanning multiple markdown elements (headings, bullet points, bold/italic) are now properly highlighted
- **Thread filtering**: Each side chat thread is filtered by its selected text, keeping conversations organized
- **Position-based tracking**: Selection positions (`selection_start`, `selection_end`) are stored for accurate highlighting
- **New database columns**: `selected_text`, `selection_start`, `selection_end` columns added to nodes table
- **New API endpoint**: `GET /nodes/{node_id}/side-chat-threads` returns all unique threads with positions for a node

#### Notes Feature
- **Note panel**: Slide-out panel for adding/editing notes on any message
- **Inline note display**: Notes appear below their parent message with yellow styling

#### Inline Collapsed Branches
- **Fork point indicators**: Branch icon now appears on parent nodes (fork points) instead of sibling nodes
- **Inline collapsed branch cards**: Non-active branches appear as clickable preview cards at fork points
- **First-line preview**: Collapsed branches show ~60 character preview with folder and user/bot icons
- **Always visible**: Collapsed branches are always visible at fork points for easy navigation
- **Removed dropdown**: Replaced BranchSwitcher modal with inline collapsed cards

### Fixed

#### Branch Switching
- **Fixed sibling counting**: Branch indicators now correctly count all main conversation nodes (user_message + assistant_message) as siblings, not just same-type nodes
- **Fixed fork display**: When forking creates a user_message sibling of an assistant_message, both now appear as switchable branches
- **Tree view filtering**: Tree view now only shows main conversation nodes, excluding notes and side chats

#### Side Chat
- **Fixed thread merging**: Clicking on highlighted text now opens only that specific thread, not all threads merged together
- **Fixed button behavior**: Side chat button now opens the first existing thread by default instead of showing all merged
- **Fixed thread isolation**: Different text selections now have completely separate conversation histories (LLM context is isolated per thread)
- **Fixed cross-element highlighting**: Selections spanning headings, bullet points, and paragraphs now highlight all component parts correctly

### Technical Changes

#### Backend
- Added `selected_text`, `selection_start`, `selection_end` columns to Node model (`backend/models/database.py`)
- Added position fields to NodeResponse and SideChatRequest schemas (`backend/models/schemas.py`)
- Updated `create_user_node` and `create_assistant_node` to store selection data (`backend/services/chat_service.py`)
- Added `get_side_chat_threads` endpoint with position data (`backend/api/routes/nodes.py`)
- Updated `get_side_chats` to filter by selected_text (`backend/api/routes/nodes.py`)
- Fixed side chat context building to filter history by selected_text for thread isolation (`backend/api/routes/chat.py`)
- Fixed `get_node_siblings` to include all main conversation types (`backend/api/routes/nodes.py`)
- Fixed `select_branch` to handle cross-type siblings (`backend/api/routes/nodes.py`)
- Fixed `get_session_tree` to filter node types (`backend/api/routes/sessions.py`)

#### Frontend
- Added `getSideChatThreads` and updated `getSideChats` methods with position support (`frontend/src/api/client.ts`)
- Added `sideChatThreads` state with position-based ranges for highlighting (`frontend/src/App.tsx`)
- Added `sideChatSelectionStart/End` state for tracking selection positions (`frontend/src/App.tsx`)
- Implemented `processChildrenWithHighlights` for cross-element highlighting (`frontend/src/components/chat/ChatMessage.tsx`)
- Added bidirectional text matching: selected text within element AND element within selected text
- Added recursive text extraction and position tracking for highlights
- Created `SideChatPanel` component (`frontend/src/components/chat/SideChatPanel.tsx`)
- Created `NotePanel` component (`frontend/src/components/chat/NotePanel.tsx`)
- Added `selectedText`, `selectionStart`, `selectionEnd` to Node type (`frontend/src/types/models.ts`)
- Created `CollapsedBranch` component for inline branch previews (`frontend/src/components/chat/CollapsedBranch.tsx`)
- Replaced `siblingCounts` with `forkPointBranches` state in App.tsx for tracking fork points
- Updated `ChatMessage` to show branch icon on fork points instead of siblings
- Updated `ChatThread` to render inline collapsed branches at fork points
- Removed `BranchSwitcher` dropdown component

#### Database Migrations
- `20260103_2253_add_side_chat_node_types.py`: Added side_chat_user and side_chat_assistant node types
- `20260103_2342_add_selected_text_to_nodes.py`: Added selected_text column to nodes table
- Added `selection_start` and `selection_end` columns to nodes table (manual migration)
