import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyPointDensity } from '../pointCloud';

function makePoints(count: number): THREE.Points {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = i;
    pos[i * 3 + 1] = i + 1;
    pos[i * 3 + 2] = i + 2;
    col[i * 3] = 1;
    col[i * 3 + 1] = 0.5;
    col[i * 3 + 2] = 0;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true }));
  points.userData.fullPosition = pos;
  points.userData.fullColor = col;
  points.userData.pointCount = count;
  return points;
}

describe('applyPointDensity', () => {
  it('subsamples position and color attributes by stride', () => {
    const points = makePoints(8);
    applyPointDensity(points, 0.5); // step 2 → 4 points
    expect(points.geometry.getAttribute('position').count).toBe(4);
    expect(points.geometry.getAttribute('color').count).toBe(4);
    expect(points.userData.currentDensity).toBe(0.5);
  });

  it('restores the full cloud when density reaches 1', () => {
    const points = makePoints(8);
    applyPointDensity(points, 0.5);
    applyPointDensity(points, 1);
    expect(points.geometry.getAttribute('position').count).toBe(8);
    expect(points.geometry.getAttribute('color').count).toBe(8);
    expect(points.userData.currentDensity).toBe(1);
  });

  it('keeps at least one point even at very low density', () => {
    const points = makePoints(8);
    applyPointDensity(points, 0.05); // step 20 → ceil(8/20) = 1
    expect(points.geometry.getAttribute('position').count).toBe(1);
  });

  it('is a no-op when full data is not stored on userData', () => {
    const points = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial(),
    );
    expect(() => applyPointDensity(points, 0.5)).not.toThrow();
  });
});
