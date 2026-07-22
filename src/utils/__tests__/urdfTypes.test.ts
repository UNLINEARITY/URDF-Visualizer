import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import {
  isURDFLink,
  isURDFJoint,
  findParentLink,
  findParentJoint,
  isHelperObject,
} from '../urdfTypes';

/** urdf-loader attaches these boolean flags at runtime; mimic that for tests. */
function flagAsURDFLink(o: Object3D): void {
  (o as unknown as { isURDFLink: boolean }).isURDFLink = true;
}
function flagAsURDFJoint(o: Object3D): void {
  (o as unknown as { isURDFJoint: boolean }).isURDFJoint = true;
}

describe('isURDFLink / isURDFJoint', () => {
  it('returns false for a plain Object3D', () => {
    const o = new Object3D();
    expect(isURDFLink(o)).toBe(false);
    expect(isURDFJoint(o)).toBe(false);
  });

  it('returns true only when the matching flag is set', () => {
    const link = new Object3D();
    flagAsURDFLink(link);
    expect(isURDFLink(link)).toBe(true);
    expect(isURDFJoint(link)).toBe(false);

    const joint = new Object3D();
    flagAsURDFJoint(joint);
    expect(isURDFJoint(joint)).toBe(true);
    expect(isURDFLink(joint)).toBe(false);
  });

  it('handles null/undefined safely', () => {
    expect(isURDFLink(null)).toBe(false);
    expect(isURDFJoint(undefined)).toBe(false);
  });
});

describe('findParentLink / findParentJoint', () => {
  it('walks up the parent chain to the nearest matching node', () => {
    const link = new Object3D();
    flagAsURDFLink(link);
    const joint = new Object3D();
    flagAsURDFJoint(joint);
    const mesh = new Object3D();
    link.add(joint);
    joint.add(mesh);

    expect(findParentLink(mesh)).toBe(link);
    expect(findParentJoint(mesh)).toBe(joint);
  });

  it('returns null when no ancestor matches', () => {
    const parent = new Object3D();
    const child = new Object3D();
    parent.add(child);
    expect(findParentLink(child)).toBeNull();
    expect(findParentJoint(child)).toBeNull();
  });
});

describe('isHelperObject', () => {
  it('recognizes the known helper names', () => {
    for (const name of ['joint-helper', 'axes-helper-link', 'axes-helper-joint', 'shadow-plane']) {
      const o = new Object3D();
      o.name = name;
      expect(isHelperObject(o)).toBe(true);
    }
  });

  it('returns false for ordinary mesh names', () => {
    const o = new Object3D();
    o.name = 'base_link_visual';
    expect(isHelperObject(o)).toBe(false);
  });
});
