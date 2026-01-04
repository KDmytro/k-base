import React, { useState, useRef, useEffect } from 'react';
import { User, Bot, GitBranch, StickyNote, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Node } from '@/types/models';

interface ChatMessageProps {
  node: Node;
  isForkPoint?: boolean;         // This node has multiple children (branches)
  forkBranchCount?: number;      // Number of child branches
  onFork?: (nodeId: string) => void;
  note?: Node | null;
  onNote?: (nodeId: string) => void;
  sideChatCount?: number;
  highlightedTexts?: string[];  // Texts that have side chat threads
  onSideChat?: (nodeId: string, selectedText?: string) => void;
}

export function ChatMessage({ node, isForkPoint = false, forkBranchCount = 0, onFork, note, onNote, sideChatCount = 0, highlightedTexts, onSideChat }: ChatMessageProps) {
  const isUser = node.nodeType === 'user_message';
  const isNote = node.nodeType === 'user_note';
  const hasNote = !!note;
  const hasSideChats = sideChatCount > 0;

  // Text selection state
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle text selection within the message content
  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0 && contentRef.current) {
      // Check if selection is within this message's content
      const range = selection?.getRangeAt(0);
      if (range && contentRef.current.contains(range.commonAncestorContainer)) {
        setSelectedText(text);
        const rect = range.getBoundingClientRect();
        setSelectionPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
    }
  };

  // Clear selection when clicking outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't clear if clicking the floating button
      if (!target.closest('.selection-chat-button')) {
        setSelectedText('');
        setSelectionPosition(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const handleFloatingButtonClick = () => {
    onSideChat?.(node.id, selectedText);
    setSelectedText('');
    setSelectionPosition(null);
  };

  // Handle clicking on highlighted text to open that thread
  const handleHighlightClick = (text: string) => {
    onSideChat?.(node.id, text);
  };

  // Helper to extract text content from React nodes
  const extractText = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (!node) return '';
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (React.isValidElement(node)) {
      const element = node as React.ReactElement<{ children?: React.ReactNode }>;
      return extractText(element.props.children);
    }
    return '';
  };

  // Render text with highlights for existing side chat threads (single text node)
  const renderTextWithHighlights = (text: string): React.ReactNode => {
    if (!highlightedTexts || highlightedTexts.length === 0) {
      return text;
    }

    // Find all matches and their positions
    const matches: { start: number; end: number; text: string }[] = [];
    for (const highlight of highlightedTexts) {
      let searchIndex = 0;
      while (searchIndex < text.length) {
        const index = text.indexOf(highlight, searchIndex);
        if (index === -1) break;
        matches.push({ start: index, end: index + highlight.length, text: highlight });
        searchIndex = index + highlight.length;
      }
    }

    if (matches.length === 0) {
      return text;
    }

    // Sort by start position and remove overlaps (keep earlier/longer)
    matches.sort((a, b) => a.start - b.start || b.end - a.end);
    const nonOverlapping = matches.filter((match, i) => {
      if (i === 0) return true;
      return match.start >= matches[i - 1].end;
    });

    // Build result
    const result: React.ReactNode[] = [];
    let lastEnd = 0;
    nonOverlapping.forEach((match, i) => {
      // Add text before this match
      if (match.start > lastEnd) {
        result.push(text.slice(lastEnd, match.start));
      }
      // Add highlighted text
      result.push(
        <span
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            handleHighlightClick(match.text);
          }}
          className="side-chat-highlight bg-blue-100/60 border-b-2 border-blue-400 cursor-pointer hover:bg-blue-200/80 transition-colors"
          title="Click to open side chat thread"
        >
          {match.text}
          <MessageCircle size={12} className="inline-block ml-0.5 mb-1 text-blue-500" />
        </span>
      );
      lastEnd = match.end;
    });
    // Add remaining text
    if (lastEnd < text.length) {
      result.push(text.slice(lastEnd));
    }
    return result;
  };

  // Process children with cross-element highlight support
  const processChildrenWithHighlights = (children: React.ReactNode): React.ReactNode => {
    if (!highlightedTexts || highlightedTexts.length === 0) {
      return children;
    }

    // First, extract full text to check for matches
    const fullText = extractText(children);

    // Find matches in the full text
    const matches: { start: number; end: number; text: string }[] = [];
    for (const highlight of highlightedTexts) {
      let searchIndex = 0;
      while (searchIndex < fullText.length) {
        const index = fullText.indexOf(highlight, searchIndex);
        if (index === -1) break;
        matches.push({ start: index, end: index + highlight.length, text: highlight });
        searchIndex = index + highlight.length;
      }
    }

    if (matches.length === 0) {
      return children;
    }

    // Sort and remove overlaps
    matches.sort((a, b) => a.start - b.start || b.end - a.end);
    const nonOverlapping = matches.filter((match, i) => {
      if (i === 0) return true;
      return match.start >= matches[i - 1].end;
    });

    // Track character positions to know which children are within highlight ranges
    let charPos = 0;
    const childPositions: { start: number; end: number }[] = [];
    const childArray = Array.isArray(children) ? children : [children];

    childArray.forEach((child) => {
      const text = extractText(child);
      childPositions.push({ start: charPos, end: charPos + text.length });
      charPos += text.length;
    });

    // Process children and apply highlights
    return childArray.map((child, idx) => {
      const pos = childPositions[idx];

      // Check if this child overlaps with any highlight
      let overlappingMatch: { start: number; end: number; text: string } | null = null;
      for (const match of nonOverlapping) {
        // Check for overlap
        if (pos.start < match.end && pos.end > match.start) {
          overlappingMatch = match;
          break;
        }
      }

      if (typeof child === 'string') {
        // If string overlaps with highlight, wrap it
        if (overlappingMatch) {
          return (
            <span
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                handleHighlightClick(overlappingMatch!.text);
              }}
              className="side-chat-highlight bg-blue-100/60 border-b-2 border-blue-400 cursor-pointer hover:bg-blue-200/80 transition-colors"
              title="Click to open side chat thread"
            >
              {child}
            </span>
          );
        }
        return <React.Fragment key={idx}>{renderTextWithHighlights(child)}</React.Fragment>;
      }

      if (React.isValidElement(child)) {
        const element = child as React.ReactElement<{ children?: React.ReactNode }>;

        // If element overlaps with highlight, wrap it
        if (overlappingMatch) {
          return (
            <span
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                handleHighlightClick(overlappingMatch!.text);
              }}
              className="side-chat-highlight bg-blue-100/60 border-b-2 border-blue-400 cursor-pointer hover:bg-blue-200/80 transition-colors"
              title="Click to open side chat thread"
            >
              {element}
            </span>
          );
        }

        // Process children recursively
        if (element.props.children) {
          const processedChildren = processChildrenWithHighlights(element.props.children);
          return React.cloneElement(element, { key: idx }, processedChildren);
        }
        return React.cloneElement(element, { key: idx });
      }
      return child;
    });
  };

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
        <div
          ref={contentRef}
          onMouseUp={handleMouseUp}
          className="text-gray-900 prose prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom text renderer to highlight side chat selections
              // Uses processChildrenWithHighlights for cross-element support
              p({ children, ...props }) {
                return <p {...props}>{processChildrenWithHighlights(children)}</p>;
              },
              li({ children, ...props }) {
                return <li {...props}>{processChildrenWithHighlights(children)}</li>;
              },
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
        {/* Fork point indicator - shows when this node has multiple child branches */}
        {isForkPoint && forkBranchCount > 1 && (
          <div
            className="relative p-1.5 rounded-md bg-purple-100 text-purple-600"
            title={`${forkBranchCount} branches from this point`}
          >
            <GitBranch size={16} />
            <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
              {forkBranchCount}
            </span>
          </div>
        )}

        {/* Note button - appears on hover or when note exists */}
        {onNote && !isNote && (
          <button
            onClick={() => onNote(node.id)}
            className={`p-1.5 rounded-md transition-opacity ${
              hasNote
                ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                : 'bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-700'
            }`}
            title={hasNote ? 'Edit note' : 'Add note'}
          >
            <StickyNote size={16} />
          </button>
        )}

        {/* Side chat button - appears on hover or when side chats exist */}
        {onSideChat && !isNote && (
          <button
            onClick={() => {
              // If user has selected text, use that
              if (selectedText) {
                onSideChat(node.id, selectedText);
              }
              // If there are existing highlighted threads, use the first one
              else if (highlightedTexts && highlightedTexts.length > 0) {
                onSideChat(node.id, highlightedTexts[0]);
              }
              // Otherwise, start a general side chat (no selected text)
              else {
                onSideChat(node.id, undefined);
              }
            }}
            className={`relative p-1.5 rounded-md transition-opacity ${
              hasSideChats
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-700'
            }`}
            title={hasSideChats ? `${sideChatCount} side chat messages` : selectedText ? 'Chat about selection' : 'Start side chat'}
          >
            <MessageCircle size={16} />
            {hasSideChats && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                {sideChatCount}
              </span>
            )}
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

      {/* Floating chat button - appears near text selection */}
      {selectedText && selectionPosition && onSideChat && (
        <button
          onClick={handleFloatingButtonClick}
          className="selection-chat-button fixed z-50 flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg hover:bg-blue-600 transition-colors"
          style={{
            top: selectionPosition.top,
            left: selectionPosition.left,
          }}
        >
          <MessageCircle size={14} />
          Chat
        </button>
      )}
    </div>
  );
}
