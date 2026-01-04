import { useMemo, useState } from 'react';
import type { Node } from '@/types/models';

interface TreeViewProps {
  nodes: Node[];
  currentPath: string[]; // IDs of nodes in the current selected path
  onSelectNode: (nodeId: string) => void;
}

interface TreeNode {
  id: string;
  node: Node;
  children: TreeNode[];
  depth: number;
  index: number; // Position among siblings
}

interface PositionedNode {
  id: string;
  node: Node;
  x: number;
  y: number;
  parentId: string | null;
}

const NODE_RADIUS = 6;
const HORIZONTAL_SPACING = 24;
const VERTICAL_SPACING = 20;
const PADDING = 16;

export function TreeView({ nodes, currentPath, onSelectNode }: TreeViewProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Build tree structure from flat node list
  const { positionedNodes, width, height } = useMemo(() => {
    if (nodes.length === 0) {
      return { positionedNodes: [], width: 0, height: 0 };
    }

    // Create a map for quick lookup
    const nodeMap = new Map<string, Node>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    // Find root nodes (no parent or parent not in this session)
    const rootNodes = nodes.filter(n => !n.parentId || !nodeMap.has(n.parentId));

    // Build tree recursively
    const buildTree = (node: Node, depth: number): TreeNode => {
      const children = nodes
        .filter(n => n.parentId === node.id)
        .sort((a, b) => a.siblingIndex - b.siblingIndex)
        .map((child) => buildTree(child, depth + 1));

      return {
        id: node.id,
        node,
        children,
        depth,
        index: 0,
      };
    };

    const trees = rootNodes.map(n => buildTree(n, 0));

    // Calculate positions using a simple layout algorithm
    const positioned: PositionedNode[] = [];
    let maxDepth = 0;
    let maxIndex = 0;

    const calculatePositions = (treeNode: TreeNode, yOffset: number): number => {
      const x = PADDING + treeNode.depth * HORIZONTAL_SPACING;

      if (treeNode.children.length === 0) {
        // Leaf node
        positioned.push({
          id: treeNode.id,
          node: treeNode.node,
          x,
          y: PADDING + yOffset * VERTICAL_SPACING,
          parentId: treeNode.node.parentId || null,
        });
        maxDepth = Math.max(maxDepth, treeNode.depth);
        maxIndex = Math.max(maxIndex, yOffset);
        return yOffset + 1;
      }

      // Calculate children positions first
      let currentOffset = yOffset;
      const childYPositions: number[] = [];

      for (const child of treeNode.children) {
        const startY = currentOffset;
        currentOffset = calculatePositions(child, currentOffset);
        childYPositions.push((startY + currentOffset - 1) / 2);
      }

      // Position this node at the center of its children
      const avgChildY = childYPositions.reduce((a, b) => a + b, 0) / childYPositions.length;

      positioned.push({
        id: treeNode.id,
        node: treeNode.node,
        x,
        y: PADDING + avgChildY * VERTICAL_SPACING,
        parentId: treeNode.node.parentId || null,
      });

      maxDepth = Math.max(maxDepth, treeNode.depth);
      return currentOffset;
    };

    let offset = 0;
    for (const tree of trees) {
      offset = calculatePositions(tree, offset);
    }

    const width = PADDING * 2 + maxDepth * HORIZONTAL_SPACING + NODE_RADIUS * 2;
    const height = PADDING * 2 + maxIndex * VERTICAL_SPACING + NODE_RADIUS * 2;

    return { positionedNodes: positioned, width: Math.max(width, 100), height: Math.max(height, 50) };
  }, [nodes]);

  // Create a map for positioned nodes
  const positionMap = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    positionedNodes.forEach(pn => map.set(pn.id, pn));
    return map;
  }, [positionedNodes]);

  const currentPathSet = useMemo(() => new Set(currentPath), [currentPath]);

  if (nodes.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-4">
        No messages yet
      </div>
    );
  }

  const truncateContent = (content: string, maxLength = 50) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div className="relative">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Draw connections */}
        {positionedNodes.map(pn => {
          if (!pn.parentId) return null;
          const parent = positionMap.get(pn.parentId);
          if (!parent) return null;

          const isOnPath = currentPathSet.has(pn.id) && currentPathSet.has(pn.parentId);

          return (
            <line
              key={`line-${pn.id}`}
              x1={parent.x}
              y1={parent.y}
              x2={pn.x}
              y2={pn.y}
              stroke={isOnPath ? '#9333ea' : '#d1d5db'}
              strokeWidth={isOnPath ? 2 : 1}
            />
          );
        })}

        {/* Draw nodes */}
        {positionedNodes.map(pn => {
          const isOnPath = currentPathSet.has(pn.id);
          const isHovered = hoveredNode === pn.id;
          const isUser = pn.node.nodeType === 'user_message';

          return (
            <g key={pn.id}>
              <circle
                cx={pn.x}
                cy={pn.y}
                r={isHovered ? NODE_RADIUS + 2 : NODE_RADIUS}
                fill={isOnPath ? '#9333ea' : isUser ? '#3b82f6' : '#22c55e'}
                stroke={isHovered ? '#1f2937' : 'none'}
                strokeWidth={2}
                className="cursor-pointer transition-all"
                onClick={() => onSelectNode(pn.id)}
                onMouseEnter={() => setHoveredNode(pn.id)}
                onMouseLeave={() => setHoveredNode(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredNode && (
        <div className="absolute z-50 left-full ml-2 top-0 w-48 bg-gray-900 text-white text-xs rounded-md p-2 shadow-lg pointer-events-none">
          {(() => {
            const pn = positionMap.get(hoveredNode);
            if (!pn) return null;
            return (
              <>
                <div className="font-medium mb-1">
                  {pn.node.nodeType === 'user_message' ? 'You' : 'Assistant'}
                </div>
                <div className="text-gray-300">
                  {truncateContent(pn.node.content)}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
