import { useState, useRef, useEffect } from 'react';
import { Send, X, ChevronDown } from 'lucide-react';
import type { Node as MessageNode, ModelInfo } from '@/types/models';
import apiClient from '@/api/client';

interface ChatInputProps {
  onSend: (message: string, model?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  replyToNode?: MessageNode | null;
  onClearReply?: () => void;
}

export function ChatInput({ onSend, disabled, placeholder, replyToNode, onClearReply }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [models, setModels] = useState<Record<string, ModelInfo>>({});
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available models on mount
  useEffect(() => {
    apiClient.getModels().then(response => {
      setModels(response.models);
    }).catch(err => {
      console.error('Failed to fetch models:', err);
    });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim(), selectedModel || undefined);
      setMessage('');
    }
  };

  const getModelDisplayName = (modelId: string) => {
    return models[modelId]?.display || modelId;
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

          {/* Model Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="h-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-gray-700 text-sm flex items-center gap-1 min-w-[120px] justify-between"
              title="Select model"
            >
              <span className="truncate">
                {selectedModel ? getModelDisplayName(selectedModel) : 'Default'}
              </span>
              <ChevronDown size={16} />
            </button>

            {showModelDropdown && (
              <div className="absolute bottom-full mb-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedModel('');
                    setShowModelDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                    !selectedModel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  Default (auto)
                </button>
                {Object.entries(models).map(([modelId, info]) => (
                  <button
                    key={modelId}
                    onClick={() => {
                      setSelectedModel(modelId);
                      setShowModelDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                      selectedModel === modelId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{info.display}</div>
                    <div className="text-xs text-gray-500">{info.provider}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

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
