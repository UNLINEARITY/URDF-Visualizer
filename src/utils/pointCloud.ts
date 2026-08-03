import * as THREE from 'three';

/**
 * Stride-subsample a point cloud to the given density (0–1) by rebuilding the
 * Points geometry from the full arrays stored on userData. density >= 1 restores
 * the full cloud. O(n) and keeps the full arrays referenced so density can be
 * raised again without re-parsing. The bounding sphere is intentionally left at
 * its full-cloud value (conservative frustum culling, correct).
 */
export function applyPointDensity(points: THREE.Points, density: number): void {
  const full = points.userData.fullPosition as Float32Array | undefined;
  if (!full) return;
  const fullColor = (points.userData.fullColor as Float32Array | null) ?? null;
  const fullCount = points.userData.pointCount as number;

  if (density >= 1 || fullCount <= 1) {
    points.geometry.setAttribute('position', new THREE.Float32BufferAttribute(full, 3));
    if (fullColor) points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(fullColor, 3));
    points.userData.currentDensity = 1;
    return;
  }

  const step = Math.max(1, Math.round(1 / density));
  const outCount = Math.max(1, Math.ceil(fullCount / step));
  const pos = new Float32Array(outCount * 3);
  const col = fullColor ? new Float32Array(outCount * 3) : null;

  for (let i = 0, o = 0; i < fullCount; i += step, o++) {
    pos[o * 3] = full[i * 3];
    pos[o * 3 + 1] = full[i * 3 + 1];
    pos[o * 3 + 2] = full[i * 3 + 2];
    if (col && fullColor) {
      col[o * 3] = fullColor[i * 3];
      col[o * 3 + 1] = fullColor[i * 3 + 1];
      col[o * 3 + 2] = fullColor[i * 3 + 2];
    }
  }

  points.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col) points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  points.userData.currentDensity = density;
}
