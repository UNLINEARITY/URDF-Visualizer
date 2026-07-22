import type { Object3D } from 'three';
import type { URDFJoint, URDFLink } from 'urdf-loader';

/**
 * Type guards for urdf-loader objects.
 * urdf-loader sets boolean flags (isURDFLink / isURDFJoint) at runtime
 * but does not export them on the TypeScript declarations.
 */

interface URDFTypeFlags {
  isURDFLink?: boolean;
  isURDFJoint?: boolean;
  isURDFRobot?: boolean;
}

export function isURDFLink(obj: Object3D | null | undefined): obj is URDFLink {
  return !!obj && (obj as Object3D & URDFTypeFlags).isURDFLink === true;
}

export function isURDFJoint(obj: Object3D | null | undefined): obj is URDFJoint {
  return !!obj && (obj as Object3D & URDFTypeFlags).isURDFJoint === true;
}

/** Walk up the parent chain to find the nearest URDF link. */
export function findParentLink(obj: Object3D | null): URDFLink | null {
  let current: Object3D | null = obj;
  while (current) {
    if (isURDFLink(current)) return current;
    current = current.parent;
  }
  return null;
}

/** Walk up the parent chain to find the nearest URDF joint. */
export function findParentJoint(obj: Object3D | null): URDFJoint | null {
  let current: Object3D | null = obj;
  while (current) {
    if (isURDFJoint(current)) return current;
    current = current.parent;
  }
  return null;
}

/** True when an object is one of our visualization helper meshes/helpers. */
export function isHelperObject(obj: Object3D): boolean {
  const name = obj.name;
  return (
    name === 'joint-helper' ||
    name === 'axes-helper-link' ||
    name === 'axes-helper-joint' ||
    name === 'shadow-plane' ||
    name === 'measurement-group' ||
    name.includes('helper') ||
    name.includes('axes')
  );
}
