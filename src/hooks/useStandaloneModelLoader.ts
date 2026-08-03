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
  loadSampleFile: (filename: string) => Promise<void>;
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

  const loadSampleFile = useCallback(
    async (filename: string) => {
      const loadId = ++loadIdRef.current; // invalidate any in-flight load immediately
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(filename);
        if (loadId !== loadIdRef.current) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const content = await res.arrayBuffer();
        if (loadId !== loadIdRef.current) return;
        const file = new File([content], filename.split('/').pop() || filename);
        await loadFile(file); // loadFile owns the loading state from here on
      } catch (err) {
        if (loadId !== loadIdRef.current) return;
        console.error('Standalone sample loading error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load sample model.');
        setLoading(false);
      }
    },
    [loadFile],
  );

  const clear = useCallback(() => {
    loadIdRef.current += 1;
    setModel(null);
    setCurrentFileName('');
    setError(null);
  }, []);

  return { model, loading, error, currentFileName, loadFile, loadSampleFile, clear };
}
