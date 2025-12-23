import React, { useMemo, useState, useRef, useEffect } from 'react';
import { URDFRobot, URDFJoint } from 'urdf-loader';
import { Object3D } from 'three';

interface StructureTreeProps {
  robot: URDFRobot;
  onClose: () => void;
  onSelect: (node: Object3D) => void;
}

// --- Data Structures ---
interface TreeNodeData {
  id: string;
  name: string;
  type: 'link' | 'joint';
  object: Object3D; 
  children: TreeNodeData[];
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  hasChildren: boolean;
}

// --- Helper Functions ---
const isJoint = (obj: Object3D): obj is URDFJoint => (obj as any).isURDFJoint;
const isLink = (obj: Object3D): boolean => (obj as any).isURDFLink;

const buildTreeData = (object: Object3D): TreeNodeData | null => {
  if (!isJoint(object) && !isLink(object) && object.children.length === 0) return null;

  const childNodes: TreeNodeData[] = [];
  object.children.forEach(child => {
    const node = buildTreeData(child);
    if (node) childNodes.push(node);
  });

  if (!isJoint(object) && !isLink(object)) {
      if (childNodes.length === 1) return childNodes[0];
      if (childNodes.length > 1) {
          return {
              id: 'root',
              name: 'Robot Root',
              type: 'link',
              object: object,
              children: childNodes,
              x: 0, y: 0, width: 0, height: 0,
              collapsed: false,
              hasChildren: true
          };
      }
      return null;
  }

  return {
    id: object.uuid,
    name: object.name || (isJoint(object) ? "Unnamed Joint" : "Unnamed Link"),
    type: isJoint(object) ? 'joint' : 'link',
    object: object,
    children: childNodes,
    x: 0, y: 0, width: 0, height: 0,
    collapsed: false,
    hasChildren: childNodes.length > 0
  };
};

const NODE_WIDTH = 160;
const NODE_HEIGHT = 45;
const GAP_X = 20; 
const GAP_Y = 60; 

const calculateLayout = (node: TreeNodeData, depth: number, startX: number, collapsedMap: Set<string>): number => {
  node.y = depth * (NODE_HEIGHT + GAP_Y) + 50;
  node.width = NODE_WIDTH;
  node.height = NODE_HEIGHT;
  node.collapsed = collapsedMap.has(node.id);

  if (node.children.length === 0 || node.collapsed) {
    node.x = startX;
    return startX + NODE_WIDTH + GAP_X;
  }

  let currentX = startX;
  node.children.forEach(child => {
    currentX = calculateLayout(child, depth + 1, currentX, collapsedMap);
  });

  const firstChild = node.children[0];
  const lastChild = node.children[node.children.length - 1];
  node.x = (firstChild.x + lastChild.x) / 2;

  return currentX;
};

// --- Custom Icons ---
const LinkIcon = ({ x, y }: { x: number, y: number }) => (
    <g transform={`translate(${x}, ${y})`}>
        <rect x="0" y="0" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2" />
        <line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" strokeWidth="2" />
    </g>
);

const JointIcon = ({ x, y }: { x: number, y: number }) => (
    <g transform={`translate(${x}, ${y})`}>
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="8" cy="8" r="3" fill="currentColor" />
    </g>
);

