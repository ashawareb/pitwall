import { stat } from 'node:fs/promises';
import { join, resolve as resolvePath, sep } from 'node:path';
import {
  readSessionRecords,
  reconstructSession,
  type Session,
} from '@pitwall/parser';
import type { MtimeCache } from '../cache.js';
import { getProjectsDir, resolveClaudeHome } from '../fs/claude-home.js';

// Claude Code's on-disk hash starts with '-' (an encoded leading '/') and
// contains only characters drawn from path segments after '/' and '.' were
// replaced with '-'. Real hashes therefore only contain alphanumerics, '_',
// and '-'. Anything else (spaces, '..', '%', '/') is not a real hash — reject
// BEFORE path.join to prevent traversal before it begins. The resolve-inside
// check below is belt-and-suspenders for anything the regex somehow admits.
const HASH_REGEX = /^-[A-Za-z0-9_-]+$/;

// Session ids are alphanumerics, '_', and '-' — UUID shape plus a bit more
// slack for anything Claude Code might emit. '.' is excluded so '..' cannot
// appear; combined with the resolve-inside check below, traversal via id is
// blocked at two layers.
const SESSION_ID_REGEX = /^[A-Za-z0-9_-]+$/;

export interface ResolvedProject {
  hash: string;
  projectDir: string;
}

export async function validateAndResolveProjectHash(
  hash: string,
): Promise<ResolvedProject | null> {
  if (!HASH_REGEX.test(hash)) return null;

  const claudeHome = resolveClaudeHome();
  const projectsDir = getProjectsDir(claudeHome);
  const projectDir = join(projectsDir, hash);

  const resolvedProjects = resolvePath(projectsDir);
  const resolvedProject = resolvePath(projectDir);
  if (
    resolvedProject !== resolvedProjects &&
    !resolvedProject.startsWith(resolvedProjects + sep)
  ) {
    return null;
  }

  let projectStat;
  try {
    projectStat = await stat(projectDir);
  } catch {
    return null;
  }
  if (!projectStat.isDirectory()) return null;

  return { hash, projectDir };
}

export async function resolveSessionFile(
  projectDir: string,
  sessionId: string,
): Promise<string | null> {
  if (!SESSION_ID_REGEX.test(sessionId)) return null;

  const filepath = join(projectDir, `${sessionId}.jsonl`);
  const resolvedDir = resolvePath(projectDir);
  const resolvedFile = resolvePath(filepath);
  if (!resolvedFile.startsWith(resolvedDir + sep)) return null;

  let fileStat;
  try {
    fileStat = await stat(filepath);
  } catch {
    return null;
  }
  if (!fileStat.isFile()) return null;

  return filepath;
}

export async function parseSession(
  filepath: string,
  cache: MtimeCache<Session>,
): Promise<Session> {
  return cache.getOrCompute(filepath, (fp) =>
    reconstructSession(readSessionRecords(fp)),
  );
}
