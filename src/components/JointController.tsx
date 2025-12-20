import React, { useState, useEffect } from 'react';
import { URDFRobot, URDFJoint } from 'urdf-loader';

interface JointControllerProps {
  robot: URDFRobot;
}

const JointController: React.FC<JointControllerProps> = ({ robot }) => {
  // Find only the movable joints (revolute, continuous, prismatic)
  const movableJoints = Object.values(robot.joints).filter(
    (joint) => joint.jointType !== 'fixed'
  );

  const [jointAngles, setJointAngles] = useState<Record<string, number>>(() => {
    const initialState: Record<string, number> = {};
    movableJoints.forEach((joint) => {
      initialState[joint.name] = robot.getJointValue(joint.name);
    });
    return initialState;
  });

  const handleSliderChange = (jointName: string, value: number) => {
    robot.setJointValue(jointName, value);
    setJointAngles((prev) => ({ ...prev, [jointName]: value }));
  };

  useEffect(() => {
    // Reset angles when robot changes
    const initialState: Record<string, number> = {};
    movableJoints.forEach((joint) => {
      initialState[joint.name] = robot.getJointValue(joint.name);
    });
    setJointAngles(initialState);
  }, [robot]);

  if (movableJoints.length === 0) {
    return <div>No movable joints found.</div>;
  }

  return (
    <div className="controls-container">
      <h3>Joint Controls</h3>
      {movableJoints.map((joint: URDFJoint) => {
        const angle = jointAngles[joint.name] ?? 0;
        const limit = joint.limit || { lower: -Math.PI, upper: Math.PI };
        
        // For continuous joints, the limit is not defined, so we provide a reasonable default range.
        const min = joint.jointType === 'continuous' ? -Math.PI : limit.lower || -Math.PI;
        const max = joint.jointType === 'continuous' ? Math.PI : limit.upper || Math.PI;

        return (
          <div key={joint.name} style={{ marginBottom: '1rem' }}>
            <label htmlFor={joint.name}>
              {joint.name} ({(angle * 180 / Math.PI).toFixed(1)}°)
            </label>
            <input
              type="range"
              id={joint.name}
              name={joint.name}
              min={min}
              max={max}
              step="0.01"
              value={angle}
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
