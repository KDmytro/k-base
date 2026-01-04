# Changelog

All notable changes to K-Base are documented in this file.

## [Unreleased] - 2026-01-04

### Added

#### Side Chat Feature (Selection-based Threads)
- **Multiple side chat threads per message**: Users can now create separate side chat threads by selecting different text portions within an assistant message
- **Text highlighting**: Selected text that has associated side chats is highlighted with a blue underline and chat icon
- **Cross-element highlighting**: Text selections spanning multiple markdown elements (bold, italic, etc.) are now properly highlighted
- **Thread filtering**: Each side chat thread is filtered by its selected text, keeping conversations organized
- **New database column**: `selected_text` column added to nodes table for storing thread context
- **New API endpoint**: `GET /nodes/{node_id}/side-chat-threads` returns all unique threads for a node

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

### Technical Changes

#### Backend
- Added `selected_text` column to Node model (`backend/models/database.py`)
- Added `selected_text` to NodeResponse schema (`backend/models/schemas.py`)
- Updated `create_user_node` and `create_assistant_node` to store selected_text (`backend/services/chat_service.py`)
- Added `get_side_chat_threads` endpoint (`backend/api/routes/nodes.py`)
- Updated `get_side_chats` to filter by selected_text (`backend/api/routes/nodes.py`)
- Fixed `get_node_siblings` to include all main conversation types (`backend/api/routes/nodes.py`)
- Fixed `select_branch` to handle cross-type siblings (`backend/api/routes/nodes.py`)
- Fixed `get_session_tree` to filter node types (`backend/api/routes/sessions.py`)

#### Frontend
- Added `getSideChatThreads` and updated `getSideChats` methods (`frontend/src/api/client.ts`)
- Added `sideChatThreads` state for tracking highlighted texts (`frontend/src/App.tsx`)
- Implemented `processChildrenWithHighlights` for cross-element highlighting (`frontend/src/components/chat/ChatMessage.tsx`)
- Added recursive text extraction and position tracking for highlights
- Created `SideChatPanel` component (`frontend/src/components/chat/SideChatPanel.tsx`)
- Created `NotePanel` component (`frontend/src/components/chat/NotePanel.tsx`)
- Added `selectedText` to Node type (`frontend/src/types/models.ts`)
- Created `CollapsedBranch` component for inline branch previews (`frontend/src/components/chat/CollapsedBranch.tsx`)
- Replaced `siblingCounts` with `forkPointBranches` state in App.tsx for tracking fork points
- Updated `ChatMessage` to show branch icon on fork points instead of siblings
- Updated `ChatThread` to render inline collapsed branches at fork points
- Removed `BranchSwitcher` dropdown component

#### Database Migrations
- `20260103_2253_add_side_chat_node_types.py`: Added side_chat_user and side_chat_assistant node types
- `20260103_2342_add_selected_text_to_nodes.py`: Added selected_text column to nodes table
