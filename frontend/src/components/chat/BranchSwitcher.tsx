import { useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import type { Node } from '@/types/models';

interface BranchSwitcherProps {
  siblings: Node[];
  currentNodeId: string;
  onSelect: (nodeId: string) => void;
  onClose: () => void;
}

export function BranchSwitcher({ siblings, currentNodeId, onSelect, onClose }: BranchSwitcherProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as HTMLElement)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

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

  const truncateContent = (content: string, maxLength = 80) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div
      ref={ref}
      className="absolute top-10 right-2 z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">
          Switch Branch ({siblings.length} available)
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 text-gray-500"
        >
          <X size={14} />
        </button>
      </div>

      {/* Branch list */}
      <div className="max-h-64 overflow-y-auto">
        {siblings.map((sibling, index) => {
          const isCurrent = sibling.id === currentNodeId;
          return (
            <button
              key={sibling.id}
              onClick={() => {
                if (!isCurrent) {
                  onSelect(sibling.id);
                }
              }}
              disabled={isCurrent}
              className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 transition-colors ${
                isCurrent
                  ? 'bg-purple-50 cursor-default'
                  : 'hover:bg-gray-50 cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  {isCurrent ? (
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-medium">
                      {index + 1}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${isCurrent ? 'text-purple-600' : 'text-gray-500'}`}>
                      {sibling.nodeType === 'user_message' ? 'You' : 'Assistant'}
                    </span>
                    {isCurrent && (
                      <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">
                    {truncateContent(sibling.content)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
