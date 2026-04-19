import { useParams } from 'react-router-dom';

// react-router-dom v6's useParams() is typed as Record<string, string | undefined>
// because TypeScript can't statically prove a route match. For the
// /s/:projectHash/:sessionId route the two params are structurally always
// present, but we don't use a non-null assertion to claim that — the rule in
// CLAUDE.md §5 is to narrow, not to cast. This hook centralises the narrowing.
//
// App.tsx installs a catch-all redirect to '/', so an unmatched variant of the
// /s/... route cannot reach here in practice. The throw below is the fail-loud
// safety net if the hook is ever used outside its intended route.
//
// Spec 09 will fetch session/project data against these params — reuse this
// hook there rather than re-narrowing per call site.
export function useSessionParams(): { projectHash: string; sessionId: string } {
  const { projectHash, sessionId } = useParams();
  if (projectHash === undefined || sessionId === undefined) {
    throw new Error(
      `useSessionParams() called outside /s/:projectHash/:sessionId (projectHash=${JSON.stringify(projectHash)}, sessionId=${JSON.stringify(sessionId)})`,
    );
  }
  return { projectHash, sessionId };
}
