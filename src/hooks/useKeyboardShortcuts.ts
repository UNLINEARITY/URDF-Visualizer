import { useEffect, useState } from 'react';

export interface KeyboardShortcutHandlers {
  onToggleWorldAxes: () => void;
  onToggleGrid: () => void;
  onToggleLinkAxes: () => void;
  onToggleJointAxes: () => void;
  onToggleWireframe: () => void;
  onToggleStructureTree: () => void;
  onToggleMeasurement: () => void;
  onToggleAnimation: () => void;
  onEscape: () => void;
}

/**
 * Global keyboard shortcuts + Ctrl modifier tracking.
 * Blocks Ctrl+R to prevent accidental reload losing loaded models.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): {
  isCtrlPressed: boolean;
} {
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+R (Reload) — plain R alone still toggles measurement
      if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        return;
      }

      if (e.key === 'Control') setIsCtrlPressed(true);

      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'w':
          handlers.onToggleWorldAxes();
          break;
        case 'g':
          handlers.onToggleGrid();
          break;
        case 'l':
          handlers.onToggleLinkAxes();
          break;
        case 'j':
          handlers.onToggleJointAxes();
          break;
        case 'f':
          handlers.onToggleWireframe();
          break;
        case 't':
          handlers.onToggleStructureTree();
          break;
        case 'r':
          handlers.onToggleMeasurement();
          break;
        case 'a':
          handlers.onToggleAnimation();
          break;
        case 'escape':
          handlers.onEscape();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(false);
    };

    // Block the browser's default context menu outside inputs so
    // right-click can be used for selection without plugin interference.
    const handleGlobalContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('contextmenu', handleGlobalContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
    // Handlers are stable (wrapped in useCallback by the caller)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isCtrlPressed };
}
