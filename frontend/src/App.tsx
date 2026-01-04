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

  // Load session nodes when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadSession(currentSessionId);
    } else {
      setNodes([]);
      setCurrentSession(null);
    }
  }, [currentSessionId]);

  const loadSession = async (sessionId: string) => {
    try {
      const session = await apiClient.getSession(sessionId);
      setCurrentSession(session);

      // Load the conversation path if there's a root node
      if (session.rootNodeId) {
        const path = await apiClient.getNodePath(session.rootNodeId);
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
    let currentId: string | null = rootNodeId;

    while (currentId) {
      try {
        const node = await apiClient.getNode(currentId);
        thread.push(node);

        // Get children and follow the selected path
        const children = await apiClient.getNodeChildren(currentId);
        const selectedChild = children.find((c) => c.isSelectedPath);
        currentId = selectedChild?.id || null;
      } catch {
        break;
      }
    }

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

  const handleSendMessage = useCallback(async (message: string) => {
    if (!currentSessionId) return;

    setIsLoading(true);

    try {
      // Get the last node ID for parent reference
      const parentNodeId = nodes.length > 0 ? nodes[nodes.length - 1].id : undefined;

      const response = await apiClient.sendMessage({
        sessionId: currentSessionId,
        parentNodeId,
        content: message,
      });

      // Add both user and assistant nodes to the thread
      setNodes((prev) => [...prev, response.userNode, response.assistantNode]);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Show error to user
      alert('Failed to send message. Please check your OpenAI API key in backend/.env');
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, nodes]);

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
            sessionName={currentSession?.name}
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
