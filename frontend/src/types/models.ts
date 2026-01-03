/**
 * TypeScript type definitions for K-Base
 * Matches the backend Pydantic schemas
 */

export type NodeType =
    | 'user_message'
    | 'assistant_message'
    | 'user_note'
    | 'branch_summary'
    | 'system';

export type NodeStatus =
    | 'active'
    | 'collapsed'
    | 'abandoned'
    | 'merged';

export type ChunkType = 'note' | 'summary' | 'message';

export interface Topic {
    id: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Session {
    id: string;
    topicId: string;
    name: string;
    description?: string;
    rootNodeId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface GenerationConfig {
    provider: string;      // 'openai', 'anthropic', etc.
    model: string;         // 'gpt-4o', 'claude-3-5-sonnet', etc.
    temperature?: number;
    maxTokens?: number;
}

export interface Node {
    id: string;
    sessionId: string;
    parentId?: string;

    content: string;
    nodeType: NodeType;

    status: NodeStatus;
    branchName?: string;
    collapsedSummary?: string;

    generationConfig?: GenerationConfig;
    tokenCount?: number;

    siblingIndex: number;
    isSelectedPath: boolean;

    createdAt: Date;
    updatedAt: Date;

    // Frontend-only: populated during tree building
    children?: Node[];
}

export interface MemoryChunk {
    id: string;
    topicId: string;
    sessionId: string;
    nodeId?: string;
    content: string;
    contentType: ChunkType;
    priorityBoost: number;
    tokenCount?: number;
    createdAt: Date;
}

// Tree-building helper
export interface NodeWithChildren extends Node {
    children: NodeWithChildren[];
    depth: number;
}

// For the chat context builder
export interface ConversationMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ConversationContext {
    messages: ConversationMessage[];
    totalTokens: number;
    retrievedMemories: MemoryChunk[];
}

// API Request/Response types
export interface TopicCreate {
    name: string;
    description?: string;
}

export interface SessionCreate {
    topicId: string;
    name: string;
    description?: string;
}

export interface ChatRequest {
    sessionId: string;
    parentNodeId?: string;
    content: string;
    createBranch?: boolean;
    includeRag?: boolean;
}

export interface ChatResponse {
    userNode: Node;
    assistantNode: Node;
    memoriesUsed: string[];
}

export interface MemorySearchRequest {
    topicId: string;
    query: string;
    limit?: number;
    includeSessionIds?: string[];
}

export interface MemorySearchResult {
    chunkId: string;
    content: string;
    contentType: ChunkType;
    sessionId: string;
    nodeId?: string;
    similarity: float;
    priorityBoost: number;
}

export interface MemorySearchResponse {
    results: MemorySearchResult[];
    queryTokens: number;
}
