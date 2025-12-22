
// Helper to recursively read all files from a DataTransferItem
export async function getAllFiles(dataTransferItemList: DataTransferItemList): Promise<Map<string, File>> {
  const fileMap = new Map<string, File>();
  const queue: FileSystemEntry[] = [];

  for (let i = 0; i < dataTransferItemList.length; i++) {
    const item = dataTransferItemList[i].webkitGetAsEntry();
    if (item) {
      queue.push(item);
    }
  }

  while (queue.length > 0) {
    const entry = queue.shift()!;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      // Store full path relative to the drag root (e.g., "my_robot/meshes/base.stl")
      // entry.fullPath usually starts with /, so we strip it.
      const fullPath = entry.fullPath.startsWith('/') ? entry.fullPath.slice(1) : entry.fullPath;
      fileMap.set(fullPath, file);
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      const entries = await readAllEntries(dirReader);
      queue.push(...entries);
    }
  }

  return fileMap;
}

// Helper to read all entries from a DirectoryReader (which handles batching)
async function readAllEntries(dirReader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  let readEntries = await new Promise<FileSystemEntry[]>((resolve, reject) => 
    dirReader.readEntries(resolve, reject)
  );

  while (readEntries.length > 0) {
    entries.push(...readEntries);
    readEntries = await new Promise<FileSystemEntry[]>((resolve, reject) => 
      dirReader.readEntries(resolve, reject)
    );
  }
  return entries;
}

// Heuristic to find a file in the map given a URDF path
// targetPath: "package://my_robot/meshes/base.stl" or "meshes/base.stl"
export function findFileInMap(targetPath: string, fileMap: Map<string, File>): File | undefined {
  // 1. Exact match (rare, as paths usually differ)
  if (fileMap.has(targetPath)) return fileMap.get(targetPath);

  // Normalize target: remove package://, file://, etc.
  let normalizedTarget = targetPath.replace(/^(package:\/\/|file:\/\/)/, '');
  
  // Try to find a key in fileMap that ends with normalizedTarget
  // Example: target "my_robot/meshes/base.stl", map key "my_robot/meshes/base.stl" -> Match
  // Example: target "meshes/base.stl", map key "robot/meshes/base.stl" -> Match? Maybe risky, but useful.
  
  // Strategy A: Exact suffix match
  // Iterate all keys? Performance might be okay for < 1000 files.
  for (const [path, file] of fileMap.entries()) {
    if (path === normalizedTarget) return file;
    if (path.endsWith('/' + normalizedTarget)) return file; // map: "root/pkg/mesh.stl", target: "pkg/mesh.stl"
    if (normalizedTarget.endsWith('/' + path)) return file; // map: "pkg/mesh.stl", target: "root/pkg/mesh.stl" (less likely)
    
    // Strategy B: Handle package:// stripping more aggressively
    // if target is "package://description/meshes/base.stl" -> "description/meshes/base.stl"
    // and map has "meshes/base.stl" (user dragged meshes folder directly)
    // We check if "description/meshes/base.stl" ends with "meshes/base.stl" -> Yes.
    
    // Common case: user drags "g1_description" folder.
    // Map has "g1_description/meshes/g1.stl".
    // URDF says "package://g1_description/meshes/g1.stl".
    // normalizedTarget = "g1_description/meshes/g1.stl".
    // Match!
  }

  // Strategy C: Loose filename match (fallback, potentially dangerous but helpful for flat structures)
  const targetFileName = normalizedTarget.split('/').pop();
  if (targetFileName) {
      for (const [path, file] of fileMap.entries()) {
          if (path.endsWith('/' + targetFileName) || path === targetFileName) {
              // Only return if it's the ONLY match? For now, first match.
              return file;
          }
      }
  }

  return undefined;
}
