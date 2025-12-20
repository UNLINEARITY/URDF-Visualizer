import React, { useState, useCallback, useEffect } from 'react';
import URDFLoader, { URDFRobot, URDFJoint } from 'urdf-loader';
import { XacroParser } from 'xacro-parser';
import * as THREE from 'three';
import Viewer from './components/Viewer';
import JointController from './components/JointController';
import DisplayOptions from './components/DisplayOptions';
import InfoPopup from './components/InfoPopup';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Display options state
  const [showWorldAxes, setShowWorldAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLinkAxes, setShowLinkAxes] = useState(false);
  const [showJointAxes, setShowJointAxes] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [sampleFiles, setSampleFiles] = useState<string[]>([]);
  
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
  const handleSelectionUpdate = useCallback((name: string | null, matrix: THREE.Matrix4 | null, parentMatrix: THREE.Matrix4 | null) => {
      if (!name) {
          setLinkSelection(prev => ({...prev, visible: false, name: null, matrix: null, parentMatrix: null}));
          return;
      }
      // If we are just updating the matrix of the SAME link, preserve position
      // If it's a NEW link, use lastLinkPosRef or default.
      // Actually, since this is called every frame, we should just trust lastLinkPosRef 
      // or the current state position if we wanted to be super precise, but ref is fine.
      const position = lastLinkPosRef.current || {
          x: window.innerWidth / 2 - 320, 
          y: window.innerHeight / 2 - 200,
      };
      
      setLinkSelection(prev => {
          // Optimization: check if matrix actually changed significantly? 
          // React state update is cheap if reference is same, but here we clone matrix every frame.
          // It's okay for now.
          return {
            name: name,
            matrix: matrix,
            parentMatrix: parentMatrix,
            visible: true,
            position: prev.visible ? prev.position : position, // Keep current pos if visible (dragging), else jump to default/mem
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

  const closeLinkPopup = () => setLinkSelection(prev => ({ ...prev, visible: false }));
  const closeJointPopup = () => setJointSelection(prev => ({ ...prev, visible: false }));


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
    // Close popups when loading new model
    setLinkSelection(prev => ({ ...prev, visible: false }));
    setJointSelection(prev => ({ ...prev, visible: false }));

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
        case 'escape': 
            closeLinkPopup(); 
            closeJointPopup();
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

  const processAndSetContent = async (filename: string, content: string) => {
    if (filename.toLowerCase().endsWith('.xacro')) {
      setLoading(true);
      try {
        const parser = new XacroParser();
        parser.rospackCommands = {
           find: (pkg) => `/api/assets/${pkg}`
        };
        const xml = await parser.parse(content);
        const serializer = new XMLSerializer();
        const urdfString = serializer.serializeToString(xml);
        setUrdfContent(urdfString);
      } catch (err) {
        console.error("Xacro parsing error:", err);
        setError(`Failed to parse Xacro file: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    } else {
      setUrdfContent(content);
    }
  };

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        processAndSetContent(file.name, content);
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
        processAndSetContent(filename, content);
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
        <input type="file" accept=".urdf,.xacro" onChange={handleFileChange} className="file-input" />
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
        
        {/* Link Info Popup */}
        {linkSelection.visible && (
            <InfoPopup
                name={linkSelection.name}
                matrix={linkSelection.matrix}
                parentMatrix={linkSelection.parentMatrix}
                top={linkSelection.position.y}
                left={linkSelection.position.x}
                onClose={closeLinkPopup}
                onPositionChange={handleLinkPopupDrag}
            />
        )}

        {/* Joint Control Popup */}
        {jointSelection.visible && jointSelection.joint && (
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
          selectedLinkName={linkSelection.visible ? linkSelection.name : null}
          selectedJoint={jointSelection.visible ? jointSelection.joint : null}
          showWorldAxes={showWorldAxes}
          showGrid={showGrid}
          showLinkAxes={showLinkAxes}
          showJointAxes={showJointAxes}
          wireframe={wireframe}
          onSelectionUpdate={handleSelectionUpdate}
          onJointSelect={handleJointSelect}
          onMatrixUpdate={() => {}} // No-op, driven by onSelectionUpdate now
        />
      </div>
    </div>
  );
}

export default App;