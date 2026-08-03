import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';

const DEFAULT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xb8c4d1,
  metalness: 0.08,
  roughness: 0.62,
});

// Point size is scaled against the cloud's bounding sphere radius so the on-screen
// point size stays consistent regardless of the model's units (meters vs millimeters).
const POINT_CLOUD_SIZE_DIVISOR = 150;
const POINT_CLOUD_MIN_SIZE = 0.0005;

function createMaterial(color?: [number, number, number]): THREE.MeshStandardMaterial {
  return color
    ? new THREE.MeshStandardMaterial({
        color: new THREE.Color(color[0], color[1], color[2]),
        metalness: 0.08,
        roughness: 0.62,
      })
    : DEFAULT_MATERIAL.clone();
}

function createStlModel(file: File, buffer: ArrayBuffer): THREE.Group {
  const geometry = new STLLoader().parse(buffer);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const model = new THREE.Group();
  model.name = file.name;
  const mesh = new THREE.Mesh(geometry, createMaterial());
  mesh.name = file.name;
  model.add(mesh);
  return model;
}

async function createStepModel(file: File, buffer: ArrayBuffer): Promise<THREE.Group> {
  const { default: createOcctImporter } = await import('occt-import-js/dist/occt-import-js.js');
  const importer = await createOcctImporter({
    locateFile: (path) => (path.endsWith('.wasm') ? occtWasmUrl : path),
  });
  const result = importer.ReadStepFile(new Uint8Array(buffer), {
    linearUnit: 'meter',
    linearDeflectionType: 'bounding_box_ratio',
    linearDeflection: 0.001,
    angularDeflection: 0.5,
  });

  if (!result.success || result.meshes.length === 0) {
    throw new Error('STEP file contains no readable geometry.');
  }

  const model = new THREE.Group();
  model.name = file.name;

  for (const sourceMesh of result.meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(sourceMesh.attributes.position.array, 3),
    );
    if (sourceMesh.attributes.normal) {
      geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(sourceMesh.attributes.normal.array, 3),
      );
    } else {
      geometry.computeVertexNormals();
    }
    geometry.setIndex(sourceMesh.index.array);
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, createMaterial(sourceMesh.color));
    mesh.name = sourceMesh.name || file.name;
    model.add(mesh);
  }

  return model;
}

function createPlyModel(file: File, buffer: ArrayBuffer): THREE.Group {
  const geometry = new PLYLoader().parse(buffer);
  // PLYLoader already computes the bounding sphere in postProcess(); the guard is defensive.
  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();

  const model = new THREE.Group();
  model.name = file.name;
  const hasColor = geometry.getAttribute('color') !== undefined;

  if (geometry.index === null) {
    // Pure point cloud (no faces): PLYLoader leaves index null.
    const radius = geometry.boundingSphere?.radius ?? 1;
    const size = Math.max(radius / POINT_CLOUD_SIZE_DIVISOR, POINT_CLOUD_MIN_SIZE);
    const material = new THREE.PointsMaterial({
      size,
      sizeAttenuation: true,
      vertexColors: hasColor,
      color: hasColor ? 0xffffff : 0xb8c4d1, // white base so vertex colors show through
    });
    const points = new THREE.Points(geometry, material);
    points.name = file.name;
    points.userData.basePointSize = size; // base for the point-size slider multiplier
    points.userData.isPointCloud = true;
    points.userData.pointCount = geometry.getAttribute('position').count;
    model.add(points);
    model.userData.isPointCloud = true;
    model.userData.pointCount = points.userData.pointCount;
  } else {
    // PLY with faces: mesh path, mirrors the STL pattern.
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    const material = hasColor
      ? new THREE.MeshStandardMaterial({
          vertexColors: true,
          metalness: 0.08,
          roughness: 0.62,
        })
      : createMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = file.name;
    model.add(mesh);
  }

  return model;
}

export async function loadStandaloneModel(file: File): Promise<THREE.Group> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  switch (extension) {
    case 'stl':
      return createStlModel(file, buffer);
    case 'step':
    case 'stp':
      return createStepModel(file, buffer);
    case 'ply':
      return createPlyModel(file, buffer);
    default:
      throw new Error('Supported standalone formats are STL, STEP, STP, and PLY.');
  }
}
