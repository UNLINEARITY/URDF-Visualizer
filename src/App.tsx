import React, { useState, useCallback, useEffect } from 'react';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import * as THREE from 'three';
import Viewer from './components/Viewer';
import JointController from './components/JointController';
import DisplayOptions from './components/DisplayOptions';

function App() {
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [urdfContent, setUrdfContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Display options state
  const [showWorldAxes, setShowWorldAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [wireframe, setWireframe] = useState(false);

  // Effect to parse the robot model whenever the content changes
  useEffect(() => {
    if (!urdfContent) return;

    setLoading(true);
    setError(null);
    setRobot(null);

    // Defer the parsing to allow the UI to update
    setTimeout(() => {
      const manager = new THREE.LoadingManager();
      const loader = new URDFLoader(manager);
      loader.loadCollision = false; // Reverted

      manager.onLoad = () => setLoading(false);
      manager.onError = (url) => {
        setError(`Failed to load resource: ${url}`);
        setLoading(false);
      };

      try {
        const loadedRobot = loader.parse(urdfContent);
        setRobot(loadedRobot);
      } catch (err) {
        console.error('Error parsing URDF:', err);
        setError('Failed to parse URDF file. Check content for errors.');
        setLoading(false);
      }

      if (!manager.isLoading) {
        setLoading(false);
      }
    }, 10);

  }, [urdfContent]);


  // Keyboard shortcuts effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case 'w': setShowWorldAxes(v => !v); break;
        case 'g': setShowGrid(v => !v); break;
        case 'f': setWireframe(v => !v); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setUrdfContent(content);
      };
      reader.onerror = () => {
        setError('Failed to read file.');
      };
      reader.readAsText(file);
    }
  }, []);

  const loadSample = useCallback(() => {
    setLoading(true);
    fetch('sample.urdf')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.text();
      })
      .then(content => {
        setUrdfContent(content);
      })
      .catch(err => {
        console.error('Failed to fetch sample.urdf:', err);
        setError('Failed to fetch sample.urdf.');
        setLoading(false);
      });
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
            wireframe={wireframe} setWireframe={setWireframe}
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
          wireframe={wireframe}
        />
      </div>
    </div>
  );
}

export default App;
