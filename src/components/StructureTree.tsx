import React, { useMemo, useState, useRef, useEffect } from 'react';
import { URDFRobot, URDFJoint } from 'urdf-loader';
import { Object3D } from 'three';

interface StructureTreeProps {
  robot: URDFRobot;
  onClose: () => void;
}

// --- Data Structures ---
interface TreeNodeData {
  id: string;
  name: string;
  type: 'link' | 'joint';
  children: TreeNodeData[];
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed?: boolean;
}

// --- Helper Functions ---
const isJoint = (obj: Object3D): obj is URDFJoint => (obj as any).isURDFJoint;
const isLink = (obj: Object3D): boolean => (obj as any).isURDFLink;

// Convert Three.js Object Graph to Tree Data
const buildTreeData = (object: Object3D): TreeNodeData | null => {
  // We only care about Links and Joints
  if (!isJoint(object) && !isLink(object) && object.children.length === 0) return null;

  // Filter relevant children
  const childNodes: TreeNodeData[] = [];
  object.children.forEach(child => {
    const node = buildTreeData(child);
    if (node) childNodes.push(node);
  });

  // If this object is not a link/joint itself (e.g. the root Group), 
  // but has children, we might want to return a virtual root or just return the first child if single.
  // URDFRobot usually extends Object3D and contains the root link(s).
  if (!isJoint(object) && !isLink(object)) {
      // If it's the root container, return a special root node or merge
      if (childNodes.length === 1) return childNodes[0]; // Skip wrapper
      if (childNodes.length > 1) {
          return {
              id: 'root',
              name: 'Robot Root',
              type: 'link', // Treat as abstract link
              children: childNodes,
              x: 0, y: 0, width: 0, height: 0
          };
      }
      return null;
  }

  return {
    id: object.uuid,
    name: object.name || (isJoint(object) ? "Unnamed Joint" : "Unnamed Link"),
    type: isJoint(object) ? 'joint' : 'link',
    children: childNodes,
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };
};

// --- Layout Configuration ---
const NODE_WIDTH = 140;
const NODE_HEIGHT = 40;
const GAP_X = 80;
const GAP_Y = 20;

// Simple Tree Layout Algorithm (Horizontal)
const calculateLayout = (node: TreeNodeData, depth: number, startY: number): number => {
  node.x = depth * (NODE_WIDTH + GAP_X) + 50; // Initial padding
  node.width = NODE_WIDTH;
  node.height = NODE_HEIGHT;

  if (node.children.length === 0) {
    node.y = startY;
    return startY + NODE_HEIGHT + GAP_Y;
  }

  let currentY = startY;
  node.children.forEach(child => {
    currentY = calculateLayout(child, depth + 1, currentY);
  });

  // Center parent relative to children
  const firstChild = node.children[0];
  const lastChild = node.children[node.children.length - 1];
  node.y = (firstChild.y + lastChild.y) / 2;

  return currentY;
};

// --- Components ---
const StructureTree: React.FC<StructureTreeProps> = ({ robot, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  const treeData = useMemo(() => {
    const root = buildTreeData(robot);
    if (root) calculateLayout(root, 0, 50);
    return root;
  }, [robot]);

  // Center tree on mount
  useEffect(() => {
    if (treeData && containerRef.current) {
        const height = calculateLayout(treeData, 0, 50); // Recalc to get total height
        const containerH = containerRef.current.clientHeight;
        const containerW = containerRef.current.clientWidth;
        
        setViewState({
            x: 50, // Initial left padding
            y: Math.max(0, (containerH / 2) - (treeData.y + NODE_HEIGHT/2)), // Center vertically
            scale: 1
        });
    }
  }, [treeData]);

  // Mouse Handlers for Pan/Zoom
  const handleWheel = (e: React.WheelEvent) => {
    // Zoom
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, viewState.scale * (1 + scaleAmount)), 3);
    setViewState(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
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

  // Recursive Render
  const renderLinks = (node: TreeNodeData) => {
    return (
      <React.Fragment key={`edges-${node.id}`}>
        {node.children.map(child => {
            // Bezier Curve
            const startX = node.x + NODE_WIDTH;
            const startY = node.y + NODE_HEIGHT / 2;
            const endX = child.x;
            const endY = child.y + NODE_HEIGHT / 2;
            const c1x = (startX + endX) / 2;
            const c1y = startY;
            const c2x = (startX + endX) / 2;
            const c2y = endY;
            const pathData = `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;

            return (
                <g key={child.id}>
                    <path d={pathData} stroke="#555" strokeWidth="2" fill="none" />
                    {renderLinks(child)}
                </g>
            );
        })}
      </React.Fragment>
    );
  };

  const renderNodes = (node: TreeNodeData) => {
    return (
      <React.Fragment key={`node-${node.id}`}>
        <g 
            transform={`translate(${node.x}, ${node.y})`} 
            className={`tree-node-visual ${node.type}`}
            // style={{ cursor: 'pointer' }}
        >
            <rect 
                width={NODE_WIDTH} 
                height={NODE_HEIGHT} 
                rx="6" 
                fill={node.type === 'joint' ? '#2e4c31' : '#1e3a5f'}
                stroke={node.type === 'joint' ? '#4caf50' : '#2196f3'}
                strokeWidth="1"
            />
            {/* Icon */}
            <text x="10" y="26" fontSize="16" fill="white">
                {node.type === 'joint' ? '🔗' : '📦'}
            </text>
            {/* Name */}
            <text 
                x="35" 
                y="25" 
                fill="#eee" 
                fontSize="12" 
                fontFamily="monospace"
                style={{ pointerEvents: 'none' }}
            >
                {node.name.length > 15 ? node.name.substring(0, 14) + '..' : node.name}
            </text>
            <title>{node.name}</title>
        </g>
        {node.children.map(child => renderNodes(child))}
      </React.Fragment>
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
    >
        <div className="structure-tree-controls">
            <h3>Kinematic Graph</h3>
            <p>Pan (Drag) / Zoom (Scroll)</p>
            <button onClick={onClose} className="close-btn-lg">Close Map</button>
        </div>
        
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