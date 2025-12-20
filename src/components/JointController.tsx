import React from 'react';
import { URDFRobot, URDFJoint } from 'urdf-loader';

interface JointControllerProps {
  robot: URDFRobot;
  jointValues: Record<string, number>;
  onJointChange: (name: string, value: number) => void;
}

const JointController: React.FC<JointControllerProps> = ({ robot, jointValues, onJointChange }) => {
  const movableJoints = Object.values(robot.joints).filter(
    (joint) => joint.jointType !== 'fixed'
  );

  const handleSliderChange = (jointName: string, value: number) => {
    onJointChange(jointName, value);
  };

  const handleReset = () => {
    movableJoints.forEach(joint => {
        onJointChange(joint.name, 0);
    });
  };

  if (movableJoints.length === 0) {
    return <div>No movable joints found.</div>;
  }

  return (
    <div className="controls-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Joint Controls</h3>
        <button onClick={handleReset} style={{ padding: '5px 10px', cursor: 'pointer' }}>Reset</button>
      </div>
      {movableJoints.map((joint: URDFJoint) => {
        const currentValue = jointValues[joint.name] ?? 0;
        const limit = joint.limit || { lower: 0, upper: 0 };
        let label = '';
        let min = 0;
        let max = 0;
        let step = 0.01;

        switch (joint.jointType) {
          case 'revolute':
            label = `${joint.name} (${(currentValue * 180 / Math.PI).toFixed(1)}°)`;
            min = limit.lower;
            max = limit.upper;
            step = (max - min) / 200;
            break;
          case 'continuous':
            label = `${joint.name} (${(currentValue * 180 / Math.PI).toFixed(1)}°)`;
            min = -Math.PI;
            max = Math.PI;
            step = (max - min) / 200;
            break;
          case 'prismatic':
            label = `${joint.name} (${currentValue.toFixed(3)} m)`;
            min = limit.lower;
            max = limit.upper;
            step = (max - min) / 200;
            break;
          default:
            return null; // Don't render sliders for 'fixed', 'floating', etc.
        }

        return (
          <div key={joint.name} style={{ marginBottom: '1rem' }}>
            <label htmlFor={joint.name}>
              {label}
            </label>
            <input
              type="range"
              id={joint.name}
              name={joint.name}
              min={min}
              max={max}
              step={step}
              value={currentValue}
              onChange={(e) => handleSliderChange(joint.name, parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default JointController;