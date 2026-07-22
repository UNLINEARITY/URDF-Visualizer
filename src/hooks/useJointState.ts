import { useCallback, useEffect, useState } from 'react';
import type { URDFRobot } from 'urdf-loader';

export interface UseJointStateResult {
  jointValues: Record<string, number>;
  setJointValue: (name: string, value: number) => void;
  resetJoints: () => void;
}

/**
 * Manages joint angle state, synced with the loaded robot.
 * Setting a value both writes to the three.js robot and updates React state.
 */
export function useJointState(robot: URDFRobot | null): UseJointStateResult {
  const [jointValues, setJointValues] = useState<Record<string, number>>({});

  // Initialize joint values whenever a new robot loads
  useEffect(() => {
    if (!robot) {
      setJointValues({});
      return;
    }
    const initialValues: Record<string, number> = {};
    Object.values(robot.joints).forEach((j) => {
      if (j.jointType !== 'fixed') {
        initialValues[j.name] = (j.angle as number) || 0;
      }
    });
    setJointValues(initialValues);
  }, [robot]);

  const setJointValue = useCallback(
    (name: string, value: number) => {
      if (!robot) return;
      robot.setJointValue(name, value);
      setJointValues((prev) => ({ ...prev, [name]: value }));
    },
    [robot],
  );

  const resetJoints = useCallback(() => {
    if (!robot) return;
    const reset: Record<string, number> = {};
    Object.values(robot.joints).forEach((j) => {
      if (j.jointType !== 'fixed') {
        robot.setJointValue(j.name, 0);
        reset[j.name] = 0;
      }
    });
    setJointValues((prev) => ({ ...prev, ...reset }));
  }, [robot]);

  return { jointValues, setJointValue, resetJoints };
}
