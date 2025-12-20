import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { URDFJoint } from 'urdf-loader';

interface InfoPopupProps {
  name: string | null;
  matrix: THREE.Matrix4 | null;
  parentMatrix?: THREE.Matrix4 | null; // New prop
  joint?: URDFJoint | null;
  value?: number;
  onJointChange?: (value: number) => void;
  top: number;
  left: number;
  onClose: () => void;
  onPositionChange: (x: number, y: number) => void;
}

const InfoPopup: React.FC<InfoPopupProps> = ({ name, matrix, parentMatrix, joint, value, onJointChange, top, left, onClose, onPositionChange }) => {
  if (!name || (!matrix && !joint)) {
    return null;
  }

  // ... (keep existing state and effect hooks for position dragging) ...
  const [currentPos, setCurrentPos] = useState({ x: left, y: top });
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { setCurrentPos({ x: left, y: top }); }, [top, left]);
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (onJointChange) onJointChange(val);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!popupRef.current || !popupRef.current.parentElement) return;
    setIsDragging(true);
    const rect = popupRef.current.getBoundingClientRect();
    const parentRect = popupRef.current.parentElement.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      parentX: parentRect.left,
      parentY: parentRect.top
    } as any;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const offset = offsetRef.current as any;
      const newX = (e.clientX - offset.parentX) - offset.x;
      const newY = (e.clientY - offset.parentY) - offset.y;
      setCurrentPos({ x: newX, y: newY });
    };
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        onPositionChange(currentPos.x, currentPos.y);
      }
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, currentPos, onPositionChange]);

  const handleStopPropagation = (e: React.MouseEvent) => { e.stopPropagation(); };

  // --- Logic for Matrices ---

  // 1. Global (Natively Z-up now)
  const displayMatrix = React.useMemo(() => {
      if (!matrix) return null;
      return matrix.clone(); 
  }, [matrix]);

  // 2. Local (Relative to Parent)
  const localMatrix = React.useMemo(() => {
      if (!matrix || !parentMatrix) return null;
      const invParent = parentMatrix.clone().invert();
      return invParent.multiply(matrix.clone());
  }, [matrix, parentMatrix]);

  const renderMatrixInfo = (m: THREE.Matrix4, title: string) => {
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const euler = new THREE.Euler();
      m.decompose(position, quaternion, scale);
      
      // 'ZYX' order is standard for RPY (Roll=X, Pitch=Y, Yaw=Z) in many robotics applications
      // because it represents intrinsic rotations applied in that order.
      euler.setFromQuaternion(quaternion, 'ZYX');
      const toDegrees = (rad: number) => (rad * 180 / Math.PI).toFixed(3);

      const labelStyle: React.CSSProperties = { color: '#888', width: '35px', display: 'inline-block', fontSize: '0.85rem' };
      const valStyle: React.CSSProperties = { 
          fontFamily: 'Consolas, monospace', 
          display: 'inline-block', 
          width: '85px', 
          textAlign: 'right',
          color: '#eee',
          fontSize: '0.9rem'
      };
      const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', marginBottom: '2px' };
      const sectionHeaderStyle: React.CSSProperties = {
          margin: '8px 0 4px 0', 
          fontSize: '0.7rem', 
          color: '#aaa', 
          textTransform: 'uppercase',
          borderBottom: '1px solid #444',
          paddingBottom: '2px'
      };

      return (
        <div className="matrix-section" style={{ flex: 1, minWidth: '140px', padding: '0 5px' }}>
            <h5 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#fff', textAlign: 'center', background: '#333', padding: '3px', borderRadius: '4px' }}>
                {title}
            </h5>
            
            <div style={sectionHeaderStyle}>Position</div>
            <div>
                <div style={rowStyle}><span style={labelStyle}>X</span><span style={valStyle}>{position.x.toFixed(4)}</span></div>
                <div style={rowStyle}><span style={labelStyle}>Y</span><span style={valStyle}>{position.y.toFixed(4)}</span></div>
                <div style={rowStyle}><span style={labelStyle}>Z</span><span style={valStyle}>{position.z.toFixed(4)}</span></div>
            </div>

            <div style={sectionHeaderStyle}>Orientation (Deg)</div>
            <div>
                <div style={rowStyle}><span style={labelStyle}>Roll</span><span style={valStyle}>{toDegrees(euler.x)}</span></div>
                <div style={rowStyle}><span style={labelStyle}>Pitch</span><span style={valStyle}>{toDegrees(euler.y)}</span></div>
                <div style={rowStyle}><span style={labelStyle}>Yaw</span><span style={valStyle}>{toDegrees(euler.z)}</span></div>
            </div>

            <div style={sectionHeaderStyle}>Quaternion</div>
            <div style={{ fontSize: '0.8rem' }}>
                <div style={rowStyle}><span style={labelStyle}>X</span><span style={valStyle}>{quaternion.x.toFixed(4)}</span></div>
                <div style={rowStyle}><span style={labelStyle}>Y</span><span style={valStyle}>{quaternion.y.toFixed(4)}</span></div>
                <div style={rowStyle}><span style={labelStyle}>Z</span><span style={valStyle}>{quaternion.z.toFixed(4)}</span></div>
                <div style={rowStyle}><span style={labelStyle}>W</span><span style={valStyle}>{quaternion.w.toFixed(4)}</span></div>
            </div>
        </div>
      );
  };

  // Render Content Logic
  let content;

  if (joint) {
      // ... (Joint Control Logic - kept same as before) ...
      const limitLower = Number(joint.limit.lower);
      const limitUpper = Number(joint.limit.upper);
      const isRevolute = joint.jointType === 'revolute' || joint.jointType === 'continuous';
      const min = !isNaN(limitLower) ? limitLower : -3.14;
      const max = !isNaN(limitUpper) ? limitUpper : 3.14;
      const step = isRevolute ? 0.01 : 0.001;
      const unit = isRevolute ? 'rad' : 'm';
      const displayValue = value ?? 0;
      
      const parentName = (joint.parent as any)?.name || 'None';
      let childName = 'None';
      if ((joint as any).child) childName = (joint as any).child.name;
      else {
          const childLink = joint.children.find(c => (c as any).isURDFLink);
          if (childLink) childName = childLink.name;
      }
      const axis = joint.axis ? `${joint.axis.x}, ${joint.axis.y}, ${joint.axis.z}` : 'N/A';

      content = (
          <div className="info-popup-content">
              <div className="matrix-section">
                  <h5>Joint Info</h5>
                  <p><strong>Type:</strong> {joint.jointType}</p>
                  <p><strong>Parent:</strong> {parentName}</p>
                  <p><strong>Child:</strong> {childName}</p>
                  <p><strong>Axis:</strong> {axis}</p>
              </div>
              <div className="matrix-section">
                  <h5>Control</h5>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>{min.toFixed(2)}</span>
                      <input 
                        type="range" 
                        min={min} 
                        max={max} 
                        step={step} 
                        value={displayValue} 
                        onChange={handleSliderChange}
                        style={{ flex: 1 }}
                      />
                      <span>{max.toFixed(2)}</span>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '5px' }}>
                     Value: <strong>{displayValue.toFixed(3)}</strong> {unit}
                  </div>
              </div>
          </div>
      );
  } else if (displayMatrix) {
      content = (
        <div className="info-popup-content" style={{ display: 'flex', gap: '15px', flexDirection: 'row', padding: '5px' }}>
            {renderMatrixInfo(displayMatrix, "Global")}
            {localMatrix && (
                <>
                    <div style={{ width: '1px', background: '#444' }}></div>
                    {renderMatrixInfo(localMatrix, "Local")}
                </>
            )}
        </div>
      );
  }

  // ... (Return JSX) ...

  return (
    <div 
        ref={popupRef} 
        className="info-popup-container" 
        style={{ top: `${currentPos.y}px`, left: `${currentPos.x}px` }}
        onMouseDown={handleStopPropagation}
        onClick={handleStopPropagation}
        onContextMenu={handleStopPropagation}
    >
      <div className="info-popup-header" onMouseDown={handleMouseDown} style={{ cursor: 'move' }}>
        <h4>{name} {joint ? '(Control)' : ''}</h4>
        <button onClick={onClose} className="close-btn">&times;</button>
      </div>
      {content}
    </div>
  );
};

export default InfoPopup;
