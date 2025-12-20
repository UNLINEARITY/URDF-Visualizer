import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { URDFJoint } from 'urdf-loader';

interface InfoPopupProps {
  name: string | null;
  matrix: THREE.Matrix4 | null;
  joint?: URDFJoint | null; // Optional: for control mode
  value?: number; // Controlled value for joint
  onJointChange?: (value: number) => void;
  top: number;
  left: number;
  onClose: () => void;
  onPositionChange: (x: number, y: number) => void;
}

const InfoPopup: React.FC<InfoPopupProps> = ({ name, matrix, joint, value, onJointChange, top, left, onClose, onPositionChange }) => {
  if (!name || (!matrix && !joint)) {
    return null;
  }

  // Local state for position to ensure smooth dragging
  const [currentPos, setCurrentPos] = useState({ x: left, y: top });
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);
  
  // Sync with props when parent updates position (e.g. new selection)
  useEffect(() => {
    setCurrentPos({ x: left, y: top });
  }, [top, left]);
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (onJointChange) {
          onJointChange(val);
      }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!popupRef.current || !popupRef.current.parentElement) return;
    
    setIsDragging(true);
    const rect = popupRef.current.getBoundingClientRect();
    const parentRect = popupRef.current.parentElement.getBoundingClientRect();

    offsetRef.current = {
      // Offset of mouse relative to the popup's top-left corner
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      // Store parent offset to correct calculations during move
      parentX: parentRect.left,
      parentY: parentRect.top
    } as any;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      
      const offset = offsetRef.current as any;
      
      // Calculate new position relative to the PARENT container
      // Position = (Mouse Client Pos - Parent Offset) - Mouse Offset within Popup
      const newX = (e.clientX - offset.parentX) - offset.x;
      const newY = (e.clientY - offset.parentY) - offset.y;
      
      setCurrentPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        // Report final position to parent to save preference
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

  const handleStopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Render Content Logic
  let content;

  // Correct the matrix for display to match URDF Z-up coordinates
  // The Viewer rotates the robot by -90deg on X. We rotate back by +90deg.
  const displayMatrix = React.useMemo(() => {
      if (!matrix) return null;
      const correction = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      // We apply the correction to the world matrix to align it back to Z-up
      return correction.multiply(matrix);
  }, [matrix]);

  if (joint) {
      // --- Control Mode ---
      const limitLower = Number(joint.limit.lower);
      const limitUpper = Number(joint.limit.upper);
      const isRevolute = joint.jointType === 'revolute' || joint.jointType === 'continuous';
      
      // Handle continuous joints or missing limits
      const min = !isNaN(limitLower) ? limitLower : -3.14;
      const max = !isNaN(limitUpper) ? limitUpper : 3.14;
      const step = isRevolute ? 0.01 : 0.001;
      const unit = isRevolute ? 'rad' : 'm';
      const displayValue = value ?? 0;

      content = (
          <div className="info-popup-content">
              <div className="matrix-section">
                  <h5>Joint Control ({joint.jointType})</h5>
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
      // --- Matrix Info Mode ---
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const euler = new THREE.Euler();

      displayMatrix.decompose(position, quaternion, scale);
      euler.setFromQuaternion(quaternion, 'XYZ');
      const toDegrees = (rad: number) => (rad * 180 / Math.PI).toFixed(2);
      
      content = (
        <div className="info-popup-content">
            <div className="matrix-section">
            <h5>Position (URDF Z-up):</h5>
            <p>X: {position.x.toFixed(4)}</p>
            <p>Y: {position.y.toFixed(4)}</p>
            <p>Z: {position.z.toFixed(4)}</p>
            </div>
            <div className="matrix-section">
            <h5>Orientation (RPY - deg):</h5>
            <p>Roll: {toDegrees(euler.x)}°</p>
            <p>Pitch: {toDegrees(euler.y)}°</p>
            <p>Yaw: {toDegrees(euler.z)}°</p>
            </div>
            <div className="matrix-section">
            <h5>Quaternion (X, Y, Z, W):</h5>
            <p>X: {quaternion.x.toFixed(4)}</p>
            <p>Y: {quaternion.y.toFixed(4)}</p>
            <p>Z: {quaternion.z.toFixed(4)}</p>
            <p>W: {quaternion.w.toFixed(4)}</p>
            </div>
        </div>
      );
  }

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
