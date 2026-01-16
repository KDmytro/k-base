import { useState, useEffect } from 'react';
import { Plus, MessageSquare, FolderOpen, GitBranch, Pencil, MessageSquarePlus, LogOut, User, Settings } from 'lucide-react';
import { apiClient } from '@/api/client';
import { TreeView } from './TreeView';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Topic, Session, Node, SideChatThread } from '@/types/models';

interface SidebarProps {
  currentTopicId: string | null;
  currentSessionId: string | null;
  onSelectTopic: (topicId: string) => void;
  onSelectSession: (topicId: string, sessionId: string) => void;
  onNewSession: (topicId: string, sessionId: string) => void;
  // Tree view props
  treeNodes?: Node[];
  currentPath?: string[];
  onSelectTreeNode?: (nodeId: string) => void;
  // Side chat navigation
  onOpenSideChat?: (nodeId: string, selectedText: string | null) => void;
}

export function Sidebar({
  currentTopicId,
  currentSessionId,
  onSelectTopic,
  onSelectSession,
  onNewSession,
  treeNodes,
  currentPath,
  onSelectTreeNode,
  onOpenSideChat,
}: SidebarProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<Map<string, Session[]>>(new Map());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  // Side chat threads state
  const [sessionSideChats, setSessionSideChats] = useState<Map<string, SideChatThread[]>>(new Map());

  useEffect(() => {
    loadTopics();
  }, []);

  useEffect(() => {
    if (currentTopicId && !sessions.has(currentTopicId)) {
      loadSessions(currentTopicId);
    }
  }, [currentTopicId]);

  // Load side chat threads when session changes
  useEffect(() => {
    if (currentSessionId && !sessionSideChats.has(currentSessionId)) {
      loadSideChatThreads(currentSessionId);
    }
  }, [currentSessionId]);

  const loadTopics = async () => {
    try {
      const data = await apiClient.getTopics();
      setTopics(data);
    } catch (err) {
      console.error('Failed to load topics:', err);
    }
  };

  const loadSessions = async (topicId: string) => {
    try {
      const data = await apiClient.getSessions(topicId);
      setSessions((prev) => new Map(prev).set(topicId, data));
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadSideChatThreads = async (sessionId: string) => {
    try {
      const data = await apiClient.getSessionSideChatThreads(sessionId);
      setSessionSideChats((prev) => new Map(prev).set(sessionId, data));
    } catch (err) {
      console.error('Failed to load side chat threads:', err);
    }
  };

  const handleSideChatClick = (nodeId: string, selectedText: string | null) => {
    if (onOpenSideChat) {
      onOpenSideChat(nodeId, selectedText);
    }
  };

  const handleCreateTopic = async () => {
    if (!newTopicName.trim()) return;
    try {
      const topic = await apiClient.createTopic({ name: newTopicName.trim() });
      setTopics((prev) => [topic, ...prev]);
      setNewTopicName('');
      setIsCreatingTopic(false);

      // Auto-create a session for the new topic
      const session = await apiClient.createSession({
        topicId: topic.id,
        name: 'New Session',
      });
      setSessions((prev) => new Map(prev).set(topic.id, [session]));
      setExpandedTopics((prev) => new Set(prev).add(topic.id));
      onNewSession(topic.id, session.id);
    } catch (err) {
      console.error('Failed to create topic:', err);
    }
  };

  const handleCreateSession = async (topicId: string) => {
    try {
      const existingSessions = sessions.get(topicId) || [];
      const session = await apiClient.createSession({
        topicId,
        name: `Session ${existingSessions.length + 1}`,
      });
      setSessions((prev) => {
        const updated = new Map(prev);
        updated.set(topicId, [...(updated.get(topicId) || []), session]);
        return updated;
      });
      onNewSession(topicId, session.id);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleStartRename = (session: Session) => {
    setEditingSessionId(session.id);
    setEditingSessionName(session.name);
  };

  const handleRenameSession = async (topicId: string) => {
    if (!editingSessionId || !editingSessionName.trim()) {
      setEditingSessionId(null);
      return;
    }

    try {
      const updated = await apiClient.updateSession(editingSessionId, {
        name: editingSessionName.trim(),
      });
      setSessions((prev) => {
        const newMap = new Map(prev);
        const topicSessions = newMap.get(topicId) || [];
        newMap.set(
          topicId,
          topicSessions.map((s) => (s.id === updated.id ? updated : s))
        );
        return newMap;
      });
    } catch (err) {
      console.error('Failed to rename session:', err);
    } finally {
      setEditingSessionId(null);
      setEditingSessionName('');
    }
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
        if (!sessions.has(topicId)) {
          loadSessions(topicId);
        }
      }
      return next;
    });
    onSelectTopic(topicId);
  };

  return (
    <div className="w-64 bg-gray-900 text-gray-100 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">K-Base</h1>
      </div>

      <div className="p-2">
        {isCreatingTopic ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTopic()}
              placeholder="Topic name..."
              className="flex-1 px-2 py-1 bg-gray-800 rounded text-sm text-white placeholder-gray-400"
              autoFocus
            />
            <button
              onClick={handleCreateTopic}
              className="px-2 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreatingTopic(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-800"
          >
            <Plus size={16} />
            New Topic
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {topics.map((topic) => (
          <div key={topic.id}>
            <button
              onClick={() => toggleTopic(topic.id)}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800 ${
                currentTopicId === topic.id ? 'bg-gray-800' : ''
              }`}
            >
              <FolderOpen size={16} className="text-gray-400" />
              <span className="truncate flex-1 text-left">{topic.name}</span>
            </button>

            {expandedTopics.has(topic.id) && (
              <div className="ml-4 border-l border-gray-700">
                {(sessions.get(topic.id) || []).map((session) => {
                  const sideChats = sessionSideChats.get(session.id) || [];
                  const sideChatCount = sideChats.length;

                  return (
                    <div key={session.id}>
                      <div className="group relative">
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-1 px-4 py-1.5">
                            <MessageSquare size={14} className="text-gray-500 flex-shrink-0" />
                            <input
                              type="text"
                              value={editingSessionName}
                              onChange={(e) => setEditingSessionName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSession(topic.id);
                                if (e.key === 'Escape') setEditingSessionId(null);
                              }}
                              onBlur={() => handleRenameSession(topic.id)}
                              className="flex-1 px-1 py-0.5 bg-gray-800 rounded text-sm text-white min-w-0"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => onSelectSession(topic.id, session.id)}
                            onDoubleClick={() => handleStartRename(session)}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800 ${
                              currentSessionId === session.id ? 'bg-gray-700' : ''
                            }`}
                          >
                            <MessageSquare size={14} className="text-gray-500 flex-shrink-0" />
                            <span className="truncate text-gray-300 flex-1 text-left">{session.name}</span>
                            {sideChatCount > 0 && (
                              <span className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full flex-shrink-0">
                                {sideChatCount}
                              </span>
                            )}
                            <Pencil
                              size={12}
                              className="text-gray-500 opacity-0 group-hover:opacity-100 hover:text-gray-300 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(session);
                              }}
                            />
                          </button>
                        )}
                      </div>

                      {/* Side Chat Threads - show directly under selected session */}
                      {currentSessionId === session.id && sideChatCount > 0 && (
                        <div className="ml-4 border-l border-gray-600">
                          {sideChats.map((thread, idx) => (
                            <button
                              key={`${thread.nodeId}-${thread.selectedText || 'general'}-${idx}`}
                              onClick={() => handleSideChatClick(thread.nodeId, thread.selectedText)}
                              className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                              title={thread.previewText}
                            >
                              <MessageSquarePlus size={12} className="flex-shrink-0" />
                              <span className="truncate flex-1 text-left">
                                {thread.selectedText
                                  ? `"${thread.selectedText.length > 20 ? thread.selectedText.slice(0, 20) + '...' : thread.selectedText}"`
                                  : '(general)'}
                              </span>
                              <span className="text-gray-500 flex-shrink-0">
                                {thread.messageCount}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => handleCreateSession(topic.id)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                >
                  <Plus size={14} />
                  New Session
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tree View Section */}
      {currentSessionId && treeNodes && treeNodes.length > 0 && onSelectTreeNode && (
        <div className="border-t border-gray-700">
          <div className="px-4 py-2 flex items-center gap-2 text-sm text-gray-400">
            <GitBranch size={14} />
            <span>Tree View</span>
          </div>
          <div className="px-2 pb-2 overflow-x-auto">
            <TreeView
              nodes={treeNodes}
              currentPath={currentPath || []}
              onSelectNode={onSelectTreeNode}
            />
          </div>
        </div>
      )}

      {/* User Menu */}
      <UserMenu />
    </div>
  );
}

function UserMenu() {
  const { user, clearAuth } = useAuthStore();
  const { setOpen: openSettings } = useSettingsStore();

  const handleLogout = () => {
    clearAuth();
    window.location.reload();
  };

  if (!user) return null;

  return (
    <div className="border-t border-gray-700 p-3">
      <div className="flex items-center gap-3">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name || 'User'}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <User size={16} className="text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user.name || 'User'}</p>
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
        </div>
        <button
          onClick={() => openSettings(true)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          title="Settings"
        >
          <Settings size={16} />
        </button>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
