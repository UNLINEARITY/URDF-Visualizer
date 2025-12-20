import React, { useState, useCallback, useEffect } from 'react';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import * as THREE from 'three';
import Viewer from './components/Viewer';
import JointController from './components/JointController';
import DisplayOptions from './components/DisplayOptions';
import InfoPopup from './components/InfoPopup';

interface SelectionInfo {
  name: string | null;
  matrix: THREE.Matrix4 | null;
  visible: boolean;
  position: { x: number; y: number; };
}

function App() {
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [urdfContent, setUrdfContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Display options state
  const [showWorldAxes, setShowWorldAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLinkAxes, setShowLinkAxes] = useState(false);
  const [showJointAxes, setShowJointAxes] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  
  const [sampleFiles, setSampleFiles] = useState<string[]>([]);
  
  // -- State for the selection, popup, and position memory --
  const [selection, setSelection] = useState<SelectionInfo>({
    name: null,
    matrix: null,
    visible: false,
    position: { x: 0, y: 0 },
  });
  const [preferredPosition, setPreferredPosition] = useState<{x: number, y: number} | null>(null);

  // Updates the popup's matrix in real-time, without changing its position
  const handleRealtimeUpdate = useCallback((matrix: THREE.Matrix4) => {
    setSelection(prev => ({ ...prev, matrix }));
  }, []);
  
  // Handles the initial selection event
  const handleSelectionUpdate = useCallback((name: string | null, matrix: THREE.Matrix4 | null) => {
    if (!name) {
        // If nothing is selected, hide the popup
        setSelection(prev => ({...prev, visible: false, name: null, matrix: null}));
        return;
    }
    
    // Show the popup at the preferred position, or centered if no preference exists
    const position = preferredPosition || {
        x: window.innerWidth / 2 - 150, // center it (150 is approx half popup width)
        y: window.innerHeight / 2 - 200, // center it
    };

    setSelection({
      name: name,
      matrix: matrix,
      visible: true,
      position: position,
    });
  }, [preferredPosition]);

  // Handles dragging the popup
  const handlePopupDrag = (x: number, y: number) => {
    const newPos = { x, y };
    setSelection(prev => ({ ...prev, position: newPos }));
    setPreferredPosition(newPos);
  };

  const closePopup = () => {
    setSelection(prev => ({ ...prev, visible: false, name: null, matrix: null }));
  };


  // Effect to fetch the list of sample files from the backend
  useEffect(() => {
    fetch('/api/samples')
      .then(res => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then(files => {
        setSampleFiles(files);
      })
      .catch(err => {
        console.error("Failed to fetch sample files:", err);
      });
  }, []);

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
    closePopup(); // Close popup when loading new model

    // Defer the parsing to allow the UI to update
    setTimeout(() => {
      const manager = new THREE.LoadingManager();
      const loader = new URDFLoader(manager);
      loader.loadCollision = false;

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
        case 'l': setShowLinkAxes(v => !v); break;
        case 'j': setShowJointAxes(v => !v); break;
        case 'f': setWireframe(v => !v); break;
        case 'escape': closePopup(); break;
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

  const handleSampleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const filename = event.target.value;
    if (!filename) {
      setUrdfContent(null);
      return;
    };

    setLoading(true);
    fetch(filename)
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
        console.error(`Failed to fetch ${filename}:`, err);
        setError(`Failed to fetch ${filename}.`);
        setLoading(false);
      });
  }, []);


  return (
    <div className="app-container">
      <div className="ui-container">
        <h2>URDF Visualizer</h2>
        <p>Load a sample or upload a file.</p>
        <select onChange={handleSampleChange} defaultValue="" className="file-input">
            <option value="">-- Select a Sample --</option>
            {sampleFiles.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input type="file" accept=".urdf" onChange={handleFileChange} className="file-input" />
        <hr />
        <DisplayOptions
            showWorldAxes={showWorldAxes} setShowWorldAxes={setShowWorldAxes}
            showGrid={showGrid} setShowGrid={setShowGrid}
            showLinkAxes={showLinkAxes} setShowLinkAxes={setShowLinkAxes}
            showJointAxes={showJointAxes} setShowJointAxes={setShowJointAxes}
            wireframe={wireframe} setWireframe={setWireframe}
        />
        <hr />
        {robot && <JointController robot={robot} />}
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>
      <div className="viewer-container">
        {loading && <div className="loading-indicator">Loading...</div>}
        {selection.visible && (
            <InfoPopup
                name={selection.name}
                matrix={selection.matrix}
                top={selection.position.y}
                left={selection.position.x}
                onClose={closePopup}
                onPositionChange={handlePopupDrag}
            />
        )}
        <Viewer
          robot={robot}
          showWorldAxes={showWorldAxes}
          showGrid={showGrid}
          showLinkAxes={showLinkAxes}
          showJointAxes={showJointAxes}
          wireframe={wireframe}
          onSelectionUpdate={handleSelectionUpdate}
          onMatrixUpdate={handleRealtimeUpdate}
        />
      </div>
    </div>
  );
}

export default App;