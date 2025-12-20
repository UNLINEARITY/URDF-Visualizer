import React from 'react';
import * as THREE from 'three';

interface InfoPopupProps {
  name: string | null;
  matrix: THREE.Matrix4 | null;
  top: number;
  left: number;
  onClose: () => void;
}

const InfoPopup: React.FC<InfoPopupProps> = ({ name, matrix, top, left, onClose }) => {
  if (!matrix || !name) {
    return null;
  }

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();

  matrix.decompose(position, quaternion, scale);
  euler.setFromQuaternion(quaternion, 'XYZ');

  const toDegrees = (rad: number) => (rad * 180 / Math.PI).toFixed(2);

  return (
    <div className="info-popup-container" style={{ top: `${top}px`, left: `${left}px` }}>
      <div className="info-popup-header">
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
