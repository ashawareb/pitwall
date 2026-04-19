import { useEffect, useState } from 'react';
import { getSessionFile } from '../api/endpoints.js';
import type { SessionFileResponse } from '../api/types.js';

// Fetches the file content for the currently-selected edit. Keyed by
// (projectHash, sessionId, editId) — every change triggers a fresh fetch and
// aborts any in-flight request by flipping a cancelled flag in the cleanup.
//
// We keep this as a dedicated hook (vs. inlining in Session.tsx) so the
// DiffView tests can stub the fetch independently without re-running the
// session-detail fetch.

export type FileContentState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'ready'; readonly data: SessionFileResponse };

export function useFileContent(
  projectHash: string,
  sessionId: string,
  editId: string | null,
): FileContentState {
  const [state, setState] = useState<FileContentState>(() =>
    editId === null ? { kind: 'ready', data: EMPTY } : { kind: 'loading' },
  );

  useEffect(() => {
    if (editId === null) {
      setState({ kind: 'ready', data: EMPTY });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    getSessionFile(projectHash, sessionId, editId)
      .then((data) => {
        if (!cancelled) setState({ kind: 'ready', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'error', error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [projectHash, sessionId, editId]);

  return state;
}

// Sentinel for "no edit selected" — the session has zero file edits. Surfaces
// as a ready state with null content so DiffView can render its empty shell
// without the caller having to special-case null elsewhere.
const EMPTY: SessionFileResponse = {
  editId: '',
  path: '',
  preContent: null,
  postContent: '',
  language: 'plaintext',
};
