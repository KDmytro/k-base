import { User, Bot, GitBranch } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Node } from '@/types/models';

interface ChatMessageProps {
  node: Node;
  siblingCount?: number;
  onFork?: (nodeId: string) => void;
  onShowBranches?: (nodeId: string) => void;
}

export function ChatMessage({ node, siblingCount = 1, onFork, onShowBranches }: ChatMessageProps) {
  const isUser = node.nodeType === 'user_message';
  const isNote = node.nodeType === 'user_note';
  const hasBranches = siblingCount > 1;

  return (
    <div
      className={`group relative flex gap-3 p-4 ${
        isUser ? 'bg-white' : 'bg-gray-50'
      } ${isNote ? 'border-l-4 border-yellow-400 bg-yellow-50' : ''}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
        }`}
      >
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-500 mb-1">
          {isUser ? 'You' : 'Assistant'}
          {isNote && <span className="ml-2 text-yellow-600">(Note)</span>}
        </div>
        <div className="text-gray-900 prose prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent">
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
                    customStyle={{ margin: 0, borderRadius: '0.375rem' }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={`${className || ''} bg-gray-100 px-1 py-0.5 rounded text-sm`} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {node.content}
          </ReactMarkdown>
        </div>
      </div>

      {/* Action buttons container - top right */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {/* Branch indicator - always visible when has branches */}
        {hasBranches && onShowBranches && (
          <button
            onClick={() => onShowBranches(node.id)}
            className="relative p-1.5 rounded-md bg-purple-100 text-purple-600 hover:bg-purple-200 hover:text-purple-700 transition-colors"
            title={`${siblingCount} branches - click to switch`}
          >
            <GitBranch size={16} />
            <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
              {siblingCount}
            </span>
          </button>
        )}

        {/* Fork button - appears on hover */}
        {onFork && (
          <button
            onClick={() => onFork(node.id)}
            className="p-1.5 rounded-md bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-700 transition-opacity"
            title="Fork conversation from here"
          >
            <GitBranch size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
