import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Node } from '@/types/models';

interface SideChatPanelProps {
  parentNode: Node;
  selectedText?: string;
  messages: Node[];
  streamingContent: string;
  isStreaming: boolean;
  onSend: (content: string, includeMainContext: boolean) => void;
  onClose: () => void;
}

export function SideChatPanel({
  parentNode,
  selectedText,
  messages,
  streamingContent,
  isStreaming,
  onSend,
  onClose,
}: SideChatPanelProps) {
  const [input, setInput] = useState('');
  const [includeContext, setIncludeContext] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll to bottom when messages change or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSend = () => {
    if (input.trim() && !isStreaming) {
      onSend(input.trim(), includeContext);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Truncate parent message for preview
  const parentPreview = parentNode.content.length > 100
    ? parentNode.content.substring(0, 100) + '...'
    : parentNode.content;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-[28rem] bg-white shadow-xl z-50 flex flex-col animate-slide-in"
        style={{
          animation: 'slideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex-none px-4 py-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-blue-600" />
              <span className="font-medium text-blue-800">Side Chat</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
            >
              <X size={18} />
            </button>
          </div>
          {/* Selected text or parent message preview */}
          {selectedText ? (
            <div className="mt-2 p-2 bg-blue-100/50 rounded text-sm text-gray-700 border-l-4 border-blue-400">
              <span className="text-blue-600 text-xs font-medium">Selected text:</span>
              <p className="mt-0.5 italic line-clamp-3">"{selectedText}"</p>
            </div>
          ) : (
            <div className="mt-2 p-2 bg-white/70 rounded text-sm text-gray-600 border border-blue-100">
              <span className="text-gray-400 text-xs">Discussing:</span>
              <p className="mt-0.5 line-clamp-2">{parentPreview}</p>
            </div>
          )}
          {/* Option to include conversation context with selected text */}
          {selectedText && (
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Include conversation context
            </label>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center text-gray-400 text-sm py-8">
              {selectedText
                ? 'Ask a question about the selected text'
                : 'Ask a follow-up question about this message'}
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.nodeType === 'side_chat_user' ? 'justify-end' : ''
              }`}
            >
              {message.nodeType === 'side_chat_assistant' && (
                <div className="flex-none w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot size={14} className="text-blue-600" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.nodeType === 'side_chat_user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {message.nodeType === 'side_chat_user' ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-p:my-1 prose-headings:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match;
                          return !isInline ? (
                            <SyntaxHighlighter
                              style={oneDark as Record<string, React.CSSProperties>}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.75rem' }}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={`${className || ''} bg-gray-200 px-1 py-0.5 rounded text-xs`} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              {message.nodeType === 'side_chat_user' && (
                <div className="flex-none w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                  <User size={14} className="text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming response */}
          {streamingContent && (
            <div className="flex gap-3">
              <div className="flex-none w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot size={14} className="text-blue-600" />
              </div>
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-800">
                <div className="prose prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-p:my-1 prose-headings:my-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        return !isInline ? (
                          <SyntaxHighlighter
                            style={oneDark as Record<string, React.CSSProperties>}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.75rem' }}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={`${className || ''} bg-gray-200 px-1 py-0.5 rounded text-xs`} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {streamingContent}
                  </ReactMarkdown>
                </div>
                <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-none p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedText ? "Ask about this selection..." : "Ask a follow-up..."}
              rows={2}
              disabled={isStreaming}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="flex-none px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
