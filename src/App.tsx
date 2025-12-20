import React, { useState, useCallback, useEffect } from 'react';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import * as THREE from 'three';
import Viewer from './components/Viewer';
import JointController from './components/JointController';
import DisplayOptions from './components/DisplayOptions';

function App() {
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Display options state
  const [showWorldAxes, setShowWorldAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLinkAxes, setShowLinkAxes] = useState(false);
  const [showJointAxes, setShowJointAxes] = useState(false);
  const [showCollision, setShowCollision] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [hasCollision, setHasCollision] = useState(false);

  // Keyboard shortcuts effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return; // Ignore when typing in inputs
      switch (e.key.toLowerCase()) {
        case 'w': setShowWorldAxes(v => !v); break;
        case 'g': setShowGrid(v => !v); break;
        case 'l': setShowLinkAxes(v => !v); break;
        case 'j': setShowJointAxes(v => !v); break;
        case 'c': if (hasCollision) setShowCollision(v => !v); break;
        case 'f': setWireframe(v => !v); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasCollision]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLoading(true);
      setError(null);
      setRobot(null);
      setHasCollision(false);

      const reader = new FileReader();
      reader.onload = (e) => {
        const urdfContent = e.target?.result as string;
        
        const manager = new THREE.LoadingManager();
        const loader = new URDFLoader(manager);
        loader.loadCollision = true; // Enable loading collision geometry

        const workingPath = THREE.LoaderUtils.extractUrlBase(file.name);
        loader.workingPath = workingPath;

        manager.onLoad = () => {
          console.log('All resources loaded successfully.');
          setLoading(false);
        };

        manager.onError = (url) => {
          console.error(`Error loading resource: ${url}`);
          setError(`Failed to load a resource: ${url}. If loading a model with meshes, ensure all resource files (e.g., .stl, .dae) are in the same folder as the URDF file.`);
          setLoading(false);
        };

        try {
          const loadedRobot = loader.parse(urdfContent);
          setRobot(loadedRobot);
          setHasCollision(!!loadedRobot.collision);
          console.log("URDF parsed successfully.");
          if (!manager.isLoading) {
            setLoading(false);
          }
        } catch (err) {
          console.error('Error parsing URDF:', err);
          setError('Failed to parse URDF file. Check content for errors.');
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file.');
        setLoading(false);
      };
      reader.readAsText(file);
    }
  }, []);
  
  const loadSample = useCallback(() => {
    setLoading(true);
    setError(null);
    setRobot(null);
    setHasCollision(false);

    const manager = new THREE.LoadingManager();
    const loader = new URDFLoader(manager);
    loader.loadCollision = true; // Enable loading collision geometry

    manager.onLoad = () => setLoading(false);
    manager.onError = (url) => {
        console.error('Error loading sample robot resource:', url);
        setError('Failed to load a resource for the sample URDF.');
        setLoading(false);
    };

    loader.load(
      'sample.urdf',
      (loadedRobot) => {
        console.log("Sample robot loaded successfully", loadedRobot);
        setRobot(loadedRobot);
        setHasCollision(!!loadedRobot.collision);
        if(!manager.isLoading) {
            setLoading(false);
        }
      },
      undefined,
      () => {
        setError('Failed to load the sample URDF. Check console for details.');
        setLoading(false);
      }
    );
  }, []);


  return (
    <div className="app-container">
      <div className="ui-container">
        <h2>URDF Visualizer</h2>
        <p>Load a URDF file or the provided sample.</p>
        <input type="file" accept=".urdf" onChange={handleFileChange} className="file-input" />
        <button onClick={loadSample}>Load Sample Robot</button>
        <hr />
        <DisplayOptions
            showWorldAxes={showWorldAxes} setShowWorldAxes={setShowWorldAxes}
            showGrid={showGrid} setShowGrid={setShowGrid}
            showLinkAxes={showLinkAxes} setShowLinkAxes={setShowLinkAxes}
            showJointAxes={showJointAxes} setShowJointAxes={setShowJointAxes}
            showCollision={showCollision} setShowCollision={setShowCollision}
            wireframe={wireframe} setWireframe={setWireframe}
            hasCollision={hasCollision}
        />
        <hr />
        {robot && <JointController robot={robot} />}
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>
      <div className="viewer-container">
        {loading && <div className="loading-indicator">Loading...</div>}
        <Viewer
          robot={robot}
          showWorldAxes={showWorldAxes}
          showGrid={showGrid}
          showLinkAxes={showLinkAxes}
          showJointAxes={showJointAxes}
          showCollision={showCollision}
          wireframe={wireframe}
        />
      </div>
    </div>
  );
}

export default App;
