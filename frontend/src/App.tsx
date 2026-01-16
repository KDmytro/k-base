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

  // Fork point state (nodeId -> array of child branches for nodes that have multiple children)
  const [forkPointBranches, setForkPointBranches] = useState<Map<string, Node[]>>(new Map());

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
  // Position-based highlighting: nodeId -> array of { start, end, text } for each thread
  const [sideChatThreads, setSideChatThreads] = useState<Map<string, { start: number; end: number; text: string }[]>>(new Map());
  const [sideChatPanelNodeId, setSideChatPanelNodeId] = useState<string | null>(null);
  const [sideChatPanelNode, setSideChatPanelNode] = useState<Node | null>(null);
  const [sideChatSelectedText, setSideChatSelectedText] = useState<string | null>(null);
  const [sideChatSelectionStart, setSideChatSelectionStart] = useState<number | null>(null);
  const [sideChatSelectionEnd, setSideChatSelectionEnd] = useState<number | null>(null);
  const [sideChatMessages, setSideChatMessages] = useState<Node[]>([]);
  const [sideChatStreamingContent, setSideChatStreamingContent] = useState<string>('');
  const [isSideChatStreaming, setIsSideChatStreaming] = useState(false);

  // Load session nodes when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadSession(currentSessionId);
      setReplyToNode(null); // Clear any fork context when switching sessions
      setNotePanelNodeId(null);
      setNodeNotes(new Map());
      setForkPointBranches(new Map());
      // Reset side chat state
      setSideChatPanelNodeId(null);
      setSideChatPanelNode(null);
      setSideChatSelectedText(null);
      setSideChatSelectionStart(null);
      setSideChatSelectionEnd(null);
      setSideChatMessages([]);
      setSideChatCounts(new Map());
      setSideChatThreads(new Map());
    } else {
      setNodes([]);
      setTreeNodes([]);
      setCurrentSession(null);
      setReplyToNode(null);
      setForkPointBranches(new Map());
      setNotePanelNodeId(null);
      setNodeNotes(new Map());
      // Reset side chat state
      setSideChatPanelNodeId(null);
      setSideChatPanelNode(null);
      setSideChatSelectedText(null);
      setSideChatSelectionStart(null);
      setSideChatSelectionEnd(null);
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
    const forkPoints = new Map<string, Node[]>();
    const notes = new Map<string, Node>();
    const sideChats = new Map<string, number>();
    const threads = new Map<string, { start: number; end: number; text: string }[]>();
    let currentId: string | null = rootNodeId;

    while (currentId) {
      try {
        const node = await apiClient.getNode(currentId);
        thread.push(node);

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
          // Extract ranges for highlighting - use positions if available, otherwise use text
          const positionRanges = nodeThreads
            .filter((t) => t.selectedText !== null)
            .map((t) => ({
              // Use actual positions if available, otherwise use -1 to indicate text-only matching
              start: t.selectionStart ?? -1,
              end: t.selectionEnd ?? -1,
              text: t.selectedText as string
            }));
          if (positionRanges.length > 0) {
            threads.set(currentId, positionRanges);
          }
        }

        // Get children and follow the selected path (only main conversation nodes)
        const children = await apiClient.getNodeChildren(currentId);
        const mainConversationChildren = children.filter(
          (c) => c.nodeType === 'user_message' || c.nodeType === 'assistant_message'
        );

        // If this node has multiple main children, it's a fork point
        if (mainConversationChildren.length > 1) {
          forkPoints.set(currentId, mainConversationChildren);
        }

        const selectedChild = mainConversationChildren.find((c) => c.isSelectedPath);
        currentId = selectedChild?.id || null;
      } catch {
        break;
      }
    }

    setForkPointBranches(forkPoints);
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

  // Branch switching handler
  const handleSelectBranch = useCallback(async (nodeId: string) => {
    if (!currentSession?.rootNodeId) return;

    try {
      // Mark this node as selected in the backend
      await apiClient.selectBranch(nodeId);

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
  const handleOpenSideChat = useCallback(async (
    nodeId: string,
    selectedText?: string,
    selectionStart?: number,
    selectionEnd?: number
  ) => {
    try {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      // Filter messages by selectedText to show only this thread
      const messages = await apiClient.getSideChats(nodeId, selectedText);
      setSideChatPanelNodeId(nodeId);
      setSideChatPanelNode(node);
      setSideChatSelectedText(selectedText || null);
      setSideChatSelectionStart(selectionStart ?? null);
      setSideChatSelectionEnd(selectionEnd ?? null);
      setSideChatMessages(messages);
    } catch (err) {
      console.error('Failed to open side chat:', err);
    }
  }, [nodes]);

  const handleCloseSideChat = useCallback(() => {
    setSideChatPanelNodeId(null);
    setSideChatPanelNode(null);
    setSideChatSelectedText(null);
    setSideChatSelectionStart(null);
    setSideChatSelectionEnd(null);
    setSideChatMessages([]);
    setSideChatStreamingContent('');
    setIsSideChatStreaming(false);
  }, []);

  // Handler for opening side chat from sidebar navigation
  const handleOpenSideChatFromNav = useCallback(async (nodeId: string, selectedText: string | null) => {
    // First, scroll to the node in the main chat view
    const element = document.getElementById(`message-${nodeId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight effect
      element.classList.add('ring-2', 'ring-blue-400', 'ring-opacity-75');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-400', 'ring-opacity-75');
      }, 2000);
    }

    // Then open the side chat panel
    handleOpenSideChat(nodeId, selectedText || undefined, undefined, undefined);
  }, [handleOpenSideChat]);

  const handleSendSideChat = useCallback(async (content: string, includeMainContext: boolean) => {
    if (!sideChatPanelNodeId) return;

    setSideChatStreamingContent('');
    setIsSideChatStreaming(true);

    await apiClient.sendSideChatStream(
      sideChatPanelNodeId,
      content,
      sideChatSelectedText || undefined,
      sideChatSelectionStart ?? undefined,
      sideChatSelectionEnd ?? undefined,
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
          // Update threads for highlighting if this is a new thread with positions
          if (sideChatSelectedText && sideChatSelectionStart !== null && sideChatSelectionEnd !== null) {
            setSideChatThreads((prev) => {
              const updated = new Map(prev);
              const existing = updated.get(sideChatPanelNodeId) || [];
              // Check if this range already exists
              const alreadyExists = existing.some(
                (r) => r.start === sideChatSelectionStart && r.end === sideChatSelectionEnd
              );
              if (!alreadyExists) {
                updated.set(sideChatPanelNodeId, [
                  ...existing,
                  { start: sideChatSelectionStart, end: sideChatSelectionEnd, text: sideChatSelectedText }
                ]);
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
  }, [sideChatPanelNodeId, sideChatSelectedText, sideChatSelectionStart, sideChatSelectionEnd]);

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
        onOpenSideChat={handleOpenSideChatFromNav}
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
            forkPointBranches={forkPointBranches}
            onSelectBranch={handleSelectBranch}
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
