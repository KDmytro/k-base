import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatThread } from '@/components/chat/ChatThread';
import { apiClient } from '@/api/client';
import type { Node, Session } from '@/types/models';

function App() {
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyToNode, setReplyToNode] = useState<Node | null>(null);

  // Branch switching state
  const [siblingCounts, setSiblingCounts] = useState<Map<string, number>>(new Map());
  const [branchSwitcherNodeId, setBranchSwitcherNodeId] = useState<string | null>(null);
  const [branchSwitcherSiblings, setBranchSwitcherSiblings] = useState<Node[]>([]);

  // Load session nodes when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadSession(currentSessionId);
      setReplyToNode(null); // Clear any fork context when switching sessions
      setBranchSwitcherNodeId(null);
      setBranchSwitcherSiblings([]);
    } else {
      setNodes([]);
      setCurrentSession(null);
      setReplyToNode(null);
      setSiblingCounts(new Map());
      setBranchSwitcherNodeId(null);
      setBranchSwitcherSiblings([]);
    }
  }, [currentSessionId]);

  const loadSession = async (sessionId: string) => {
    try {
      const session = await apiClient.getSession(sessionId);
      setCurrentSession(session);

      // Load the conversation path if there's a root node
      if (session.rootNodeId) {
        // Get the full thread by following the selected path
        const fullThread = await loadFullThread(session.rootNodeId);
        setNodes(fullThread);
      } else {
        setNodes([]);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const loadFullThread = async (rootNodeId: string): Promise<Node[]> => {
    const thread: Node[] = [];
    const counts = new Map<string, number>();
    let currentId: string | null = rootNodeId;

    while (currentId) {
      try {
        const node = await apiClient.getNode(currentId);
        thread.push(node);

        // Get siblings count for this node
        const siblings = await apiClient.getNodeSiblings(currentId);
        counts.set(currentId, siblings.length);

        // Get children and follow the selected path
        const children = await apiClient.getNodeChildren(currentId);
        const selectedChild = children.find((c) => c.isSelectedPath);
        currentId = selectedChild?.id || null;
      } catch {
        break;
      }
    }

    setSiblingCounts(counts);
    return thread;
  };

  const handleSelectTopic = (topicId: string) => {
    setCurrentTopicId(topicId);
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleNewSession = (topicId: string, sessionId: string) => {
    setCurrentTopicId(topicId);
    setCurrentSessionId(sessionId);
  };

  const handleForkNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setReplyToNode(node);
    }
  }, [nodes]);

  const handleClearReply = useCallback(() => {
    setReplyToNode(null);
  }, []);

  // Branch switching handlers
  const handleShowBranches = useCallback(async (nodeId: string) => {
    try {
      const siblings = await apiClient.getNodeSiblings(nodeId);
      setBranchSwitcherNodeId(nodeId);
      setBranchSwitcherSiblings(siblings);
    } catch (err) {
      console.error('Failed to fetch siblings:', err);
    }
  }, []);

  const handleCloseBranchSwitcher = useCallback(() => {
    setBranchSwitcherNodeId(null);
    setBranchSwitcherSiblings([]);
  }, []);

  const handleSelectBranch = useCallback(async (nodeId: string) => {
    if (!currentSession?.rootNodeId) return;

    try {
      // Mark this node as selected in the backend
      await apiClient.selectBranch(nodeId);

      // Close the switcher
      setBranchSwitcherNodeId(null);
      setBranchSwitcherSiblings([]);

      // Reload the thread from root to show the new branch
      const fullThread = await loadFullThread(currentSession.rootNodeId);
      setNodes(fullThread);
    } catch (err) {
      console.error('Failed to switch branch:', err);
    }
  }, [currentSession]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!currentSessionId) return;

    setIsLoading(true);

    try {
      // Use replyToNode if forking, otherwise use last node
      const parentNodeId = replyToNode
        ? replyToNode.id
        : (nodes.length > 0 ? nodes[nodes.length - 1].id : undefined);

      const response = await apiClient.sendMessage({
        sessionId: currentSessionId,
        parentNodeId,
        content: message,
      });

      // If we were forking, reload the full thread to show the new branch
      if (replyToNode) {
        setReplyToNode(null);
        // Reload from the root to get the new branch as selected path
        if (currentSession?.rootNodeId) {
          const fullThread = await loadFullThread(currentSession.rootNodeId);
          setNodes(fullThread);
        }
      } else {
        // Normal case: just append the new nodes
        setNodes((prev) => [...prev, response.userNode, response.assistantNode]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Show error to user
      alert('Failed to send message. Please check your OpenAI API key in backend/.env');
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, nodes, replyToNode, currentSession]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        currentTopicId={currentTopicId}
        currentSessionId={currentSessionId}
        onSelectTopic={handleSelectTopic}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />

      <div className="flex-1 flex flex-col">
        {currentSessionId ? (
          <ChatThread
            nodes={nodes}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onForkNode={handleForkNode}
            replyToNode={replyToNode}
            onClearReply={handleClearReply}
            sessionName={currentSession?.name}
            // Branch switching props
            siblingCounts={siblingCounts}
            onShowBranches={handleShowBranches}
            branchSwitcherNodeId={branchSwitcherNodeId}
            branchSwitcherSiblings={branchSwitcherSiblings}
            onSelectBranch={handleSelectBranch}
            onCloseBranchSwitcher={handleCloseBranchSwitcher}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center text-gray-500">
              <h2 className="text-2xl font-semibold mb-2">Welcome to K-Base</h2>
              <p className="mb-4">Create a new topic or select an existing session to start</p>
              <p className="text-sm">
                Use the sidebar to create topics and sessions for your conversations
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
