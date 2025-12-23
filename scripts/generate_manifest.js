const fs = require('fs');
const path = require('path');

// Constants (Adjusted for scripts/ folder in root)
const PROJECT_ROOT = path.resolve(__dirname, '..'); 
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const OUTPUT_MANIFEST = path.join(PUBLIC_DIR, 'files.json');

console.log(`Scanning directory: ${PUBLIC_DIR}`);

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function isEntryFile(filename) {
    const lower = filename.toLowerCase();
    
    // Valid extensions
    if (!lower.endsWith('.urdf') && !lower.endsWith('.xacro')) return false;
    
    const relPath = path.relative(PUBLIC_DIR, filename);
    const depth = relPath.split(path.sep).length;

    // 1. Root files are always entries
    if (depth === 1) return true; 
    
    // 2. Subdirectory files: ONLY show 'main' files
    if (lower.includes('main')) {
        return true;
    }
    
    // 3. Pure URDFs in subdirs are usually entry points
    if (lower.endsWith('.urdf')) return true;

    return false;
}

try {
    const allFiles = getFiles(PUBLIC_DIR);
    const sampleFiles = [];

    for (const filePath of allFiles) {
        if (isEntryFile(filePath)) {
            const relPath = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, '/');
            sampleFiles.push(relPath);
        }
    }

    fs.writeFileSync(OUTPUT_MANIFEST, JSON.stringify(sampleFiles, null, 2));
    console.log(`\u2705 Success! Manifest created with ${sampleFiles.length} samples.`);
    console.log(`   Location: ${OUTPUT_MANIFEST}`);
} catch (e) {
    console.error("\u274C Error scanning files:", e);
}
