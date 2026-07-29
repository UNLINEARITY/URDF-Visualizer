import { useCallback, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadStandaloneModel } from '../utils/modelLoader';
import { disposeObject3D } from '../utils/robotLoader';

export interface StandaloneModelLoaderResult {
  model: THREE.Group | null;
  loading: boolean;
  error: string | null;
  currentFileName: string;
  loadFile: (file: File) => Promise<void>;
  clear: () => void;
}

export function useStandaloneModelLoader(): StandaloneModelLoaderResult {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState('');
  const loadIdRef = useRef(0);
  const loadFile = useCallback(async (file: File) => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const nextModel = await loadStandaloneModel(file);
      if (loadId !== loadIdRef.current) {
        disposeObject3D(nextModel);
        return;
      }
      setModel(nextModel);
      setCurrentFileName(file.name);
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      console.error('Standalone model loading error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load model.');
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    loadIdRef.current += 1;
    setModel(null);
    setCurrentFileName('');
    setError(null);
  }, []);

  return { model, loading, error, currentFileName, loadFile, clear };
}
