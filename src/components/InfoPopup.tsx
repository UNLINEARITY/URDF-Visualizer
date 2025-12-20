import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

interface InfoPopupProps {
  name: string | null;
  matrix: THREE.Matrix4 | null;
  top: number;
  left: number;
  onClose: () => void;
  onPositionChange: (x: number, y: number) => void;
}

const InfoPopup: React.FC<InfoPopupProps> = ({ name, matrix, top, left, onClose, onPositionChange }) => {
  if (!matrix || !name) {
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

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();

  matrix.decompose(position, quaternion, scale);
  euler.setFromQuaternion(quaternion, 'XYZ');

  const toDegrees = (rad: number) => (rad * 180 / Math.PI).toFixed(2);

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
        <h4>{name}</h4>
        <button onClick={onClose} className="close-btn">&times;</button>
      </div>
      <div className="info-popup-content">
        <div className="matrix-section">
          <h5>Position (X, Y, Z):</h5>
          <p>X: {position.x.toFixed(4)}</p>
          <p>Y: {position.y.toFixed(4)}</p>
          <p>Z: {position.z.toFixed(4)}</p>
        </div>
        <div className="matrix-section">
          <h5>Orientation (Roll, Pitch, Yaw - deg):</h5>
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
    </div>
  );
};

export default InfoPopup;
