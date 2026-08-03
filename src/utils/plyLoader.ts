import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

let worker: Worker | null = null;
let workerId = 0;

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    // Lazy: the worker chunk (and its three.js copy) is only fetched on first PLY parse.
    worker = new Worker(new URL('../workers/plyWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null; // environments without module-worker support fall back to sync parsing
  }
  return worker;
}

/**
 * Parse a PLY ArrayBuffer on a Web Worker. Attribute arrays are transferred
 * zero-copy and rebuilt into a BufferGeometry on the main thread.
 */
export function parsePlyFile(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const w = getWorker();
  if (!w) return Promise.resolve(parsePlySync(buffer));

  return new Promise((resolve, reject) => {
    const id = ++workerId;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      w.removeEventListener('message', onMessage);
      if (!e.data.ok) {
        reject(new Error(e.data.error || 'Failed to parse PLY.'));
        return;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(e.data.position, 3));
      if (e.data.color) geometry.setAttribute('color', new THREE.Float32BufferAttribute(e.data.color, 3));
      if (e.data.normal) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(e.data.normal, 3));
      if (e.data.index) geometry.setIndex(new THREE.BufferAttribute(e.data.index, 1));
      geometry.computeBoundingSphere();
      resolve(geometry);
    };
    w.addEventListener('message', onMessage);
    w.postMessage({ id, buffer }, [buffer]); // transfer the buffer into the worker
  });
}

/** Synchronous parse — used by tests and as a fallback where Worker is unavailable. */
export function parsePlySync(buffer: ArrayBuffer): THREE.BufferGeometry {
  return new PLYLoader().parse(buffer);
}
