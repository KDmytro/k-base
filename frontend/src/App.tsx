import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatThread } from '@/components/chat/ChatThread';
import { apiClient } from '@/api/client';
import type { Node, Session } from '@/types/models';

function App() {
  const { topicId: urlTopicId, sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();

  const currentTopicId = urlTopicId || null;
  const currentSessionId = urlSessionId || null;
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyToNode, setReplyToNode] = useState<Node | null>(null);

  // Branch switching state
  const [siblingCounts, setSiblingCounts] = useState<Map<string, number>>(new Map());
  const [branchSwitcherNodeId, setBranchSwitcherNodeId] = useState<string | null>(null);
  const [branchSwitcherSiblings, setBranchSwitcherSiblings] = useState<Node[]>([]);

  // Tree view state
  const [treeNodes, setTreeNodes] = useState<Node[]>([]);

  // Streaming state
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Note state
  const [nodeNotes, setNodeNotes] = useState<Map<string, Node>>(new Map());
  const [notePanelNodeId, setNotePanelNodeId] = useState<string | null>(null);

  // Side chat state
  const [sideChatCounts, setSideChatCounts] = useState<Map<string, number>>(new Map());
  const [sideChatThreads, setSideChatThreads] = useState<Map<string, string[]>>(new Map()); // nodeId -> array of selected texts
  const [sideChatPanelNodeId, setSideChatPanelNodeId] = useState<string | null>(null);
  const [sideChatPanelNode, setSideChatPanelNode] = useState<Node | null>(null);
  const [sideChatSelectedText, setSideChatSelectedText] = useState<string | null>(null);
  const [sideChatMessages, setSideChatMessages] = useState<Node[]>([]);
  const [sideChatStreamingContent, setSideChatStreamingContent] = useState<string>('');
  const [isSideChatStreaming, setIsSideChatStreaming] = useState(false);

  // Load session nodes when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadSession(currentSessionId);
      setReplyToNode(null); // Clear any fork context when switching sessions
      setBranchSwitcherNodeId(null);
      setBranchSwitcherSiblings([]);
      setNotePanelNodeId(null);
      setNodeNotes(new Map());
      // Reset side chat state
      setSideChatPanelNodeId(null);
      setSideChatPanelNode(null);
      setSideChatSelectedText(null);
      setSideChatMessages([]);
      setSideChatCounts(new Map());
      setSideChatThreads(new Map());
    } else {
      setNodes([]);
      setTreeNodes([]);
      setCurrentSession(null);
      setReplyToNode(null);
      setSiblingCounts(new Map());
      setBranchSwitcherNodeId(null);
      setBranchSwitcherSiblings([]);
      setNotePanelNodeId(null);
      setNodeNotes(new Map());
      // Reset side chat state
      setSideChatPanelNodeId(null);
      setSideChatPanelNode(null);
      setSideChatSelectedText(null);
      setSideChatMessages([]);
      setSideChatCounts(new Map());
      setSideChatThreads(new Map());
    }
  }, [currentSessionId]);

  const loadSession = async (sessionId: string) => {
    try {
      const session = await apiClient.getSession(sessionId);
      setCurrentSession(session);

      // Load the full tree for the tree view
      const tree = await apiClient.getSessionTree(sessionId);
      setTreeNodes(tree);

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
    const notes = new Map<string, Node>();
    const sideChats = new Map<string, number>();
    const threads = new Map<string, string[]>();
    let currentId: string | null = rootNodeId;

    while (currentId) {
      try {
        const node = await apiClient.getNode(currentId);
        thread.push(node);

        // Get siblings count for this node
        const siblings = await apiClient.getNodeSiblings(currentId);
        counts.set(currentId, siblings.length);

        // Load note for this node
        const note = await apiClient.getNote(currentId);
        if (note) {
          notes.set(currentId, note);
        }

        // Load side chat threads for this node (for highlighting)
        const nodeThreads = await apiClient.getSideChatThreads(currentId);
        if (nodeThreads.length > 0) {
          // Count total messages
          const totalCount = nodeThreads.reduce((sum, t) => sum + t.count, 0);
          sideChats.set(currentId, totalCount);
          // Extract selected texts for highlighting (filter out null)
          const selectedTexts = nodeThreads
            .map((t) => t.selectedText)
            .filter((text): text is string => text !== null);
          if (selectedTexts.length > 0) {
            threads.set(currentId, selectedTexts);
          }
        }

        // Get children and follow the selected path (only main conversation nodes)
        const children = await apiClient.getNodeChildren(currentId);
        const mainConversationChildren = children.filter(
          (c) => c.nodeType === 'user_message' || c.nodeType === 'assistant_message'
        );
        const selectedChild = mainConversationChildren.find((c) => c.isSelectedPath);
        currentId = selectedChild?.id || null;
      } catch {
        break;
      }
    }

    setSiblingCounts(counts);
    setNodeNotes(notes);
    setSideChatCounts(sideChats);
    setSideChatThreads(threads);
    return thread;
  };

  const handleSelectTopic = (topicId: string) => {
    navigate(`/topic/${topicId}`);
  };

  const handleSelectSession = (topicId: string, sessionId: string) => {
    navigate(`/topic/${topicId}/session/${sessionId}`);
  };

  const handleNewSession = (topicId: string, sessionId: string) => {
    navigate(`/topic/${topicId}/session/${sessionId}`);
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

  // Tree view navigation handler
  const handleTreeNavigate = useCallback(async (nodeId: string) => {
    if (!currentSession?.rootNodeId || !currentSessionId) return;

    try {
      // Mark this node as selected in the backend
      await apiClient.selectBranch(nodeId);

      // Reload the thread to show the path to the selected node
      const fullThread = await loadFullThread(currentSession.rootNodeId);
      setNodes(fullThread);

      // Refresh the tree to update visual selection
      const tree = await apiClient.getSessionTree(currentSessionId);
      setTreeNodes(tree);
    } catch (err) {
      console.error('Failed to navigate tree:', err);
    }
  }, [currentSession, currentSessionId]);

  // Note handlers
  const handleOpenNotePanel = useCallback((nodeId: string) => {
    setNotePanelNodeId(nodeId);
  }, []);

  const handleCloseNotePanel = useCallback(() => {
    setNotePanelNodeId(null);
  }, []);

  const handleSaveNote = useCallback(async (nodeId: string, content: string) => {
    try {
      const note = await apiClient.addNote(nodeId, content);
      setNodeNotes((prev) => {
        const updated = new Map(prev);
        updated.set(nodeId, note);
        return updated;
      });
      setNotePanelNodeId(null);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }, []);

  const handleDeleteNote = useCallback(async (nodeId: string) => {
    try {
      await apiClient.deleteNote(nodeId);
      setNodeNotes((prev) => {
        const updated = new Map(prev);
        updated.delete(nodeId);
        return updated;
      });
      setNotePanelNodeId(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }, []);

  // Side chat handlers
  const handleOpenSideChat = useCallback(async (nodeId: string, selectedText?: string) => {
    try {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      // Filter messages by selectedText to show only this thread
      const messages = await apiClient.getSideChats(nodeId, selectedText);
      setSideChatPanelNodeId(nodeId);
      setSideChatPanelNode(node);
      setSideChatSelectedText(selectedText || null);
      setSideChatMessages(messages);
    } catch (err) {
      console.error('Failed to open side chat:', err);
    }
  }, [nodes]);

  const handleCloseSideChat = useCallback(() => {
    setSideChatPanelNodeId(null);
    setSideChatPanelNode(null);
    setSideChatSelectedText(null);
    setSideChatMessages([]);
    setSideChatStreamingContent('');
    setIsSideChatStreaming(false);
  }, []);

  const handleSendSideChat = useCallback(async (content: string, includeMainContext: boolean) => {
    if (!sideChatPanelNodeId) return;

    setSideChatStreamingContent('');
    setIsSideChatStreaming(true);

    await apiClient.sendSideChatStream(
      sideChatPanelNodeId,
      content,
      sideChatSelectedText || undefined,
      includeMainContext,
      {
        onUserNode: (userNode) => {
          setSideChatMessages((prev) => [...prev, userNode]);
        },
        onToken: (token) => {
          setSideChatStreamingContent((prev) => prev + token);
        },
        onComplete: (assistantNode) => {
          setIsSideChatStreaming(false);
          setSideChatStreamingContent('');
          setSideChatMessages((prev) => [...prev, assistantNode]);
          // Update side chat count
          setSideChatCounts((prev) => {
            const updated = new Map(prev);
            updated.set(sideChatPanelNodeId, (prev.get(sideChatPanelNodeId) || 0) + 2);
            return updated;
          });
          // Update threads for highlighting if this is a new thread
          if (sideChatSelectedText) {
            setSideChatThreads((prev) => {
              const updated = new Map(prev);
              const existing = updated.get(sideChatPanelNodeId) || [];
              if (!existing.includes(sideChatSelectedText)) {
                updated.set(sideChatPanelNodeId, [...existing, sideChatSelectedText]);
              }
              return updated;
            });
          }
        },
        onError: (error) => {
          console.error('Failed to send side chat:', error);
          setIsSideChatStreaming(false);
          setSideChatStreamingContent('');
        },
      }
    );
  }, [sideChatPanelNodeId, sideChatSelectedText]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!currentSessionId) return;

    const isFork = !!replyToNode;
    setIsLoading(true);
    setStreamingContent('');

    // Use replyToNode if forking, otherwise use last node
    const parentNodeId = replyToNode
      ? replyToNode.id
      : (nodes.length > 0 ? nodes[nodes.length - 1].id : undefined);

    // Clear fork context early
    if (replyToNode) {
      setReplyToNode(null);
    }

    await apiClient.sendMessageStream(
      {
        sessionId: currentSessionId,
        parentNodeId,
        content: message,
      },
      {
        onUserNode: (userNode) => {
          // Add user message immediately
          if (isFork) {
            // For forks, we'll reload the full thread at the end
          } else {
            setNodes((prev) => [...prev, userNode]);
          }
          setIsStreaming(true);
          setIsLoading(false);
        },
        onToken: (token) => {
          setStreamingContent((prev) => prev + token);
        },
        onComplete: async (assistantNode) => {
          setIsStreaming(false);
          setStreamingContent('');

          if (isFork && currentSession?.rootNodeId) {
            // Reload full thread for fork
            const fullThread = await loadFullThread(currentSession.rootNodeId);
            setNodes(fullThread);
          } else {
            // Append assistant node
            setNodes((prev) => [...prev, assistantNode]);
          }

          // Refresh the tree to show new nodes
          const tree = await apiClient.getSessionTree(currentSessionId);
          setTreeNodes(tree);
        },
        onError: (error) => {
          console.error('Failed to send message:', error);
          setIsLoading(false);
          setIsStreaming(false);
          setStreamingContent('');
          alert('Failed to send message. Please check your OpenAI API key in backend/.env');
        },
      }
    );
  }, [currentSessionId, nodes, replyToNode, currentSession]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        currentTopicId={currentTopicId}
        currentSessionId={currentSessionId}
        onSelectTopic={handleSelectTopic}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        treeNodes={treeNodes}
        currentPath={nodes.map(n => n.id)}
        onSelectTreeNode={handleTreeNavigate}
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
            // Streaming props
            streamingContent={streamingContent}
            isStreaming={isStreaming}
            // Note props
            nodeNotes={nodeNotes}
            notePanelNodeId={notePanelNodeId}
            onOpenNotePanel={handleOpenNotePanel}
            onCloseNotePanel={handleCloseNotePanel}
            onSaveNote={handleSaveNote}
            onDeleteNote={handleDeleteNote}
            // Side chat props
            sideChatCounts={sideChatCounts}
            sideChatThreads={sideChatThreads}
            sideChatPanelNodeId={sideChatPanelNodeId}
            sideChatPanelNode={sideChatPanelNode}
            sideChatSelectedText={sideChatSelectedText}
            sideChatMessages={sideChatMessages}
            sideChatStreamingContent={sideChatStreamingContent}
            isSideChatStreaming={isSideChatStreaming}
            onOpenSideChat={handleOpenSideChat}
            onCloseSideChat={handleCloseSideChat}
            onSendSideChat={handleSendSideChat}
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
