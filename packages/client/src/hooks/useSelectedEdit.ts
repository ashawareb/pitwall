import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FileEditSummary } from '../api/types.js';

// URL ⇄ state for the selected edit in the Timeline rail. `?edit=<editId>`
// is the single source of truth per spec 10 AC: mount-with-no-param defaults
// to edit 01, stale ids silently fall back to edit 01 and the URL is replaced
// so the address bar reflects what's on screen. select() pushes (not replaces)
// so browser back/forward traverses selection history.

interface SelectedEdit {
  readonly selectedId: string | null;
  readonly selectedIndex: number;
  select(editId: string): void;
}

interface Resolution {
  readonly id: string | null;
  readonly index: number;
  readonly shouldRepairUrl: boolean;
}

export function useSelectedEdit(fileEdits: FileEditSummary[]): SelectedEdit {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramId = searchParams.get('edit');

  const resolution = useMemo<Resolution>(() => {
    const first = fileEdits[0];
    if (first === undefined) {
      return { id: null, index: -1, shouldRepairUrl: false };
    }
    if (paramId !== null) {
      const idx = fileEdits.findIndex((e) => e.id === paramId);
      if (idx >= 0) {
        return { id: paramId, index: idx, shouldRepairUrl: false };
      }
    }
    // No param, or the param did not match any edit.
    return { id: first.id, index: 0, shouldRepairUrl: true };
  }, [fileEdits, paramId]);

  useEffect(() => {
    if (!resolution.shouldRepairUrl || resolution.id === null) return;
    const targetId = resolution.id;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('edit', targetId);
        return next;
      },
      { replace: true },
    );
  }, [resolution.shouldRepairUrl, resolution.id, setSearchParams]);

  const select = (editId: string): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('edit', editId);
      return next;
    });
  };

  return {
    selectedId: resolution.id,
    selectedIndex: resolution.index,
    select,
  };
}
