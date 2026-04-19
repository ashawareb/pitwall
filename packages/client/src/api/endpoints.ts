import { apiFetch } from './client.js';
import type {
  HealthResponse,
  ProjectListResponse,
  SessionDetailResponse,
  SessionFileResponse,
  SessionListResponse,
  SessionReplayResponse,
} from './types.js';

// Thin typed wrappers over the REST API. No caching, no retry, no mapping —
// those belong to whichever spec first needs them. Paths are all relative so
// Vite's dev proxy handles cross-origin in dev and same-origin covers prod.

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health');
}

export function getProjects(): Promise<ProjectListResponse> {
  return apiFetch<ProjectListResponse>('/api/projects');
}

export function getSessions(hash: string): Promise<SessionListResponse> {
  return apiFetch<SessionListResponse>(
    `/api/projects/${encodeURIComponent(hash)}/sessions`,
  );
}

export function getSessionDetail(
  hash: string,
  id: string,
): Promise<SessionDetailResponse> {
  return apiFetch<SessionDetailResponse>(
    `/api/projects/${encodeURIComponent(hash)}/sessions/${encodeURIComponent(id)}`,
  );
}

export function getSessionFile(
  hash: string,
  id: string,
  editId: string,
): Promise<SessionFileResponse> {
  return apiFetch<SessionFileResponse>(
    `/api/projects/${encodeURIComponent(hash)}/sessions/${encodeURIComponent(id)}/files/${encodeURIComponent(editId)}`,
  );
}

export function getSessionReplay(
  hash: string,
  id: string,
  tMs: number,
): Promise<SessionReplayResponse> {
  return apiFetch<SessionReplayResponse>(
    `/api/projects/${encodeURIComponent(hash)}/sessions/${encodeURIComponent(id)}/replay/${tMs}`,
  );
}