const StructureTree: React.FC<StructureTreeProps> = ({ robot, onClose, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<TreeNodeData | null>(null);

  const rawTreeData = useMemo(() => buildTreeData(robot), [robot]);
  const treeData = useMemo(() => {
      if (!rawTreeData) return null;
      calculateLayout(rawTreeData, 0, 50, collapsedIds);
      return rawTreeData;
  }, [rawTreeData, collapsedIds]);

  useEffect(() => {
    if (treeData && containerRef.current) {
        const totalWidth = calculateLayout(treeData, 0, 50, collapsedIds); 
        const containerW = containerRef.current.clientWidth;
        setViewState({
            x: (containerW / 2) - treeData.x - (NODE_WIDTH / 2), 
            y: 50,
            scale: 1
        });
    }
  }, []); 

  // --- Interaction Handlers ---
  const handleWheel = (e: React.WheelEvent) => {
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.15, viewState.scale * (1 + scaleAmount)), 3);
    setViewState(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.tree-node-visual')) return;
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const toggleCollapse = (node: TreeNodeData) => {
      if (!node.hasChildren) return;
      setCollapsedIds(prev => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          return next;
      });
  };

  const handleNodeClick = (e: React.MouseEvent, node: TreeNodeData) => {
      e.stopPropagation();
      // Left Click -> Select (Highlight in 3D)
      onSelect(node.object);
  };

  const handleNodeRightClick = (e: React.MouseEvent, node: TreeNodeData) => {
      e.preventDefault();
      e.stopPropagation();
      // Right Click -> Toggle Collapse
      toggleCollapse(node);
  };

  // --- Renderers ---
  const renderLinks = (node: TreeNodeData) => {
    if (node.collapsed || node.children.length === 0) return null;
    return (
      <React.Fragment key={`edges-${node.id}`}>
        {node.children.map(child => {
            const startX = node.x + NODE_WIDTH / 2;
            const startY = node.y + NODE_HEIGHT;
            const endX = child.x + NODE_WIDTH / 2;
            const endY = child.y;
            const c1y = (startY + endY) / 2;
            const pathData = `M ${startX} ${startY} C ${startX} ${c1y}, ${endX} ${c1y}, ${endX} ${endY}`;

            return (
                <g key={`edge-${node.id}-${child.id}`}>
                    <path d={pathData} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
                    {renderLinks(child)}
                </g>
            );
        })}
      </React.Fragment>
    );
  };

  const renderNodes = (node: TreeNodeData) => {
    const isJointNode = node.type === 'joint';
    const strokeColor = isJointNode ? '#66bb6a' : '#42a5f5';
    const fillColor = isJointNode ? 'rgba(27, 94, 32, 0.85)' : 'rgba(13, 71, 161, 0.85)';
    const iconColor = isJointNode ? '#66bb6a' : '#42a5f5';

    return (
      <React.Fragment key={`node-${node.id}`}>
        <g 
            transform={`translate(${node.x}, ${node.y})`} 
            className="tree-node-visual"
            onClick={(e) => handleNodeClick(e, node)}
            onContextMenu={(e) => handleNodeRightClick(e, node)}
            onMouseEnter={() => setHoveredNode(node)}
            onMouseLeave={() => setHoveredNode(null)}
            style={{ cursor: 'pointer' }}
        >
            <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="6" fill={fillColor} stroke={strokeColor} strokeWidth={1} />
            <g transform="translate(12, 14)" style={{ color: iconColor }}>
                {isJointNode ? <JointIcon x={0} y={0} /> : <LinkIcon x={0} y={0} />}
            </g>
            <text x="40" y="28" fill="#eee" fontSize="12" fontFamily="Inter, sans-serif" style={{ pointerEvents: 'none' }}>
                {node.name.length > 15 ? node.name.substring(0, 14) + '..' : node.name}
            </text>
            {node.hasChildren && (
                <>
                    <circle cx={NODE_WIDTH - 15} cy={NODE_HEIGHT / 2} r="7" fill="rgba(0,0,0,0.4)" />
                    <text x={NODE_WIDTH - 15} y={NODE_HEIGHT / 2 + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                        {node.collapsed ? '+' : '-'}
                    </text>
                </>
            )}
        </g>
        {!node.collapsed && node.children.map(child => renderNodes(child))}
      </React.Fragment>
    );
  };

  const renderDetails = () => {
      if (!hoveredNode || hoveredNode.type !== 'joint') return null;
      const joint = hoveredNode.object as URDFJoint;
      return (
          <div className="node-details-side-panel">
              <h4>{joint.name}</h4>
              <div className="detail-row"><label>Type:</label> <span className="tag">{joint.jointType}</span></div>
              {joint.limit && (
                  <div className="limit-box">
                      <div className="limit-row"><span>Lower:</span> <span>{Number(joint.limit.lower).toFixed(3)}</span></div>
                      <div className="limit-row"><span>Upper:</span> <span>{Number(joint.limit.upper).toFixed(3)}</span></div>
                  </div>
              )}
          </div>
      );
  };

  if (!treeData) return null;

  return (
    <div 
        className="structure-tree-fullscreen"
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()} // Prevent global context menu in this view
    >
        <div className="structure-tree-ui-layer">
            <div className="structure-tree-vertical-header">
                <h3>Tree Graph</h3>
                <div className="v-legend">
                    <div className="v-legend-item"><span className="v-dot joint"></span> Joint</div>
                    <div className="v-legend-item"><span className="v-dot link"></span> Link</div>
                </div>
                <div className="v-hint">L-Click: Select<br/>R-Click: Fold<br/>T: Toggle</div>
            </div>
        </div>
        
        {renderDetails()}
        
        <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
            <g transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.scale})`}>
                {renderLinks(treeData)}
                {renderNodes(treeData)}
            </g>
        </svg>
    </div>
  );
};

export default StructureTree;
