export interface BuildUrlParams {
  baseUrl: string;
  all: boolean;
  session?: string;
  projectHash: string;
}

// Map CLI flags to the client router routes (App.tsx):
//   /            — all projects (picker root)
//   /p/:hash     — sessions for one project
//   /s/:hash/:id — a specific session deep-link
// Precedence: --session wins over --all. When --session is given we always
// use the CWD's project hash; the spec's --session is a UUID with no
// project reference, so we assume the session belongs to CWD's project.

export function buildUrl({
  baseUrl,
  all,
  session,
  projectHash,
}: BuildUrlParams): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  if (session !== undefined) {
    return `${trimmed}/s/${projectHash}/${session}`;
  }
  if (all) {
    return `${trimmed}/`;
  }
  return `${trimmed}/p/${projectHash}`;
}
