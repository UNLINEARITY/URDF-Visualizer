import { XacroParser } from 'xacro-parser';
import { findFileInMap } from './fileUtils';

const INCLUDE_REGEX = /<xacro:include\s+filename\s*=\s*['"]([^'"]+)['"]\s*\/?>/g;
const FIND_PKG_REGEX = /\$\((?:find|[a-z_]+)\s+([\w_]+)\)/g;

/** Resolve a relative path against a base URL/path. */
export function resolveUrlPath(base: string, relative: string): string {
  if (relative.startsWith('http') || relative.startsWith('/')) return relative;
  const stack = base.split('/');
  stack.pop(); // Remove filename
  const parts = relative.split('/');
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function getBaseUrl(): string {
  const base = import.meta.env.BASE_URL;
  return base.endsWith('/') ? base : base + '/';
}

/** Strip XML declaration and root <robot> wrapper from an included xacro fragment. */
export function stripRobotWrapper(content: string): string {
  let result = content.replace(/<\?xml.*?\?>/g, '');
  result = result.replace(/<robot\b[^>]*>/, '');
  result = result.replace(/<\/robot>[\s\S]*$/, '');
  return result;
}

/**
 * Recursively flatten `<xacro:include>` directives by fetching over HTTP.
 * Used for static sample files served from `public/`.
 */
export async function fetchAndFlattenXacro(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  const content = await response.text();

  const matches: { full: string; path: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(INCLUDE_REGEX.source, 'g');
  while ((match = regex.exec(content)) !== null) {
    matches.push({ full: match[0], path: match[1], index: match.index });
  }

  const baseUrl = getBaseUrl();
  let newContent = content;

  for (let i = matches.length - 1; i >= 0; i--) {
    const { full, path: includePath } = matches[i];

    let cleanPath = includePath.replace(FIND_PKG_REGEX, 'package://$1');
    if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);

    let targetUrl: string;
    if (cleanPath.startsWith('package://')) {
      targetUrl = baseUrl + cleanPath.replace('package://', '');
    } else {
      targetUrl = resolveUrlPath(url, cleanPath);
    }
    targetUrl = targetUrl.replace(/([^:])\/\//g, '$1/');

    try {
      const included = await fetchAndFlattenXacro(targetUrl);
      const cleaned = stripRobotWrapper(included);
      newContent =
        newContent.substring(0, matches[i].index) +
        cleaned +
        newContent.substring(matches[i].index + full.length);
    } catch (e) {
      console.warn(`Failed to include ${targetUrl}`, e);
    }
  }
  return newContent;
}

/**
 * Recursively flatten `<xacro:include>` directives from a local (drag & drop) file map.
 */
export async function flattenXacroLocal(
  content: string,
  filesMap: Map<string, File>,
): Promise<string> {
  const matches: { full: string; path: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(INCLUDE_REGEX.source, 'g');
  while ((match = regex.exec(content)) !== null) {
    matches.push({ full: match[0], path: match[1], index: match.index });
  }

  let newContent = content;

  for (let i = matches.length - 1; i >= 0; i--) {
    const { full, path } = matches[i];
    const resolvedPath = path.replace(/\$\(find\s+([\w_]+)\)/g, '$1');
    const file = findFileInMap(resolvedPath, filesMap);

    if (file) {
      let fileText = await file.text();
      fileText = stripRobotWrapper(fileText);
      const flattenedInclude = await flattenXacroLocal(fileText, filesMap);
      newContent =
        newContent.substring(0, matches[i].index) +
        flattenedInclude +
        newContent.substring(matches[i].index + full.length);
    }
  }

  return newContent;
}

/**
 * Compile a (flattened) xacro document into a URDF XML string.
 */
export async function compileXacroToUrdf(flattenedContent: string): Promise<string> {
  const parser = new XacroParser();
  // Map ROS `$(find pkg)` to package:// so the URDF loader's URL modifier can resolve it.
  (parser as { rospack?: { find: (pkg: string) => string } }).rospack = {
    find: (pkg: string) => `package://${pkg}`,
  };
  const xml = await parser.parse(flattenedContent);
  return new XMLSerializer().serializeToString(xml);
}
