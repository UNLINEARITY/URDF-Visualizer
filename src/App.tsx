import React, { useState, useCallback, useEffect, useRef } from 'react';
import URDFLoader, { URDFRobot, URDFJoint } from 'urdf-loader';
import { XacroParser } from 'xacro-parser';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import Viewer from './components/Viewer';
import JointController from './components/JointController';
import DisplayOptions from './components/DisplayOptions';
import InfoPopup from './components/InfoPopup';
import StructureTree from './components/StructureTree';
import { getAllFiles, findFileInMap } from './utils/fileUtils';

interface LinkSelection {
  name: string | null;
  matrix: THREE.Matrix4 | null;
  parentMatrix: THREE.Matrix4 | null;
  visible: boolean;
  position: { x: number; y: number; };
}

interface JointSelection {
  joint: URDFJoint | null;
  visible: boolean;
  position: { x: number; y: number; };
}

function App() {
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [urdfContent, setUrdfContent] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Display options state
  const [showWorldAxes, setShowWorldAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLinkAxes, setShowLinkAxes] = useState(false);
  const [showJointAxes, setShowJointAxes] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [showStructureTree, setShowStructureTree] = useState(false);
  
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [sampleFiles, setSampleFiles] = useState<string[]>([]);
  // const [isStaticMode, setIsStaticMode] = useState(false); // Removed
  
  // -- GLOBAL JOINT STATE --
  const [jointValues, setJointValues] = useState<Record<string, number>>({});

  // -- Independent Selection States --
  const [linkSelection, setLinkSelection] = useState<LinkSelection>({
    name: null,
    matrix: null,
    parentMatrix: null,
    visible: false,
    position: { x: 0, y: 0 },
  });
  
  const [jointSelection, setJointSelection] = useState<JointSelection>({
    joint: null,
    visible: false,
    position: { x: 0, y: 0 },
  });

  const lastLinkPosRef = React.useRef<{x: number, y: number} | null>(null);
  const lastJointPosRef = React.useRef<{x: number, y: number} | null>(null);
  
  // Store dropped files mapping (path -> File)
  const localFilesRef = useRef<Map<string, File>>(new Map());
  // Store blob URLs to revoke them later
  const createdBlobUrls = useRef<string[]>([]);

  // Initialize joint values when robot loads
  useEffect(() => {
    if (robot) {
        const initialValues: Record<string, number> = {};
        Object.values(robot.joints).forEach(j => {
            if (j.jointType !== 'fixed') {
                initialValues[j.name] = j.angle as number || 0;
            }
        });
        setJointValues(initialValues);
    }
  }, [robot]);
  
  // Handles Link Selection & Updates (Called by Viewer on click AND in animate loop)
  const handleSelectionUpdate = useCallback((name: string | null, matrix: THREE.Matrix4 | null, parentMatrix: THREE.Matrix4 | null, visible: boolean = true) => {
      if (!name) {
          setLinkSelection(prev => ({...prev, visible: false, name: null, matrix: null, parentMatrix: null}));
          return;
      }
      const position = lastLinkPosRef.current || {
          x: window.innerWidth / 2 - 320, 
          y: window.innerHeight / 2 - 200,
      };
      
      setLinkSelection(prev => {
          return {
            name: name,
            matrix: matrix,
            parentMatrix: parentMatrix,
            visible: visible, // Use the passed visibility
            position: prev.visible ? prev.position : position,
          };
      });
  }, []);

  // Handles Joint Selection (Ctrl + Right-Click)
  const handleJointSelect = useCallback((joint: URDFJoint) => {
      const position = lastJointPosRef.current || {
          x: window.innerWidth / 2 + 20, 
          y: window.innerHeight / 2 - 200,
      };
      setJointSelection({
          joint: joint,
          visible: true,
          position: position,
      });
  }, []);

  // Global handler for joint changes (Syncs Controller, Popup, and Robot)
  const handleJointChange = useCallback((name: string, value: number) => {
      if (robot) {
          robot.setJointValue(name, value);
          setJointValues(prev => ({ ...prev, [name]: value }));
      }
  }, [robot]);

  // Popup Drag Handlers
  const handleLinkPopupDrag = (x: number, y: number) => {
    const pos = { x, y };
    setLinkSelection(prev => ({ ...prev, position: pos }));
    lastLinkPosRef.current = pos;
  };
  
  const handleJointPopupDrag = (x: number, y: number) => {
    const pos = { x, y };
    setJointSelection(prev => ({ ...prev, position: pos }));
    lastJointPosRef.current = pos;
  };

  const closeLinkPopup = () => setLinkSelection(prev => ({ ...prev, visible: false, name: null }));
  const closeJointPopup = () => setJointSelection(prev => ({ ...prev, visible: false, joint: null }));


  // Effect to fetch the list of sample files from the static manifest
  useEffect(() => {
    fetch('files.json')
        .then(res => {
            if (res.ok && res.headers.get('content-type')?.includes('json')) {
                return res.json().then(files => {
                    console.log("Loaded static manifest", files);
                    setSampleFiles(files);
                });
            } else {
                throw new Error("No static manifest");
            }
        })
        .catch(err => {
            console.error("Failed to load sample list:", err);
        });
  }, []);

  // Cleanup Blob URLs on unmount or new load
  useEffect(() => {
      return () => {
          createdBlobUrls.current.forEach(url => URL.revokeObjectURL(url));
          createdBlobUrls.current = [];
      };
  }, [urdfContent]);

  // Effect to parse the robot model whenever the content changes
  useEffect(() => {
    if (!urdfContent) {
      setRobot(null);
      setError(null);
      return;
    };

    setLoading(true);
    setError(null);
    setRobot(null);
    // Close popups when loading new model
    setLinkSelection(prev => ({ ...prev, visible: false }));
    setJointSelection(prev => ({ ...prev, visible: false }));

    // Defer the parsing to allow the UI to update
    setTimeout(() => {
      const manager = new THREE.LoadingManager();
      
      // Determine the directory of the current model file
      const pathParts = currentFilePath.split('/');
      const modelDir = pathParts.slice(0, -1).join('/');
      const modelPackageRoot = pathParts.length > 1 ? pathParts[0] : '';
      const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';

      // Setup URL Modifier to handle package:// and URDF-relative paths
      manager.setURLModifier((url) => {
          // 0. Check Local Files (Drag & Drop)
          if (localFilesRef.current.size > 0) {
              const file = findFileInMap(url, localFilesRef.current);
              if (file) {
                  const blobUrl = URL.createObjectURL(file);
                  createdBlobUrls.current.push(blobUrl);
                  return blobUrl;
              }
          }

          // 1. Handle ROS package:// protocol
          if (url.startsWith('package://')) {
               return baseUrl + url.replace('package://', '');
          }
          
          // 2. Handle relative paths
          if (!url.startsWith('/') && !url.startsWith('http') && !url.startsWith('blob:')) {
              // Heuristic: If the URDF is in a 'urdf' folder but meshes are one level up
              // and the path doesn't already have '../'
              if (modelDir.endsWith('/urdf') && !url.startsWith('..')) {
                  // Try to look in the package root instead of the urdf folder
                  return `${baseUrl}${modelPackageRoot}/${url}`;
              }

              const fullAssetPath = modelDir ? `${modelDir}/${url}` : url;
              return `${baseUrl}${fullAssetPath}`;
          }
          
          return url;
      });

      const loader = new URDFLoader(manager);
      
      // Explicitly define how to load meshes with safety checks
      const stlLoader = new STLLoader(manager);
      const daeLoader = new ColladaLoader(manager);
      const objLoader = new OBJLoader(manager);

      loader.meshLoader = (path, ext, done) => {
          // Standard fetching for HTTP/Blob URLs
          // We can't easily use fetch HEAD on blob URLs or mixed content easily without potential CORS or method issues,
          // but Three.js loaders handle basic fetching. 
          // However, for our backend '404 HTML' protection, we only check http paths.
          
          const isRemote = path.startsWith('http') || path.startsWith('/');

          const loadMesh = () => {
              if (ext.toLowerCase() === 'stl') {
                  stlLoader.load(path, geom => {
                      const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
                      done(mesh);
                  }, undefined, err => {
                      console.error("STL Load Error:", err);
                      done(new THREE.Group());
                  });
              } else if (ext.toLowerCase() === 'dae') {
                  daeLoader.load(path, collada => {
                      done(collada.scene);
                  }, undefined, err => {
                      console.error("DAE Load Error:", err);
                      done(new THREE.Group());
                  });
              } else if (ext.toLowerCase() === 'obj') {
                  objLoader.load(path, obj => {
                      done(obj);
                  }, undefined, err => {
                      console.error("OBJ Load Error:", err);
                      done(new THREE.Group());
                  });
              } else {
                  done(new THREE.Group());
              }
          };

          if (isRemote) {
               fetch(path, { method: 'HEAD' }).then(res => {
                  if (!res.ok) {
                      console.error(`Mesh file not found (404/500): ${path}`);
                      done(new THREE.Group());
                      return;
                  }
                  loadMesh();
               }).catch(e => {
                   console.error("Network error checking mesh:", e);
                   done(new THREE.Group());
               });
          } else {
              // Blob URL or other, just load
              loadMesh();
          }
      };

      loader.loadCollision = false;

      manager.onLoad = () => setLoading(false);
      manager.onError = (url) => {
        console.error(`Failed to load resource: ${url}`);
      };

      try {
        const loadedRobot = loader.parse(urdfContent);
        setRobot(loadedRobot);
      } catch (err) {
        console.error('Error parsing URDF:', err);
        setError(`Failed to parse URDF: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }

      if (!manager.isLoading) {
        setLoading(false);
      }
    }, 10);

  }, [urdfContent]); // Removed isStaticMode dependency


  // Keyboard shortcuts effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
          setIsCtrlPressed(true);
      }

      if (document.activeElement?.tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case 'w': setShowWorldAxes(v => !v); break;
        case 'g': setShowGrid(v => !v); break;
        case 'l': setShowLinkAxes(v => !v); break;
        case 'j': setShowJointAxes(v => !v); break;
        case 'f': setWireframe(v => !v); break;
        case 't': setShowStructureTree(v => !v); break;
        case 'escape': 
            closeLinkPopup(); 
            closeJointPopup();
            setShowStructureTree(false);
            break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Control') {
            setIsCtrlPressed(false);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const resolveUrlPath = (base: string, relative: string) => {
      if (relative.startsWith('http') || relative.startsWith('/')) return relative;
      const stack = base.split('/');
      stack.pop(); // Remove filename
      const parts = relative.split('/');
      for (const part of parts) {
          if (part === '.') continue;
          if (part === '..') stack.pop();
          else stack.push(part);
      }
      return stack.join('/');
  };

  const fetchAndFlattenXacro = async (url: string): Promise<string> => {
      console.log(`[Xacro] Fetching: ${url}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${url}`);
      const content = await response.text();
      
      // Handle spaces around =
      const includeRegex = /<xacro:include\s+filename\s*=\s*['"]([^'"]+)['"]\s*\/?>/g;
      let match;
      let newContent = content;
      const matches: { full: string, path: string, index: number }[] = [];
      
      while ((match = includeRegex.exec(content)) !== null) {
          matches.push({ full: match[0], path: match[1], index: match.index });
      }

      const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';

      for (let i = matches.length - 1; i >= 0; i--) {
          const { full, path: includePath } = matches[i];
          let targetUrl = '';

          // Handle $(find pkg)
          let cleanPath = includePath.replace(/\$\([a-z_]+\s+([\w_]+)\)/g, 'package://$1'); // $(find pkg) -> package://pkg
          
          // Remove leading slash if present to avoid double slash with baseUrl
          if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);

          if (cleanPath.startsWith('package://')) {
               const pkgPath = cleanPath.replace('package://', '');
               targetUrl = baseUrl + pkgPath;
          } else {
               targetUrl = resolveUrlPath(url, cleanPath);
          }
          
          // Fix double slashes just in case (except http://)
          targetUrl = targetUrl.replace(/([^:])\/\//g, '$1/');

          try {
              let includedContent = await fetchAndFlattenXacro(targetUrl);
               // Clean content
              includedContent = includedContent.replace(/<\?xml.*?\?>/g, '');
              // Remove <robot> tag and anything following the closing tag (like comments)
              includedContent = includedContent.replace(/<robot\b[^>]*>/, '');
              includedContent = includedContent.replace(/<\/robot>[\s\S]*$/, '');
              
              const before = newContent.substring(0, matches[i].index);
              const after = newContent.substring(matches[i].index + full.length);
              newContent = before + includedContent + after;
          } catch (e) {
              console.warn(`Failed to include ${targetUrl}`, e);
          }
      }
      return newContent;
  };

  const flattenXacro = async (content: string, filesMap: Map<string, File>): Promise<string> => {
      const includeRegex = /<xacro:include\s+filename=['"]([^'"]+)['"]\s*\/?>/g;
      let match;
      let newContent = content;
      
      // We need to handle matches one by one. 
      // Since replacing changes indices, we can't iterate easily.
      // Better: find all matches, resolve them, then replace.
      
      // Actually, standard while loop with replacement works if we restart or are careful.
      // But simpler: split by regex? No.
      
      // Let's use a replaceAsync approach
      const matches: { full: string, path: string, index: number }[] = [];
      while ((match = includeRegex.exec(content)) !== null) {
          matches.push({ full: match[0], path: match[1], index: match.index });
      }
      
      // Process from last to first to avoid index shifting
      for (let i = matches.length - 1; i >= 0; i--) {
          const { full, path } = matches[i];
          
          // 1. Resolve $(find pkg)
          // Simple replacement: $(find pkg) -> pkg
          let resolvedPath = path.replace(/\$\(find\s+([\w_]+)\)/g, '$1');
          
          // 2. Find file
          const file = findFileInMap(resolvedPath, filesMap);
          
          if (file) {
              let fileText = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.readAsText(file);
              });
              
              // Clean fileText: remove XML declaration and root <robot> tags
              fileText = fileText.replace(/<\?xml.*?\?>/g, '');
              // Match <robot ...> but be careful not to match just any <robot
              // We'll use a slightly safer regex to strip the first <robot> and last </robot>
              fileText = fileText.replace(/<robot\b[^>]*>/, '');
              fileText = fileText.replace(/<\/robot>\s*$/, '');
              
              // 3. Recurse
              const flattenedInclude = await flattenXacro(fileText, filesMap);
              
              // 4. Replace
              const before = newContent.substring(0, matches[i].index);
              const after = newContent.substring(matches[i].index + full.length);
              newContent = before + flattenedInclude + after;
          }
      }
      
      return newContent;
  };

  const processAndSetContent = async (filename: string, content: string, isLocal = false) => {
    if (filename.toLowerCase().endsWith('.xacro')) {
      setLoading(true);
      try {
        let urdfString = "";
        
        // If it's a local file (Drag & Drop) or a pre-flattened static file
        // We use the local parser logic. 
        // Note: For Drag & Drop, 'localFilesRef' has files. 
        // For Static Samples, 'localFilesRef' is empty, but 'content' is already flattened by fetchAndFlattenXacro.
        // So flattenXacro(content, emptyMap) -> returns content unchanged.
        
        const flattenedContent = await flattenXacro(content, localFilesRef.current);
        
        const parser = new XacroParser();
        parser.rospack = { find: (pkg) => `package://${pkg}` };
        const xml = await parser.parse(flattenedContent);
        
        const serializer = new XMLSerializer();
        urdfString = serializer.serializeToString(xml);
        
        console.log("[App] Generated URDF (preview):", urdfString.slice(0, 500));
        setUrdfContent(urdfString);
      } catch (err) {
        console.error("Xacro parsing error:", err);
        setError(`Xacro Error: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    } else {
      setUrdfContent(content);
    }
  };

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clear local map when using file input (assumed single file)
      localFilesRef.current.clear();
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCurrentFilePath(file.name);
        processAndSetContent(file.name, content, true);
      };
      reader.onerror = () => {
        setError('Failed to read file.');
      };
      reader.readAsText(file);
    }
  }, []);

  const handleFolderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setLoading(true);
      setError(null);

      // Construct map from FileList
      const filesMap = new Map<string, File>();
      Array.from(files).forEach(file => {
          // webkitRelativePath is like "folder/sub/file.ext"
          filesMap.set(file.webkitRelativePath, file);
      });
      
      localFilesRef.current = filesMap;
      
      const urdfFiles: File[] = [];
      filesMap.forEach((file) => {
          if (file.name.endsWith('.urdf') || file.name.endsWith('.xacro')) {
              urdfFiles.push(file);
          }
      });

      if (urdfFiles.length === 0) {
          setError("No .urdf or .xacro file found in the selected folder.");
          setLoading(false);
          return;
      }

      let entryFile = urdfFiles.find(f => f.name.toLowerCase().includes('main'));
      if (!entryFile) entryFile = urdfFiles.find(f => f.name.toLowerCase().includes('robot'));
      if (!entryFile) entryFile = urdfFiles[0];

      if (entryFile) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const content = ev.target?.result as string;
              setCurrentFilePath(entryFile!.name);
              processAndSetContent(entryFile!.name, content, true);
          };
          reader.readAsText(entryFile);
      }
  }, []);

  const handleSampleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const filename = event.target.value;
    if (!filename) {
      setUrdfContent(null);
      return;
    };
    
    // Clear local map when switching to sample
    localFilesRef.current.clear();

    setLoading(true);
    setCurrentFilePath(filename);

    if (filename.endsWith('.xacro')) {
            fetchAndFlattenXacro(filename)
            .then(content => {
                // Pass as 'local' (true) to skip backend call, but we already flattened it,
                // so processAndSetContent will essentially just parse the URDF string.
                processAndSetContent(filename, content, true);
            })
            .catch(err => {
                console.error(err);
                setError(`Failed to load Xacro: ${err.message}`);
                setLoading(false);
            });
    } else {
            fetch(filename)
            .then(res => res.text())
            .then(content => {
                setUrdfContent(content);
            })
            .catch(err => {
                    setError(`Failed to fetch ${filename}`);
                    setLoading(false);
            });
    }
  }, []);

  // --- Drag & Drop Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      
      if (!e.dataTransfer.items) return;

      setLoading(true);
      setError(null);

      try {
          const filesMap = await getAllFiles(e.dataTransfer.items);
          localFilesRef.current = filesMap;
          
          // Find entry file (.urdf or .xacro)
          const urdfFiles: File[] = [];
          
          filesMap.forEach((file, path) => {
              if (file.name.endsWith('.urdf') || file.name.endsWith('.xacro')) {
                  urdfFiles.push(file);
              }
          });

          if (urdfFiles.length === 0) {
              throw new Error("No .urdf or .xacro file found in the dropped folder.");
          }

          // Heuristic to find the best entry point
          // 1. Look for 'main' in the filename (user's specific request)
          // 2. Look for 'robot' in the filename
          // 3. Fallback to shortest path (likely in root)
          
          let entryFile = urdfFiles.find(f => f.name.toLowerCase().includes('main'));
          
          if (!entryFile) {
              entryFile = urdfFiles.find(f => f.name.toLowerCase().includes('robot'));
          }

          if (!entryFile) {
              // Sort by path length (depth), pick the shallowest one
              // Since we don't have full path here easily accessible attached to File object in this array 
              // (we only stored File objects), we might just pick the first one.
              // But actually we have access to the map. Let's just pick the first one for now as fallback.
              entryFile = urdfFiles[0];
          }
          
          if (entryFile) {
             const reader = new FileReader();
             reader.onload = (ev) => {
                 const content = ev.target?.result as string;
                 setCurrentFilePath(entryFile!.name); // Or full path? URDFLoader doesn't use this for parsing, only my logic
                 processAndSetContent(entryFile!.name, content, true);
             };
             reader.readAsText(entryFile);
          }
      } catch (err) {
          console.error("Drop error:", err);
          setError(err instanceof Error ? err.message : "Failed to process dropped files");
          setLoading(false);
      }
  }, []);

  return (
    <div 
        className="app-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {isDragActive && (
          <div className="drag-overlay">
              <h3>Drop URDF/Xacro Folder Here</h3>
          </div>
      )}
      <div className="ui-container">
        <h2>URDF Visualizer</h2>
        <p>Load a sample or drag & drop a folder.</p>
        <select onChange={handleSampleChange} value={sampleFiles.includes(currentFilePath) ? currentFilePath : ""} className="file-input">
            <option value="">-- Select a Sample --</option>
            {sampleFiles.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        
        <label htmlFor="file-upload" className="custom-file-upload btn-file">
            <i>📄</i> Select URDF/Xacro File
        </label>
        <input 
            id="file-upload"
            type="file" 
            accept=".urdf,.xacro" 
            onChange={handleFileChange} 
            className="file-input-hidden" 
        />

        <label htmlFor="folder-upload" className="custom-file-upload btn-folder">
            <i>📁</i> Select Project Folder
        </label>
        <input 
            id="folder-upload"
            type="file" 
            {...{ webkitdirectory: "", directory: "" } as any} 
            onChange={handleFolderChange} 
            className="file-input-hidden" 
        />
        <hr />
        <DisplayOptions
            showWorldAxes={showWorldAxes} setShowWorldAxes={setShowWorldAxes}
            showGrid={showGrid} setShowGrid={setShowGrid}
            showLinkAxes={showLinkAxes} setShowLinkAxes={setShowLinkAxes}
            showJointAxes={showJointAxes} setShowJointAxes={setShowJointAxes}
            wireframe={wireframe} setWireframe={setWireframe}
        />
        <hr />
        {robot && (
            <JointController 
                robot={robot} 
                jointValues={jointValues} 
                onJointChange={handleJointChange} 
            />
        )}
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>
              <div className="viewer-container">
              {loading && <div className="loading-indicator">Loading...</div>}
              
              {/* Link Info Popup - Hidden when Tree is open */}
              {linkSelection.visible && !showStructureTree && (
                  <InfoPopup
                      name={linkSelection.name}
                      matrix={linkSelection.matrix}                parentMatrix={linkSelection.parentMatrix}
                top={linkSelection.position.y}
                left={linkSelection.position.x}
                onClose={closeLinkPopup}
                onPositionChange={handleLinkPopupDrag}
            />
        )}

        {/* Joint Control Popup - Hidden when Tree is open */}
        {jointSelection.visible && jointSelection.joint && !showStructureTree && (
            <InfoPopup
                name={jointSelection.joint.name}
                matrix={null}
                joint={jointSelection.joint}
                value={jointValues[jointSelection.joint.name]}
                onJointChange={(val) => handleJointChange(jointSelection.joint!.name, val)}
                top={jointSelection.position.y}
                left={jointSelection.position.x}
                onClose={closeJointPopup}
                onPositionChange={handleJointPopupDrag}
            />
        )}

        <Viewer
          robot={robot}
          isCtrlPressed={isCtrlPressed}
          // Pass name regardless of visible flag, allowing highlight-only state
          selectedLinkName={linkSelection.name}
          selectedJoint={jointSelection.visible ? jointSelection.joint : null}
          showWorldAxes={showWorldAxes}
          showGrid={showGrid}
          showLinkAxes={showLinkAxes}
          showJointAxes={showJointAxes}
          wireframe={wireframe}
          onSelectionUpdate={handleSelectionUpdate}
          onJointSelect={handleJointSelect}
          onJointChange={handleJointChange}
          onMatrixUpdate={() => {}} // No-op, driven by onSelectionUpdate now
        />

        {/* Floating Toggle Button for Structure Tree */}
        {robot && (
            <button 
                className="structure-tree-toggle"
                onClick={() => setShowStructureTree(!showStructureTree)}
                title="Toggle Kinematic Structure Tree"
            >
                🌳
            </button>
        )}

        {/* Structure Tree Overlay - Always mounted to preserve state, toggled via CSS */}
        {robot && (
            <div style={{ display: showStructureTree ? 'block' : 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2000 }}>
                <StructureTree 
                    robot={robot} 
                    onClose={() => setShowStructureTree(false)} 
                    onSelect={(obj) => {
                        // Check type and call appropriate handler
                        if ((obj as any).isURDFLink) {
                            const link = obj as THREE.Object3D;
                            link.updateWorldMatrix(true, false);
                            // Pass visible=false to highlight WITHOUT showing the InfoPopup
                            handleSelectionUpdate(link.name, link.matrixWorld, link.parent ? link.parent.matrixWorld : null, false);
                        } else if ((obj as any).isURDFJoint) {
                            const joint = obj as URDFJoint;
                            handleJointSelect(joint);
                        }
                    }}
                />
            </div>
        )}
      </div>
    </div>
  );
}

export default App;