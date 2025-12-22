const fs = require('fs');
const path = require('path');

// Constants
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const OUTPUT_MANIFEST = path.join(PUBLIC_DIR, 'files.json');

console.log(`Scanning for URDF files in: ${PUBLIC_DIR}`);

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      // Only include .urdf files for the static manifest
      if (file.toLowerCase().endsWith('.urdf')) {
          fileList.push(filePath);
      }
    }
  });
  return fileList;
}

const allUrdfFiles = getFiles(PUBLIC_DIR);
const manifest = allUrdfFiles.map(f => {
    return path.relative(PUBLIC_DIR, f).replace(/\\/g, '/');
});

fs.writeFileSync(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`Manifest created with ${manifest.length} URDF samples.`);
console.log(manifest);
