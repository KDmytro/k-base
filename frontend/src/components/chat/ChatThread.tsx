import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { Node } from '@/types/models';

interface ChatThreadProps {
  nodes: Node[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  sessionName?: string;
}

export function ChatThread({ nodes, isLoading, onSendMessage, sessionName }: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [nodes]);

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
            {nodes.map((node) => (
              <ChatMessage key={node.id} node={node} />
            ))}
            {isLoading && (
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
        disabled={isLoading}
        placeholder={nodes.length === 0 ? 'Start a conversation...' : 'Continue the conversation...'}
      />
    </div>
  );
}
