import { FolderClosed, User, Bot } from 'lucide-react';
import type { Node } from '@/types/models';

interface CollapsedBranchProps {
  node: Node;
  onClick: () => void;
}

export function CollapsedBranch({ node, onClick }: CollapsedBranchProps) {
  const isUser = node.nodeType === 'user_message';
  const preview = node.content.slice(0, 60) + (node.content.length > 60 ? '...' : '');

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2 my-1 rounded-lg border border-gray-200
                 bg-gray-50 hover:bg-gray-100 hover:border-purple-300
                 transition-colors flex items-center gap-2 group"
    >
      <FolderClosed size={16} className="text-gray-400 group-hover:text-purple-500 flex-shrink-0 transition-colors" />
      {isUser ? (
        <User size={14} className="text-blue-500 flex-shrink-0" />
      ) : (
        <Bot size={14} className="text-green-500 flex-shrink-0" />
      )}
      <span className="text-sm text-gray-600 truncate">{preview}</span>
    </button>
  );
}
