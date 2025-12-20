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
    </div>
  );
};

export default DisplayOptions;
