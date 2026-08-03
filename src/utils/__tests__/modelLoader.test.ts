import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { loadStandaloneModel } from '../modelLoader';

// jsdom's File may not implement .arrayBuffer(); mirror the browser API for tests.
// Note: TextEncoder().encode().buffer comes from Node's realm and fails the
// `instanceof ArrayBuffer` check that PLYLoader relies on, so copy into an
// ArrayBuffer created in the current (jsdom) realm.
function makePlyFile(content: string, name = 'cloud.ply'): File {
  const file = new File([content], name);
  if (typeof (file as unknown as { arrayBuffer?: unknown }).arrayBuffer !== 'function') {
    (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = () => {
      const bytes = new TextEncoder().encode(content);
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      return Promise.resolve(ab);
    };
  }
  return file;
}

const coloredPointCloud = `ply
format ascii 1.0
element vertex 5
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
0 0 0 255 0 0
1 0 0 0 255 0
0 1 0 0 0 255
0 0 1 255 255 255
1 1 1 128 128 128
`;

const uncoloredPointCloud = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
end_header
0 0 0
1 0 0
0 1 0
`;

const coloredMesh = `ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
element face 2
property list uchar int vertex_indices
end_header
0 0 0 255 0 0
1 0 0 0 255 0
0 1 0 0 0 255
0 0 1 255 255 255
3 0 1 2
3 0 1 3
`;

describe('loadStandaloneModel — PLY', () => {
  it('renders a colored point cloud as THREE.Points', async () => {
    const group = await loadStandaloneModel(makePlyFile(coloredPointCloud));
    expect(group.name).toBe('cloud.ply');

    const points = group.children[0] as THREE.Points;
    expect(points).toBeInstanceOf(THREE.Points);
    expect(points.geometry.index).toBeNull();
    expect(points.userData.isPointCloud).toBe(true);
    expect(points.userData.pointCount).toBe(5);
    expect(group.userData.isPointCloud).toBe(true);

    const material = points.material as THREE.PointsMaterial;
    expect(material).toBeInstanceOf(THREE.PointsMaterial);
    expect(material.vertexColors).toBe(true);
    expect(material.size).toBeGreaterThan(0);
    expect(points.userData.basePointSize).toBe(material.size);
  });

  it('uses a neutral color for an uncolored point cloud', async () => {
    const group = await loadStandaloneModel(makePlyFile(uncoloredPointCloud));
    const points = group.children[0] as THREE.Points;
    const material = points.material as THREE.PointsMaterial;
    expect(material.vertexColors).toBe(false);
    expect(material.color.getHex()).toBe(0xb8c4d1);
  });

  it('renders a colored PLY with faces as a THREE.Mesh', async () => {
    const group = await loadStandaloneModel(makePlyFile(coloredMesh));
    const mesh = group.children[0] as THREE.Mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry.index).not.toBeNull();
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.vertexColors).toBe(true);
  });

  it('rejects unsupported extensions with a helpful message', async () => {
    await expect(
      loadStandaloneModel(makePlyFile('not a ply', 'model.xyz')),
    ).rejects.toThrow(/PLY/);
  });
});
