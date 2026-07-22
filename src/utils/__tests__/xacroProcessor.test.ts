import { describe, it, expect } from 'vitest';
import { resolveUrlPath, stripRobotWrapper, flattenXacroLocal } from '../xacroProcessor';

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

describe('resolveUrlPath', () => {
  it('joins a relative path against the base directory', () => {
    expect(resolveUrlPath('a/b/c.urdf', 'meshes/x.stl')).toBe('a/b/meshes/x.stl');
  });

  it('resolves ../ segments', () => {
    expect(resolveUrlPath('a/b/c.urdf', '../d.stl')).toBe('a/d.stl');
  });

  it('ignores . segments', () => {
    expect(resolveUrlPath('a/b/c.urdf', './d.stl')).toBe('a/b/d.stl');
  });

  it('returns absolute and http paths untouched', () => {
    expect(resolveUrlPath('a/b/c.urdf', '/abs.stl')).toBe('/abs.stl');
    expect(resolveUrlPath('a/b/c.urdf', 'http://host/x.stl')).toBe('http://host/x.stl');
  });
});

describe('stripRobotWrapper', () => {
  it('removes the XML declaration and <robot> open/close tags', () => {
    const input = '<?xml version="1.0"?><robot name="r"><link name="L"/></robot>';
    const result = stripRobotWrapper(input);
    expect(result).toContain('<link name="L"/>');
    expect(result).not.toContain('<robot');
    expect(result).not.toContain('</robot>');
    expect(result).not.toContain('<?xml');
  });
});

describe('flattenXacroLocal', () => {
  it('inlines a single <xacro:include> from the local file map', async () => {
    const map = makeFileMap({
      'inc.xacro': '<?xml version="1.0"?><robot name="inc"><link name="L"/></robot>',
    });
    const main = '<robot name="r"><xacro:include filename="inc.xacro"/></robot>';
    const result = await flattenXacroLocal(main, map);
    expect(result).toContain('<link name="L"/>');
    expect(result).not.toContain('xacro:include');
  });

  it('recursively inlines nested includes', async () => {
    const map = makeFileMap({
      'a.xacro': '<robot name="a"><link name="A"/></robot>',
      'b.xacro': '<robot name="b"><xacro:include filename="a.xacro"/></robot>',
    });
    const main = '<robot name="r"><xacro:include filename="b.xacro"/></robot>';
    const result = await flattenXacroLocal(main, map);
    expect(result).toContain('<link name="A"/>');
    expect(result).not.toContain('xacro:include');
  });

  it('leaves the include directive in place when the file is missing', async () => {
    const map = makeFileMap({});
    const main = '<robot name="r"><xacro:include filename="missing.xacro"/></robot>';
    const result = await flattenXacroLocal(main, map);
    expect(result).toContain('xacro:include');
  });
});
