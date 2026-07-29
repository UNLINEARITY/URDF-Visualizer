import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';

const DEFAULT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xb8c4d1,
  metalness: 0.08,
  roughness: 0.62,
});

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

export async function loadStandaloneModel(file: File): Promise<THREE.Group> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  switch (extension) {
    case 'stl':
      return createStlModel(file, buffer);
    case 'step':
    case 'stp':
      return createStepModel(file, buffer);
    default:
      throw new Error('Supported standalone formats are STL, STEP, and STP.');
  }
}
