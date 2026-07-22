import { useCallback, useEffect, useRef, useState } from 'react';
import type { URDFRobot } from 'urdf-loader';
import { loadRobot } from '../utils/robotLoader';
import {
  compileXacroToUrdf,
  fetchAndFlattenXacro,
  flattenXacroLocal,
} from '../utils/xacroProcessor';
import { getAllFiles } from '../utils/fileUtils';

export interface UseRobotLoaderResult {
  robot: URDFRobot | null;
  loading: boolean;
  error: string | null;
  currentFilePath: string;
  sampleFiles: string[];
  isDragActive: boolean;
  setError: (e: string | null) => void;
  loadSingleFile: (file: File) => void;
  loadFolderFileList: (files: FileList) => void;
  loadSample: (filename: string) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
}

/** Heuristic to pick the best entry file from a set of urdf/xacro files. */
function pickEntryFile(candidates: File[]): File | undefined {
  if (candidates.length === 0) return undefined;
  return (
    candidates.find((f) => f.name.toLowerCase().includes('main')) ??
    candidates.find((f) => f.name.toLowerCase().includes('robot')) ??
    candidates[0]
  );
}

function findUrdfFiles(filesMap: Map<string, File>): File[] {
  const result: File[] = [];
  filesMap.forEach((file) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.urdf') || name.endsWith('.xacro')) result.push(file);
  });
  return result;
}

export function useRobotLoader(): UseRobotLoaderResult {
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState('');
  const [sampleFiles, setSampleFiles] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  // Local files from drag & drop (path -> File)
  const localFilesRef = useRef<Map<string, File>>(new Map());
  // Blob URLs created for the *current* robot, revoked when a new one loads
  const blobUrlsRef = useRef<string[]>([]);

  const revokeBlobUrls = useCallback(() => {
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
  }, []);

  // Revoke blob URLs on unmount
  useEffect(() => revokeBlobUrls, [revokeBlobUrls]);

  // Fetch the static sample manifest (files.json)
  useEffect(() => {
    let cancelled = false;
    fetch('files.json')
      .then((res) => {
        if (res.ok && res.headers.get('content-type')?.includes('json')) return res.json();
        throw new Error('No static manifest');
      })
      .then((files: string[]) => {
        if (!cancelled) setSampleFiles(files);
      })
      .catch(() => {
        /* manifest is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Parse URDF content into a robot
  const parseRobot = useCallback(
    (urdfContent: string, filePath: string) => {
      setLoading(true);
      setError(null);
      // Revoke previous blob URLs before creating new ones
      revokeBlobUrls();

      // Defer to allow the loading UI to paint
      setTimeout(() => {
        try {
          const loaded = loadRobot(urdfContent, {
            localFiles: localFilesRef.current,
            currentFilePath: filePath,
            onBlobUrlCreated: (url) => blobUrlsRef.current.push(url),
            onLoad: () => setLoading(false),
            onError: (url) => console.error(`Failed to load resource: ${url}`),
          });
          setRobot(loaded);
          setLoading(false);
        } catch (err) {
          console.error('Error parsing URDF:', err);
          setError(`Failed to parse URDF: ${err instanceof Error ? err.message : String(err)}`);
          setRobot(null);
          setLoading(false);
        }
      }, 10);
    },
    [revokeBlobUrls],
  );

  // Handle xacro vs plain urdf, then parse
  const processContent = useCallback(
    async (filename: string, content: string) => {
      if (filename.toLowerCase().endsWith('.xacro')) {
        setLoading(true);
        try {
          const flattened = await flattenXacroLocal(content, localFilesRef.current);
          const urdfString = await compileXacroToUrdf(flattened);
          parseRobot(urdfString, filename);
        } catch (err) {
          console.error('Xacro parsing error:', err);
          setError(`Xacro Error: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      } else {
        parseRobot(content, filename);
      }
    },
    [parseRobot],
  );

  const loadSingleFile = useCallback(
    (file: File) => {
      localFilesRef.current = new Map([[file.name, file]]);
      setCurrentFilePath(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        processContent(file.name, e.target?.result as string);
      };
      reader.onerror = () => setError('Failed to read file.');
      reader.readAsText(file);
    },
    [processContent],
  );

  const loadFromFilesMap = useCallback(
    (filesMap: Map<string, File>) => {
      setLoading(true);
      setError(null);
      localFilesRef.current = filesMap;

      const urdfFiles = findUrdfFiles(filesMap);
      const entryFile = pickEntryFile(urdfFiles);

      if (!entryFile) {
        setError('No .urdf or .xacro file found in the selection.');
        setLoading(false);
        return;
      }

      setCurrentFilePath(entryFile.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        processContent(entryFile.name, ev.target?.result as string);
      };
      reader.onerror = () => {
        setError('Failed to read entry file.');
        setLoading(false);
      };
      reader.readAsText(entryFile);
    },
    [processContent],
  );

  const loadFolderFileList = useCallback(
    (files: FileList) => {
      if (files.length === 0) return;
      const filesMap = new Map<string, File>();
      Array.from(files).forEach((file) => {
        filesMap.set(file.webkitRelativePath || file.name, file);
      });
      loadFromFilesMap(filesMap);
    },
    [loadFromFilesMap],
  );

  const loadSample = useCallback(
    (filename: string) => {
      if (!filename) {
        setRobot(null);
        setCurrentFilePath('');
        return;
      }
      localFilesRef.current = new Map();
      setLoading(true);
      setError(null);
      setCurrentFilePath(filename);

      if (filename.endsWith('.xacro')) {
        fetchAndFlattenXacro(filename)
          .then((content) => processContent(filename, content))
          .catch((err) => {
            console.error(err);
            setError(`Failed to load Xacro: ${err instanceof Error ? err.message : String(err)}`);
            setLoading(false);
          });
      } else {
        fetch(filename)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
          })
          .then((content) => parseRobot(content, filename))
          .catch((err) => {
            setError(`Failed to fetch ${filename}: ${err instanceof Error ? err.message : String(err)}`);
            setLoading(false);
          });
      }
    },
    [parseRobot, processContent],
  );

  // --- Drag & Drop ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      if (!e.dataTransfer.items) return;

      setLoading(true);
      setError(null);
      try {
        const filesMap = await getAllFiles(e.dataTransfer.items);
        loadFromFilesMap(filesMap);
      } catch (err) {
        console.error('Drop error:', err);
        setError(err instanceof Error ? err.message : 'Failed to process dropped files');
        setLoading(false);
      }
    },
    [loadFromFilesMap],
  );

  return {
    robot,
    loading,
    error,
    currentFilePath,
    sampleFiles,
    isDragActive,
    setError,
    loadSingleFile,
    loadFolderFileList,
    loadSample,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
