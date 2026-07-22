import { describe, it, expect } from 'vitest';
import { findFileInMap } from '../fileUtils';

function makeFileMap(entries: Record<string, string>): Map<string, File> {
  const map = new Map<string, File>();
  for (const [path, content] of Object.entries(entries)) {
    const file = new File([content], path.split('/').pop() || 'file');
    // jsdom's File may not implement .text(); mirror the browser API for tests.
    if (typeof (file as unknown as { text?: unknown }).text !== 'function') {
      (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(content);
    }
    map.set(path, file);
  }
  return map;
}

describe('findFileInMap', () => {
  it('returns the file on an exact path match', () => {
    const map = makeFileMap({ 'robot/meshes/base.stl': 'data' });
    expect(findFileInMap('robot/meshes/base.stl', map)).toBeDefined();
  });

  it('matches after stripping package://', () => {
    const map = makeFileMap({ 'g1_description/meshes/g1.stl': 'data' });
    expect(findFileInMap('package://g1_description/meshes/g1.stl', map)).toBeDefined();
  });

  it('matches by suffix when target is nested under a root folder', () => {
    const map = makeFileMap({ 'g1_description/meshes/g1.stl': 'data' });
    expect(findFileInMap('meshes/g1.stl', map)).toBeDefined();
  });

  it('falls back to loose filename match for flat structures', () => {
    const map = makeFileMap({ 'base.stl': 'data' });
    expect(findFileInMap('package://anything/base.stl', map)).toBeDefined();
  });

  it('returns undefined when no plausible match exists', () => {
    const map = makeFileMap({ 'robot/meshes/base.stl': 'data' });
    expect(findFileInMap('package://other/arm.dae', map)).toBeUndefined();
  });
});
