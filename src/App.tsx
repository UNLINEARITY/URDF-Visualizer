import React, { useState, useCallback } from 'react';
import URDFLoader, { URDFRobot } from 'urdf-loader';
import * as THREE from 'three';
import Viewer from './components/Viewer';
import JointController from './components/JointController';

function App() {
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLoading(true);
      setError(null);
      setRobot(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const urdfContent = e.target?.result as string;
        
        const manager = new THREE.LoadingManager();
        const loader = new URDFLoader(manager);

        // This is a workaround to handle relative paths for meshes
        // We'll use the file's name to create a fake base path
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
          console.log("URDF parsed successfully.");
          // If the manager has nothing to load, onLoad won't be called, so we check here.
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
  
    // Special handling for loading from the public directory
  const loadSample = useCallback(() => {
    setLoading(true);
    setError(null);
    setRobot(null);

    const loader = new URDFLoader(new THREE.LoadingManager());
    loader.load(
      'sample.urdf', // URL to the sample file in the public directory
      (loadedRobot) => {
        console.log("Sample robot loaded successfully", loadedRobot);
        setRobot(loadedRobot);
        setLoading(false);
      },
      undefined, // onProgress callback
      (err) => {
        console.error('Error loading sample robot:', err);
        setError('Failed to load the sample URDF. Check console for details.');
        setLoading(false);
      }
    );
  }, []);


  return (
    <div className="app-container">
      <div className="ui-container">
        <h2>URDF Visualizer</h2>
        <p>Load a URDF file to begin.</p>
        <input type="file" accept=".urdf" onChange={handleFileChange} className="file-input" />
        <button onClick={loadSample}>Load Sample Robot</button>
        <hr />
        {robot && <JointController robot={robot} />}
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>
      <div className="viewer-container">
        {loading && <div className="loading-indicator">Loading...</div>}
        <Viewer robot={robot} />
      </div>
    </div>
  );
}

export default App;
