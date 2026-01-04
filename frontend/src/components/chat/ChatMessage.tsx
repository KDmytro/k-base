import { User, Bot } from 'lucide-react';
import type { Node } from '@/types/models';

interface ChatMessageProps {
  node: Node;
}

export function ChatMessage({ node }: ChatMessageProps) {
  const isUser = node.nodeType === 'user_message';
  const isNote = node.nodeType === 'user_note';

  return (
    <div
      className={`flex gap-3 p-4 ${
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
        <div className="text-gray-900 whitespace-pre-wrap break-words">
          {node.content}
        </div>
      </div>
    </div>
  );
}
