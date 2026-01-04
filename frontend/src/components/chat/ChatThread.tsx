import { useEffect, useRef } from 'react';
import { StickyNote } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { CollapsedBranch } from './CollapsedBranch';
import { NotePanel } from './NotePanel';
import { SideChatPanel } from './SideChatPanel';
import type { Node } from '@/types/models';

interface ChatThreadProps {
  nodes: Node[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onForkNode?: (nodeId: string) => void;
  replyToNode?: Node | null;
  onClearReply?: () => void;
  sessionName?: string;
  // Branch switching props
  forkPointBranches?: Map<string, Node[]>;  // parentId -> child branches
  onSelectBranch?: (nodeId: string) => void;
  // Streaming props
  streamingContent?: string;
  isStreaming?: boolean;
  // Note props
  nodeNotes?: Map<string, Node>;
  notePanelNodeId?: string | null;
  onOpenNotePanel?: (nodeId: string) => void;
  onCloseNotePanel?: () => void;
  onSaveNote?: (nodeId: string, content: string) => void;
  onDeleteNote?: (nodeId: string) => void;
  // Side chat props
  sideChatCounts?: Map<string, number>;
  sideChatThreads?: Map<string, string[]>;  // nodeId -> array of selected texts for highlighting
  sideChatPanelNodeId?: string | null;
  sideChatPanelNode?: Node | null;
  sideChatSelectedText?: string | null;
  sideChatMessages?: Node[];
  sideChatStreamingContent?: string;
  isSideChatStreaming?: boolean;
  onOpenSideChat?: (nodeId: string, selectedText?: string) => void;
  onCloseSideChat?: () => void;
  onSendSideChat?: (content: string, includeMainContext: boolean) => void;
}

export function ChatThread({
  nodes,
  isLoading,
  onSendMessage,
  onForkNode,
  replyToNode,
  onClearReply,
  sessionName,
  forkPointBranches,
  onSelectBranch,
  streamingContent,
  isStreaming,
  nodeNotes,
  notePanelNodeId,
  onOpenNotePanel,
  onCloseNotePanel,
  onSaveNote,
  onDeleteNote,
  sideChatCounts,
  sideChatThreads,
  sideChatPanelNodeId,
  sideChatPanelNode,
  sideChatSelectedText,
  sideChatMessages,
  sideChatStreamingContent,
  isSideChatStreaming,
  onOpenSideChat,
  onCloseSideChat,
  onSendSideChat,
}: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [nodes, streamingContent]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {sessionName || 'Chat'}
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">Start a conversation</p>
              <p className="text-sm">Type a message below to begin</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {nodes.map((node, index) => {
              const note = nodeNotes?.get(node.id);
              const forkBranches = forkPointBranches?.get(node.id);
              const nextNode = nodes[index + 1];
              const isForkPoint = forkBranches && forkBranches.length > 1;

              return (
                <div key={node.id} className="relative">
                  <ChatMessage
                    node={node}
                    isForkPoint={isForkPoint}
                    forkBranchCount={forkBranches?.length ?? 0}
                    onFork={onForkNode}
                    note={note}
                    onNote={onOpenNotePanel}
                    sideChatCount={sideChatCounts?.get(node.id) ?? 0}
                    highlightedTexts={sideChatThreads?.get(node.id)}
                    onSideChat={onOpenSideChat}
                  />

                  {/* Collapsed branches - show non-active siblings at fork point */}
                  {isForkPoint && onSelectBranch && (
                    <div className="mx-4 my-2">
                      {forkBranches
                        .filter(branch => branch.id !== nextNode?.id)
                        .map(branch => (
                          <CollapsedBranch
                            key={branch.id}
                            node={branch}
                            onClick={() => onSelectBranch(branch.id)}
                          />
                        ))}
                    </div>
                  )}

                  {/* Inline note display */}
                  {note && (
                    <div
                      className="mx-4 mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md cursor-pointer hover:bg-yellow-100 transition-colors"
                      onClick={() => onOpenNotePanel?.(node.id)}
                    >
                      <div className="flex items-start gap-2">
                        <StickyNote size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-yellow-800">{note.content}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Streaming response */}
            {isStreaming && streamingContent && (
              <div className="flex gap-3 p-4 bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-500 mb-1">Assistant</div>
                  <div className="text-gray-900 whitespace-pre-wrap break-words">
                    {streamingContent}
                    <span className="inline-block w-2 h-4 ml-0.5 bg-gray-400 animate-pulse" />
                  </div>
                </div>
              </div>
            )}
            {/* Loading indicator (before streaming starts) */}
            {isLoading && !isStreaming && (
              <div className="flex gap-3 p-4 bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <div className="animate-pulse">...</div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-500 mb-1">Assistant</div>
                  <div className="text-gray-400">Thinking...</div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isLoading || isStreaming}
        placeholder={nodes.length === 0 ? 'Start a conversation...' : 'Continue the conversation...'}
        replyToNode={replyToNode}
        onClearReply={onClearReply}
      />

      {/* Note slide-out panel */}
      {notePanelNodeId && onCloseNotePanel && onSaveNote && (
        <NotePanel
          existingContent={nodeNotes?.get(notePanelNodeId)?.content}
          onSave={(content) => onSaveNote(notePanelNodeId, content)}
          onDelete={nodeNotes?.get(notePanelNodeId) && onDeleteNote ? () => onDeleteNote(notePanelNodeId) : undefined}
          onClose={onCloseNotePanel}
        />
      )}

      {/* Side chat slide-out panel */}
      {sideChatPanelNodeId && sideChatPanelNode && onCloseSideChat && onSendSideChat && (
        <SideChatPanel
          parentNode={sideChatPanelNode}
          selectedText={sideChatSelectedText || undefined}
          messages={sideChatMessages || []}
          streamingContent={sideChatStreamingContent || ''}
          isStreaming={isSideChatStreaming || false}
          onSend={onSendSideChat}
          onClose={onCloseSideChat}
        />
      )}
    </div>
  );
}
