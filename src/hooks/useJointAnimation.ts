import { useCallback, useEffect, useRef, useState } from 'react';
import type { URDFJoint, URDFRobot } from 'urdf-loader';

interface AnimatedJoint {
  name: string;
  mid: number;
  amp: number;
  freq: number;
  phase: number;
}

/** Resolve the motion range [lo, hi] for a joint, with sane fallbacks. */
function getJointRange(joint: URDFJoint): { lo: number; hi: number } {
  if (joint.jointType === 'continuous') return { lo: -Math.PI, hi: Math.PI };

  const lo = Number(joint.limit?.lower);
  const hi = Number(joint.limit?.upper);
  if (!isNaN(lo) && !isNaN(hi) && hi > lo) return { lo, hi };

  // No usable limit — pick a reasonable default so the joint still moves.
  if (joint.jointType === 'prismatic') return { lo: -0.5, hi: 0.5 };
  return { lo: -Math.PI / 2, hi: Math.PI / 2 };
}

export interface UseJointAnimationResult {
  isAnimating: boolean;
  toggleAnimation: () => void;
}

/**
 * Auto-demo animation: drives every movable joint through a sine sweep within
 * its limits. Each joint gets a distinct frequency/phase so the motion looks
 * alive instead of mechanically synced. Values are written through the shared
 * `setJointValue` so the 3D model and the slider UI stay in sync.
 */
export function useJointAnimation(
  robot: URDFRobot | null,
  setJointValue: (name: string, value: number) => void,
): UseJointAnimationResult {
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);
  // Accumulated "playhead" time (seconds) so pause/resume continues from the
  // same pose instead of restarting the motion from zero.
  const elapsedRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  const toggleAnimation = useCallback(() => {
    setIsAnimating((v) => !v);
  }, []);

  // Halt the demo whenever the robot unloads, and reset the playhead for a new model.
  useEffect(() => {
    if (!robot) setIsAnimating(false);
    elapsedRef.current = 0;
    lastTsRef.current = null;
  }, [robot]);

  useEffect(() => {
    if (!isAnimating || !robot) return;

    const joints: AnimatedJoint[] = Object.values(robot.joints)
      .filter(
        (j) =>
          j.jointType === 'revolute' ||
          j.jointType === 'continuous' ||
          j.jointType === 'prismatic',
      )
      .map((j, i) => {
        const { lo, hi } = getJointRange(j);
        return {
          name: j.name,
          mid: (lo + hi) / 2,
          amp: (hi - lo) / 2,
          // Spread frequencies & phases across joints for organic motion.
          freq: 0.25 + (i % 4) * 0.12,
          phase: (i * 0.9) % (Math.PI * 2),
        };
      });

    if (joints.length === 0) return;

    // Reset the frame timestamp so the first tick after (re)start contributes
    // zero delta — this is what lets pause/resume continue seamlessly instead
    // of adding the paused interval as motion.
    lastTsRef.current = null;
    const tick = () => {
      const now = performance.now();
      if (lastTsRef.current !== null) {
        elapsedRef.current += (now - lastTsRef.current) / 1000;
      }
      lastTsRef.current = now;

      const t = elapsedRef.current;
      for (const j of joints) {
        const value = j.mid + j.amp * Math.sin(2 * Math.PI * j.freq * t + j.phase);
        setJointValue(j.name, value);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isAnimating, robot, setJointValue]);

  return { isAnimating, toggleAnimation };
}
