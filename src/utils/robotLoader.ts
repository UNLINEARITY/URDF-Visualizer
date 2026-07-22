import * as THREE from 'three';
import URDFLoader, { type URDFRobot } from 'urdf-loader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { findFileInMap } from './fileUtils';

/** Loader interface used by urdf-loader's `loadMeshCb` parameter. */
type MeshDoneCallback = (mesh: THREE.Object3D) => void;

export interface RobotLoaderOptions {
  /** Local files from drag & drop (path -> File). Empty when loading static samples. */
  localFiles: Map<string, File>;
  /** Path of the URDF/xacro entry file (used to resolve relative mesh paths). */
  currentFilePath: string;
  /** Called with each blob URL created so callers can revoke them later. */
  onBlobUrlCreated?: (url: string) => void;
  /** LoadingManager callbacks. */
  onLoad?: () => void;
  onError?: (url: string) => void;
}

function getBaseUrl(): string {
  const base = import.meta.env.BASE_URL;
  return base.endsWith('/') ? base : base + '/';
}

/**
 * Build a THREE.LoadingManager whose URL modifier resolves:
 *  1. Local drag & drop files (blob URLs)
 *  2. ROS package:// paths against the static base URL
 *  3. Relative mesh paths against the model directory
 */
export function createRobotLoadingManager(options: RobotLoaderOptions): THREE.LoadingManager {
  const { localFiles, currentFilePath, onBlobUrlCreated } = options;

  const manager = new THREE.LoadingManager();
  const pathParts = currentFilePath.split('/');
  const modelDir = pathParts.slice(0, -1).join('/');
  const modelPackageRoot = pathParts.length > 1 ? pathParts[0] : '';
  const baseUrl = getBaseUrl();

  manager.setURLModifier((url) => {
    // 0. Local files (drag & drop)
    if (localFiles.size > 0) {
      const file = findFileInMap(url, localFiles);
      if (file) {
        const blobUrl = URL.createObjectURL(file);
        onBlobUrlCreated?.(blobUrl);
        return blobUrl;
      }
    }

    // 1. ROS package:// protocol
    if (url.startsWith('package://')) {
      return baseUrl + url.replace('package://', '');
    }

    // 2. Relative paths
    if (!url.startsWith('/') && !url.startsWith('http') && !url.startsWith('blob:')) {
      // Heuristic: URDF inside a `urdf/` folder referencing meshes at package root
      if (modelDir.endsWith('/urdf') && !url.startsWith('..')) {
        return `${baseUrl}${modelPackageRoot}/${url}`;
      }
      const fullAssetPath = modelDir ? `${modelDir}/${url}` : url;
      return `${baseUrl}${fullAssetPath}`;
    }

    return url;
  });

  if (options.onLoad) manager.onLoad = options.onLoad;
  if (options.onError) manager.onError = options.onError;

  return manager;
}

/** Mesh loader that supports STL / DAE / OBJ with graceful fallbacks. */
function createMeshLoader(manager: THREE.LoadingManager) {
  const stlLoader = new STLLoader(manager);
  const daeLoader = new ColladaLoader(manager);
  const objLoader = new OBJLoader(manager);

  return (path: string, managerArg: THREE.LoadingManager, done: MeshDoneCallback): void => {
    void managerArg;

    // urdf-loader's resolvePath() can hand us an empty value for package://
    // paths it cannot resolve — bail out gracefully instead of crashing.
    if (!path) {
      done(new THREE.Group());
      return;
    }
    const ext = path.split('.').pop()?.toLowerCase().split('?')[0] ?? '';

    const empty = () => done(new THREE.Group());

    const loadMesh = () => {
      switch (ext) {
        case 'stl':
          stlLoader.load(
            path,
            (geom) => done(new THREE.Mesh(geom, new THREE.MeshStandardMaterial())),
            undefined,
            (err) => {
              console.error('STL Load Error:', err);
              empty();
            },
          );
          break;
        case 'dae':
          daeLoader.load(path, (collada) => done(collada.scene), undefined, (err) => {
            console.error('DAE Load Error:', err);
            empty();
          });
          break;
        case 'obj':
          objLoader.load(path, (obj) => done(obj), undefined, (err) => {
            console.error('OBJ Load Error:', err);
            empty();
          });
          break;
        default:
          empty();
      }
    };

    // Only HEAD-prefetch real http(s) URLs (to guard against the dev server
    // returning HTML on a 404, which breaks the binary parsers). Paths that
    // start with "/" are produced by resolvePath() from package:// meshes and
    // MUST go through the LoadingManager URL modifier (which maps them to local
    // blob URLs) — HEAD-checking them 404s on the dev server and silently drops
    // every mesh when loading a folder.
    if (path.startsWith('http')) {
      fetch(path, { method: 'HEAD' })
        .then((res) => {
          if (!res.ok) {
            console.error(`Mesh file not found (${res.status}): ${path}`);
            empty();
            return;
          }
          loadMesh();
        })
        .catch((e) => {
          console.error('Network error checking mesh:', e);
          empty();
        });
    } else {
      loadMesh();
    }
  };
}

/**
 * Parse a URDF string into a URDFRobot, wiring up mesh loading and path resolution.
 */
export function loadRobot(urdfContent: string, options: RobotLoaderOptions): URDFRobot {
  const manager = createRobotLoadingManager(options);
  const loader = new URDFLoader(manager);
  loader.loadMeshCb = createMeshLoader(manager);
  loader.parseCollision = false;
  return loader.parse(urdfContent);
}

/** Recursively dispose geometries, materials and textures of an object tree. */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    // Mesh / Line / Sprite all optionally carry geometry + material
    const holder = obj as Partial<THREE.Mesh & THREE.Line & THREE.Sprite>;

    if (holder.geometry) holder.geometry.dispose();

    const material = holder.material;
    if (!material) return;

    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      if (!mat) continue;
      const m = mat as THREE.MeshStandardMaterial;
      m.map?.dispose();
      m.normalMap?.dispose();
      m.roughnessMap?.dispose();
      m.metalnessMap?.dispose();
      m.aoMap?.dispose();
      m.emissiveMap?.dispose();
      mat.dispose();
    }
  });
}
