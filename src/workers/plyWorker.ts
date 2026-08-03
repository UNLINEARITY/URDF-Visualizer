import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

interface PlyWorkerRequest {
  id: number;
  buffer: ArrayBuffer;
}

interface PlyWorkerResponse {
  id: number;
  ok: boolean;
  error?: string;
  position?: Float32Array;
  color?: Float32Array;
  normal?: Float32Array;
  index?: Uint8Array | Uint16Array | Uint32Array | null;
}

// tsconfig's lib does not include WebWorker, so type the scope explicitly
// instead of referencing DedicatedWorkerGlobalScope.
interface PlyWorkerScope {
  postMessage(message: PlyWorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<PlyWorkerRequest>) => void) | null;
}

const ctx = self as unknown as PlyWorkerScope;

ctx.onmessage = (e) => {
  const { id, buffer } = e.data;
  try {
    const geometry = new PLYLoader().parse(buffer);
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const normal = geometry.getAttribute('normal');
    const index = geometry.getIndex();

    // PLYLoader always emits Float32 attributes and a Uint8/16/32 index.
    const positionArray = position.array as Float32Array;
    const colorArray = (color ? color.array : undefined) as Float32Array | undefined;
    const normalArray = (normal ? normal.array : undefined) as Float32Array | undefined;
    const indexArray = (index ? index.array : null) as
      | Uint8Array
      | Uint16Array
      | Uint32Array
      | null;

    // Transferable: pass the typed arrays and move their buffers (zero-copy).
    const transfer: Transferable[] = [positionArray.buffer];
    const response: PlyWorkerResponse = {
      id,
      ok: true,
      position: positionArray,
      index: indexArray,
    };
    if (colorArray) {
      response.color = colorArray;
      transfer.push(colorArray.buffer);
    }
    if (normalArray) {
      response.normal = normalArray;
      transfer.push(normalArray.buffer);
    }
    ctx.postMessage(response, transfer);
  } catch (err) {
    ctx.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
