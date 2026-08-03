import React from 'react';

interface DisplayOptionsProps {
  showWorldAxes: boolean;
  setShowWorldAxes: (v: boolean) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  showLinkAxes: boolean;
  setShowLinkAxes: (v: boolean) => void;
  showJointAxes: boolean;
  setShowJointAxes: (v: boolean) => void;
  wireframe: boolean;
  setWireframe: (v: boolean) => void;
  pointSize: number;
  setPointSize: (v: number) => void;
  pointDensity: number;
  setPointDensity: (v: number) => void;
  showPointSizeControl: boolean;
}

const DisplayOptions: React.FC<DisplayOptionsProps> = (props) => {
  const {
    showWorldAxes,
    setShowWorldAxes,
    showGrid,
    setShowGrid,
    showLinkAxes,
    setShowLinkAxes,
    showJointAxes,
    setShowJointAxes,
    wireframe,
    setWireframe,
    pointSize,
    setPointSize,
    pointDensity,
    setPointDensity,
    showPointSizeControl,
  } = props;

  return (
    <div className="display-options-container">
      <h3>Display Options</h3>
      <div className="option-item">
        <input type="checkbox" id="showWorldAxes" checked={showWorldAxes} onChange={(e) => setShowWorldAxes(e.target.checked)} />
        <label htmlFor="showWorldAxes">Show World Axes (W)</label>
      </div>
      <div className="option-item">
        <input type="checkbox" id="showGrid" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
        <label htmlFor="showGrid">Show Grid (G)</label>
      </div>
      <div className="option-item">
        <input type="checkbox" id="showLinkAxes" checked={showLinkAxes} onChange={(e) => setShowLinkAxes(e.target.checked)} />
        <label htmlFor="showLinkAxes">Show Link Frames (L)</label>
      </div>
      <div className="option-item">
        <input type="checkbox" id="showJointAxes" checked={showJointAxes} onChange={(e) => setShowJointAxes(e.target.checked)} />
        <label htmlFor="showJointAxes">Show Joint Frames (J)</label>
      </div>
       <div className="option-item">
        <input type="checkbox" id="wireframe" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />
        <label htmlFor="wireframe">Enable Wireframe (F)</label>
      </div>
      {showPointSizeControl && (
        <>
          <div className="option-item">
            <label htmlFor="pointSize">Point Size: {pointSize.toFixed(1)}x</label>
            <input
              type="range"
              id="pointSize"
              min={0.1}
              max={10}
              step={0.1}
              value={pointSize}
              onChange={(e) => setPointSize(Number(e.target.value))}
            />
          </div>
          <div className="option-item">
            <label htmlFor="pointDensity">Point Density: {Math.round(pointDensity * 100)}%</label>
            <input
              type="range"
              id="pointDensity"
              min={10}
              max={100}
              step={5}
              value={Math.round(pointDensity * 100)}
              onChange={(e) => setPointDensity(Number(e.target.value) / 100)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default DisplayOptions;
