/**
 * Zustand store for chat state management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Topic, Session, Node } from '@/types/models';

interface ChatState {
  // Current context
  currentTopicId: string | null;
  currentSessionId: string | null;
  currentNodeId: string | null;

  // Data
  topics: Map<string, Topic>;
  sessions: Map<string, Session>;
  nodes: Map<string, Node>;

  // UI state
  expandedNodes: Set<string>;
  selectedBranches: Map<string, string>; // parentId -> selected childId
  isStreaming: boolean;

  // Actions
  setCurrentTopic: (topicId: string) => void;
  setCurrentSession: (sessionId: string) => void;
  navigateToNode: (nodeId: string) => void;

  // Node operations
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;

  // Branch operations
  selectBranch: (parentId: string, childId: string) => void;
  toggleNodeExpanded: (nodeId: string) => void;
  collapseNode: (nodeId: string, summary: string) => void;

  // Tree helpers
  getNodePath: (nodeId: string) => Node[];
  getNodeChildren: (nodeId: string) => Node[];
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    // Initial state
    currentTopicId: null,
    currentSessionId: null,
    currentNodeId: null,
    topics: new Map(),
    sessions: new Map(),
    nodes: new Map(),
    expandedNodes: new Set(),
    selectedBranches: new Map(),
    isStreaming: false,

    // Implementation
    setCurrentTopic: (topicId) =>
      set((state) => {
        state.currentTopicId = topicId;
        state.currentSessionId = null;
        state.currentNodeId = null;
      }),

    setCurrentSession: (sessionId) =>
      set((state) => {
        state.currentSessionId = sessionId;
        state.currentNodeId = null;
      }),

    navigateToNode: (nodeId) =>
      set((state) => {
        state.currentNodeId = nodeId;
        // Auto-expand path to this node
        const path = get().getNodePath(nodeId);
        path.forEach((n) => state.expandedNodes.add(n.id));
      }),

    addNode: (node) =>
      set((state) => {
        state.nodes.set(node.id, node);
      }),

    updateNode: (nodeId, updates) =>
      set((state) => {
        const node = state.nodes.get(nodeId);
        if (node) {
          state.nodes.set(nodeId, { ...node, ...updates });
        }
      }),

    deleteNode: (nodeId) =>
      set((state) => {
        state.nodes.delete(nodeId);
      }),

    selectBranch: (parentId, childId) =>
      set((state) => {
        state.selectedBranches.set(parentId, childId);
      }),

    toggleNodeExpanded: (nodeId) =>
      set((state) => {
        if (state.expandedNodes.has(nodeId)) {
          state.expandedNodes.delete(nodeId);
        } else {
          state.expandedNodes.add(nodeId);
        }
      }),

    collapseNode: (nodeId, summary) =>
      set((state) => {
        const node = state.nodes.get(nodeId);
        if (node) {
          state.nodes.set(nodeId, {
            ...node,
            status: 'collapsed',
            collapsedSummary: summary,
          });
        }
      }),

    getNodePath: (nodeId) => {
      const nodes = get().nodes;
      const path: Node[] = [];
      let currentId: string | undefined = nodeId;

      while (currentId) {
        const node = nodes.get(currentId);
        if (!node) break;
        path.unshift(node);
        currentId = node.parentId;
      }

      return path;
    },

    getNodeChildren: (nodeId) => {
      const nodes = get().nodes;
      return Array.from(nodes.values())
        .filter((node) => node.parentId === nodeId)
        .sort((a, b) => a.siblingIndex - b.siblingIndex);
    },
  }))
);
