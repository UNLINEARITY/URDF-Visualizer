import React from 'react';
import type { URDFRobot, URDFJoint } from 'urdf-loader';

interface JointControllerProps {
  robot: URDFRobot;
  jointValues: Record<string, number>;
  onJointChange: (name: string, value: number) => void;
  onReset?: () => void;
}

const JointController: React.FC<JointControllerProps> = ({
  robot,
  jointValues,
  onJointChange,
  onReset,
}) => {
  const movableJoints = Object.values(robot.joints).filter(
    (joint) => joint.jointType !== 'fixed',
  );

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      movableJoints.forEach((joint) => onJointChange(joint.name, 0));
    }
  };

  if (movableJoints.length === 0) {
    return <div>No movable joints found.</div>;
  }

  return (
    <div className="controls-container">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <h3 style={{ margin: 0 }}>Joint Controls</h3>
        <button onClick={handleReset} style={{ padding: '5px 10px', cursor: 'pointer' }}>
          Reset
        </button>
      </div>
      {movableJoints.map((joint: URDFJoint) => {
        const currentValue = jointValues[joint.name] ?? 0;
        const limit = joint.limit || { lower: 0, upper: 0 };
        let label = '';
        let min = 0;
        let max = 0;
        let step = 0.01;
        let displayValue = '';

        switch (joint.jointType) {
          case 'revolute':
            displayValue = `${((currentValue * 180) / Math.PI).toFixed(1)}°`;
            min = limit.lower;
            max = limit.upper;
            step = (max - min) / 200 || 0.01;
            break;
          case 'continuous':
            displayValue = `${((currentValue * 180) / Math.PI).toFixed(1)}°`;
            min = -Math.PI;
            max = Math.PI;
            step = (max - min) / 200;
            break;
          case 'prismatic':
            displayValue = `${currentValue.toFixed(3)} m`;
            min = limit.lower;
            max = limit.upper;
            step = (max - min) / 200 || 0.001;
            break;
          default:
            return null; // Don't render sliders for 'fixed', 'floating', etc.
        }

        label = `${joint.name} (${displayValue})`;

        return (
          <div key={joint.name} style={{ marginBottom: '1rem' }}>
            <label htmlFor={joint.name} style={{ fontSize: '0.85rem' }}>
              {label}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="range"
                id={joint.name}
                name={joint.name}
                min={min}
                max={max}
                step={step}
                value={currentValue}
                onChange={(e) => onJointChange(joint.name, parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={Number(currentValue.toFixed(4))}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) {
                    onJointChange(joint.name, Math.max(min, Math.min(max, v)));
                  }
                }}
                style={{
                  width: '70px',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  color: '#eee',
                  borderRadius: '4px',
                  padding: '2px 4px',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default JointController;
