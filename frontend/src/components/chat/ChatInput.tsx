import { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import type { Node } from '@/types/models';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  replyToNode?: Node | null;
  onClearReply?: () => void;
}

export function ChatInput({ onSend, disabled, placeholder, replyToNode, onClearReply }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Truncate content for reply preview
  const truncateContent = (content: string, maxLength = 60) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div className="border-t bg-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Reply context banner */}
        {replyToNode && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <span className="text-blue-600 font-medium">Forking from:</span>
            <span className="flex-1 text-gray-600 truncate">
              {truncateContent(replyToNode.content)}
            </span>
            {onClearReply && (
              <button
                onClick={onClearReply}
                className="p-1 rounded hover:bg-blue-100 text-blue-600"
                title="Cancel fork"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyToNode ? 'Type your message to create a new branch...' : (placeholder || 'Type a message...')}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || !message.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
