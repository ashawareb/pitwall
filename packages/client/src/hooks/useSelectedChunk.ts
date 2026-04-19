import { useCallback, useEffect, useRef, useState } from 'react';

// Owns "which chunk inside the current edit is selected" — hoisted to the
// Session route so spec 12's Radio panel (sibling of DiffView) can read the
// same state. Unlike the URL-backed selected-edit, chunk selection is
// ephemeral and resets every time a new edit is opened.
//
// Seeding: the first time a given editId is observed with a non-null
// defaultId (i.e. segments are ready and a first-added chunk exists), we
// seed. Subsequent renders for that same editId keep whatever the user
// clicked — even if the default becomes null again briefly mid-reload.

interface SelectedChunk {
  readonly selectedChunkId: string | null;
  selectChunk(chunkId: string | null): void;
}

export function useSelectedChunk(
  editId: string | null,
  defaultId: string | null,
): SelectedChunk {
  const [selected, setSelected] = useState<string | null>(null);
  const seededEditRef = useRef<string | null>(null);

  useEffect(() => {
    // New edit: clear selection and drop the seeded marker so the next
    // defaultId seeds fresh.
    setSelected(null);
    seededEditRef.current = null;
  }, [editId]);

  useEffect(() => {
    if (editId === null || defaultId === null) return;
    if (seededEditRef.current === editId) return;
    setSelected(defaultId);
    seededEditRef.current = editId;
  }, [editId, defaultId]);

  const selectChunk = useCallback((chunkId: string | null) => {
    setSelected(chunkId);
  }, []);

  return { selectedChunkId: selected, selectChunk };
}
