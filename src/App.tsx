import React, { useCallback, useRef, useState } from 'react';
import type { URDFJoint } from 'urdf-loader';
import * as THREE from 'three';
import Viewer from './components/Viewer';
import JointController from './components/JointController';
import DisplayOptions from './components/DisplayOptions';
import InfoPopup from './components/InfoPopup';
import StructureTree from './components/StructureTree';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useRobotLoader } from './hooks/useRobotLoader';
import { useJointState } from './hooks/useJointState';
import { useJointAnimation } from './hooks/useJointAnimation';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { isURDFJoint, isURDFLink } from './utils/urdfTypes';

interface LinkSelection {
  name: string | null;
  matrix: THREE.Matrix4 | null;
  parentMatrix: THREE.Matrix4 | null;
  visible: boolean;
  position: { x: number; y: number };
}

interface JointSelection {
  joint: URDFJoint | null;
  visible: boolean;
  position: { x: number; y: number };
}

const DEFAULT_POPUP_POS = { x: 0, y: 0 };

function App() {
  const {
    robot,
    loading,
    error,
    currentFilePath,
    sampleFiles,
    isDragActive,
    loadSingleFile,
    loadFolderFileList,
    loadSample,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useRobotLoader();

  const { jointValues, setJointValue, resetJoints } = useJointState(robot);
  const { isAnimating, toggleAnimation } = useJointAnimation(robot, setJointValue);

  // Display options state
  const [showWorldAxes, setShowWorldAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLinkAxes, setShowLinkAxes] = useState(false);
  const [showJointAxes, setShowJointAxes] = useState(false);
  const [showShadows, setShowShadows] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [showStructureTree, setShowStructureTree] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Measurement state
  const [isMeasurementMode, setIsMeasurementMode] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<THREE.Vector3[]>([]);

  // Selection states
  const [linkSelection, setLinkSelection] = useState<LinkSelection>({
    name: null,
    matrix: null,
    parentMatrix: null,
    visible: false,
    position: DEFAULT_POPUP_POS,
  });
  const [jointSelection, setJointSelection] = useState<JointSelection>({
    joint: null,
    visible: false,
    position: DEFAULT_POPUP_POS,
  });

  const lastLinkPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastJointPosRef = useRef<{ x: number; y: number } | null>(null);

  const closeLinkPopup = useCallback(
    () => setLinkSelection((prev) => ({ ...prev, visible: false, name: null })),
    [],
  );
  const closeJointPopup = useCallback(
    () => setJointSelection((prev) => ({ ...prev, visible: false, joint: null })),
    [],
  );

  const toggleMeasurement = useCallback(() => {
    setIsMeasurementMode((v) => !v);
    setMeasurementPoints([]);
  }, []);

  const { isCtrlPressed } = useKeyboardShortcuts({
    onToggleWorldAxes: () => setShowWorldAxes((v) => !v),
    onToggleGrid: () => setShowGrid((v) => !v),
    onToggleLinkAxes: () => setShowLinkAxes((v) => !v),
    onToggleJointAxes: () => setShowJointAxes((v) => !v),
    onToggleWireframe: () => setWireframe((v) => !v),
    onToggleStructureTree: () => setShowStructureTree((v) => !v),
    onToggleMeasurement: toggleMeasurement,
    onToggleAnimation: toggleAnimation,
    onEscape: () => {
      closeLinkPopup();
      closeJointPopup();
      setShowStructureTree(false);
    },
  });

  // Handles Link Selection & Updates (called by Viewer on click AND in the animate loop)
  const handleSelectionUpdate = useCallback(
    (
      name: string | null,
      matrix: THREE.Matrix4 | null,
      parentMatrix: THREE.Matrix4 | null,
      visible = true,
    ) => {
      if (!name) {
        setLinkSelection((prev) => ({
          ...prev,
          visible: false,
          name: null,
          matrix: null,
          parentMatrix: null,
        }));
        return;
      }
      const fallbackPosition = lastLinkPosRef.current || {
        x: window.innerWidth / 2 - 320,
        y: window.innerHeight / 2 - 200,
      };

      setLinkSelection((prev) => ({
        name,
        matrix,
        parentMatrix,
        visible,
        position: prev.visible ? prev.position : fallbackPosition,
      }));
    },
    [],
  );

  // Handles Joint Selection (Ctrl + Right-Click)
  const handleJointSelect = useCallback((joint: URDFJoint) => {
    const position = lastJointPosRef.current || {
      x: window.innerWidth / 2 + 20,
      y: window.innerHeight / 2 - 200,
    };
    setJointSelection({ joint, visible: true, position });
  }, []);

  // Popup drag handlers
  const handleLinkPopupDrag = useCallback((x: number, y: number) => {
    const pos = { x, y };
    setLinkSelection((prev) => ({ ...prev, position: pos }));
    lastLinkPosRef.current = pos;
  }, []);

  const handleJointPopupDrag = useCallback((x: number, y: number) => {
    const pos = { x, y };
    setJointSelection((prev) => ({ ...prev, position: pos }));
    lastJointPosRef.current = pos;
  }, []);

  const handleMeasurementClick = useCallback((point: THREE.Vector3) => {
    setMeasurementPoints((prev) => {
      if (prev.length > 0) {
        const lastPoint = prev[prev.length - 1];
        if (lastPoint.distanceTo(point) < 0.001) return prev; // duplicate click
      }
      return [...prev, point];
    });
  }, []);

  const handleMeasurementRemove = useCallback((index: number) => {
    setMeasurementPoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) loadSingleFile(file);
      event.target.value = '';
    },
    [loadSingleFile],
  );

  const handleFolderInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) loadFolderFileList(event.target.files);
      event.target.value = '';
    },
    [loadFolderFileList],
  );

  const handleSampleSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      loadSample(event.target.value);
    },
    [loadSample],
  );

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

      {/* Sidebar Toggle Button */}
      <button
        className={`sidebar-toggle ${sidebarCollapsed ? 'collapsed' : ''}`}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {sidebarCollapsed ? '▶' : '◀'}
      </button>

      <div className={`ui-container ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="ui-content">
          <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 0.5rem 0' }}>URDF Visualizer</h2>
            <a
              href="https://github.com/UNLINEARITY/URDF-Visualizer"
              target="_blank"
              rel="noopener noreferrer"
              title="View on GitHub"
              style={{ textDecoration: 'none', display: 'inline-block' }}
            >
              <img
                src="https://img.shields.io/github/stars/UNLINEARITY/URDF-Visualizer?style=social"
                alt="GitHub stars"
                style={{ height: '30px' }}
              />
            </a>
          </div>
          <p>Load a sample or drag & drop a folder.</p>
          <select
            onChange={handleSampleSelectChange}
            value={sampleFiles.includes(currentFilePath) ? currentFilePath : ''}
            className="file-input"
          >
            <option value="">-- Select a Sample --</option>
            {sampleFiles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <label htmlFor="file-upload" className="custom-file-upload btn-file">
            <i>📄</i> Select URDF/Xacro File
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".urdf,.xacro"
            onChange={handleFileInputChange}
            className="file-input-hidden"
          />

          <label htmlFor="folder-upload" className="custom-file-upload btn-folder">
            <i>📁</i> Select Project Folder
          </label>
          <input
            id="folder-upload"
            type="file"
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            onChange={handleFolderInputChange}
            className="file-input-hidden"
          />
          <hr />
          <DisplayOptions
            showWorldAxes={showWorldAxes}
            setShowWorldAxes={setShowWorldAxes}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            showLinkAxes={showLinkAxes}
            setShowLinkAxes={setShowLinkAxes}
            showJointAxes={showJointAxes}
            setShowJointAxes={setShowJointAxes}
            wireframe={wireframe}
            setWireframe={setWireframe}
          />
          <hr />
          {robot && (
            <JointController
              robot={robot}
              jointValues={jointValues}
              onJointChange={setJointValue}
              onReset={resetJoints}
            />
          )}
          {error && <div style={{ color: 'red' }}>{error}</div>}
        </div>
      </div>

      <div className="viewer-container">
        {loading && <div className="loading-indicator">Loading...</div>}

        {/* Link Info Popup - Hidden when Tree is open */}
        {linkSelection.visible && !showStructureTree && (
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

        {/* Joint Control Popup - Hidden when Tree is open */}
        {jointSelection.visible && jointSelection.joint && !showStructureTree && (
          <InfoPopup
            name={jointSelection.joint.name}
            matrix={null}
            joint={jointSelection.joint}
            value={jointValues[jointSelection.joint.name]}
            onJointChange={(val) => setJointValue(jointSelection.joint!.name, val)}
            top={jointSelection.position.y}
            left={jointSelection.position.x}
            onClose={closeJointPopup}
            onPositionChange={handleJointPopupDrag}
          />
        )}

        <ErrorBoundary>
          <Viewer
            robot={robot}
            isCtrlPressed={isCtrlPressed}
            selectedLinkName={linkSelection.name}
            selectedJoint={jointSelection.visible ? jointSelection.joint : null}
            linkPopupVisible={linkSelection.visible}
            showWorldAxes={showWorldAxes}
            showGrid={showGrid}
            showLinkAxes={showLinkAxes}
            showJointAxes={showJointAxes}
            showShadows={showShadows}
            wireframe={wireframe}
            onSelectionUpdate={handleSelectionUpdate}
            onJointSelect={handleJointSelect}
            onJointChange={setJointValue}
            isMeasurementMode={isMeasurementMode}
            measurementPoints={measurementPoints}
            onMeasurementClick={handleMeasurementClick}
            onMeasurementRemove={handleMeasurementRemove}
          />
        </ErrorBoundary>

        {/* Floating Toggle Buttons */}
        {robot && (
          <>
            <button
              className="structure-tree-toggle"
              style={{
                right: '11.5rem',
                backgroundColor: isAnimating ? '#4caf50' : '#444',
                color: isAnimating ? '#fff' : '#aaa',
                borderColor: isAnimating ? '#fff' : '#666',
              }}
              onClick={toggleAnimation}
              title="Animate Joints (A) - 自动演示关节运动"
            >
              {isAnimating ? '⏸️' : '▶️'}
            </button>

            <button
              className="structure-tree-toggle"
              style={{
                right: '8rem',
                backgroundColor: isMeasurementMode ? '#ff5722' : '#444',
                color: isMeasurementMode ? '#fff' : '#aaa',
                borderColor: isMeasurementMode ? '#fff' : '#666',
              }}
              onClick={toggleMeasurement}
              title="Measurement Mode (R) - Click multiple points"
            >
              📏
            </button>

            <button
              className="structure-tree-toggle"
              style={{
                right: '4.5rem',
                backgroundColor: showShadows ? '#ffca28' : '#444',
                color: showShadows ? '#333' : '#aaa',
                borderColor: showShadows ? '#fff' : '#666',
              }}
              onClick={() => setShowShadows(!showShadows)}
              title="Toggle Shadows"
            >
              ☀️
            </button>

            <button
              className="structure-tree-toggle"
              onClick={() => setShowStructureTree(!showStructureTree)}
              title="Toggle Kinematic Structure Tree"
            >
              🌳
            </button>
          </>
        )}

        {/* Structure Tree Overlay - Always mounted to preserve state, toggled via CSS */}
        {robot && (
          <div
            style={{
              display: showStructureTree ? 'block' : 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 2000,
              pointerEvents: isCtrlPressed ? 'none' : 'auto',
            }}
          >
            <StructureTree
              robot={robot}
              isCtrlPressed={isCtrlPressed}
              selectedLinkName={linkSelection.name}
              selectedJointName={jointSelection.joint?.name || null}
              onClose={() => setShowStructureTree(false)}
              onSelect={(obj) => {
                if (isURDFLink(obj)) {
                  obj.updateWorldMatrix(true, false);
                  // Pass visible=false to highlight WITHOUT showing the InfoPopup
                  handleSelectionUpdate(
                    obj.name,
                    obj.matrixWorld,
                    obj.parent ? obj.parent.matrixWorld : null,
                    false,
                  );
                } else if (isURDFJoint(obj)) {
                  handleJointSelect(obj);
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
