declare module 'occt-import-js/dist/occt-import-js.js' {
  interface OcctMesh {
    name: string;
    color?: [number, number, number];
    attributes: {
      position: { array: number[] };
      normal?: { array: number[] };
    };
    index: { array: number[] };
  }

  interface OcctResult {
    success: boolean;
    meshes: OcctMesh[];
  }

  interface OcctImporter {
    ReadStepFile(content: Uint8Array, params: Record<string, unknown> | null): OcctResult;
  }

  interface OcctImporterOptions {
    locateFile?: (path: string) => string;
  }

  const createOcctImporter: (options?: OcctImporterOptions) => Promise<OcctImporter>;
  export default createOcctImporter;
}

declare module 'occt-import-js/dist/occt-import-js.wasm?url' {
  const url: string;
  export default url;
}
