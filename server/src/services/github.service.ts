import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'path';
import { ENV } from '../config/env.js';

const execFileAsync = promisify(execFile);

export interface ParsedGitHubUrl {
  type: 'REPOSITORY' | 'PULL_REQUEST';
  owner: string;
  repo: string;
  prNumber?: number;
  canonicalUrl: string;
}

export interface SourceRevisionResult {
  baseContent?: string;
  headContent?: string;
  isBaseAvailable: boolean;
  isHeadAvailable: boolean;
  unavailableReason?: string;
}

/**
 * Validates repository owner and name to prevent directory traversal and injection
 */
export function validateRepoIdentifier(owner: string, repo: string): void {
  const safeIdentifier = /^[a-zA-Z0-9_\-\.]+$/;
  if (!owner || !safeIdentifier.test(owner) || owner === '.' || owner === '..' || owner.includes('/') || owner.includes('\\')) {
    throw new Error(`Invalid repository identifier (owner): "${owner}"`);
  }
  if (!repo || !safeIdentifier.test(repo) || repo === '.' || repo === '..' || repo.includes('/') || repo.includes('\\')) {
    throw new Error(`Invalid repository identifier (repo): "${repo}"`);
  }
}

/**
 * Validates file path to prevent directory traversal and injection
 */
export function validateSafeFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required and must be a string.');
  }
  const normalized = filePath.replace(/\\/g, '/').trim();
  if (
    normalized.includes('\0') ||
    normalized.includes('..') ||
    path.isAbsolute(normalized) ||
    /^[a-zA-Z]:/.test(normalized) ||
    /[;&|`$<>]/.test(normalized)
  ) {
    throw new Error(`Invalid or malicious file path rejected: "${filePath}"`);
  }
  return normalized;
}

/**
 * Validates commit SHA or branch ref to prevent command injection
 */
export function validateSafeRevision(revision?: string): string {
  if (!revision) return '';
  const trimmed = revision.trim();
  if (
    !/^[a-zA-Z0-9_\-\.\/]+$/.test(trimmed) ||
    trimmed.startsWith('-') ||
    trimmed.includes('..') ||
    /[;&|`$<>]/.test(trimmed)
  ) {
    throw new Error(`Invalid revision value: "${revision}"`);
  }
  return trimmed;
}

export class GitHubService {
  private token: string;

  constructor() {
    this.token = ENV.GITHUB_TOKEN;
  }

  validateRepoIdentifier(owner: string, repo: string): void {
    validateRepoIdentifier(owner, repo);
  }

  validateSafeFilePath(filePath: string): string {
    return validateSafeFilePath(filePath);
  }

  validateSafeRevision(revision?: string): string {
    return validateSafeRevision(revision);
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'User-Agent': 'CodeSense-Copilot-App',
      Accept: 'application/vnd.github.v3+json'
    };
    if (this.token && this.token.trim().length > 0) {
      headers['Authorization'] = `token ${this.token}`;
    }
    return headers;
  }

  /**
   * Parses any pasted GitHub URL (repo, PR, with or without https://, with .git, etc.)
   */
  parseGitHubUrl(inputUrl: string): ParsedGitHubUrl {
    const cleaned = inputUrl.trim().replace(/^git@github\.com:/, 'https://github.com/');
    const urlObj = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;

    // Match PR URL: https://github.com/owner/repo/pull/123
    const prRegex = /github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)\/pull\/(\d+)/i;
    const prMatch = urlObj.match(prRegex);
    if (prMatch) {
      const owner = prMatch[1];
      const repo = prMatch[2].replace(/\.git$/, '');
      const prNumber = parseInt(prMatch[3], 10);
      validateRepoIdentifier(owner, repo);
      return {
        type: 'PULL_REQUEST',
        owner,
        repo,
        prNumber,
        canonicalUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`
      };
    }

    // Match Repo URL: https://github.com/owner/repo
    const repoRegex = /github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)/i;
    const repoMatch = urlObj.match(repoRegex);
    if (repoMatch) {
      const owner = repoMatch[1];
      const repo = repoMatch[2].replace(/\.git$/, '').replace(/\/$/, '');
      validateRepoIdentifier(owner, repo);
      return {
        type: 'REPOSITORY',
        owner,
        repo,
        canonicalUrl: `https://github.com/${owner}/${repo}`
      };
    }

    // Match simple "owner/repo" shorthand
    const shortRegex = /^([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)$/;
    const shortMatch = inputUrl.trim().match(shortRegex);
    if (shortMatch) {
      const owner = shortMatch[1];
      const repo = shortMatch[2];
      validateRepoIdentifier(owner, repo);
      return {
        type: 'REPOSITORY',
        owner,
        repo,
        canonicalUrl: `https://github.com/${owner}/${repo}`
      };
    }

    throw new Error(`Invalid GitHub URL: "${inputUrl}". Expected format: https://github.com/owner/repo or /pull/123`);
  }

  /**
   * Fetches repository information from GitHub API or infers it
   */
  async getRepoDetails(owner: string, repo: string) {
    validateRepoIdentifier(owner, repo);
    try {
      const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: this.getHeaders(),
        timeout: 10000
      });
      const data = res.data;
      return {
        id: `${owner}/${repo}`,
        name: data.name,
        fullName: data.full_name,
        url: data.html_url,
        defaultBranch: data.default_branch || 'main',
        description: data.description || '',
        isPrivate: data.private || false
      };
    } catch (err: any) {
      console.warn(`⚠️ [GitHub API] Could not fetch remote metadata for ${owner}/${repo}: ${err.message}. Using defaults.`);
      return {
        id: `${owner}/${repo}`,
        name: repo,
        fullName: `${owner}/${repo}`,
        url: `https://github.com/${owner}/${repo}`,
        defaultBranch: 'main',
        description: `Imported GitHub repository ${owner}/${repo}`,
        isPrivate: false
      };
    }
  }

  /**
   * Clones repository with safe shell-free execFile arguments
   */
  async cloneOrUpdateRepo(owner: string, repo: string): Promise<{ localPath: string; headSha: string }> {
    validateRepoIdentifier(owner, repo);
    const targetDir = path.join(ENV.REPOS_STORAGE_DIR, owner, repo);
    await fs.mkdir(path.dirname(targetDir), { recursive: true });

    const repoUrl = `https://github.com/${owner}/${repo}.git`;

    try {
      if (existsSync(path.join(targetDir, '.git'))) {
        console.log(`🔄 [GitHub] Updating existing cached repository at ${targetDir}...`);
        try {
          await execFileAsync('git', ['-C', targetDir, 'pull', '--depth', '1']);
        } catch {
          // If pull fails, re-clone clean
          await fs.rm(targetDir, { recursive: true, force: true });
          await execFileAsync('git', ['clone', '--depth', '1', repoUrl, targetDir]);
        }
      } else {
        console.log(`📥 [GitHub] Shallow cloning ${repoUrl} into ${targetDir}...`);
        await execFileAsync('git', ['clone', '--depth', '1', repoUrl, targetDir]);
      }

      // Get head commit SHA safely
      const { stdout } = await execFileAsync('git', ['-C', targetDir, 'rev-parse', 'HEAD']);
      const headSha = stdout.trim();

      return { localPath: targetDir, headSha };
    } catch (err: any) {
      console.error(`❌ [GitHub] Git clone failed for ${repoUrl}:`, err.message);
      throw new Error(`Failed to clone repository: ${err.message}`);
    }
  }

  /**
   * Fetches Pull Request metadata, commits, and unified diff
   */
  async getPullRequest(owner: string, repo: string, prNumber: number) {
    validateRepoIdentifier(owner, repo);
    let prData: any = null;
    let diffText = '';

    try {
      // 1. Fetch PR details
      const prRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: this.getHeaders(),
        timeout: 10000
      });
      prData = prRes.data;
    } catch (err: any) {
      console.warn(`⚠️ [GitHub API] Could not fetch PR #${prNumber} details:`, err.message);
    }

    try {
      // 2. Fetch Unified Diff
      const diffHeaders = {
        ...this.getHeaders(),
        Accept: 'application/vnd.github.v3.diff'
      };
      const diffRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: diffHeaders,
        timeout: 15000,
        responseType: 'text'
      });
      diffText = typeof diffRes.data === 'string' ? diffRes.data : JSON.stringify(diffRes.data);
    } catch (err: any) {
      console.warn(`⚠️ [GitHub API] Could not fetch PR diff via API:`, err.message);
      try {
        const publicDiff = await axios.get(`https://github.com/${owner}/${repo}/pull/${prNumber}.diff`, {
          timeout: 15000,
          responseType: 'text'
        });
        diffText = publicDiff.data;
      } catch (pubErr: any) {
        console.error(`❌ [GitHub API] Failed to fetch diff:`, pubErr.message);
        diffText = '';
      }
    }

    return {
      prNumber,
      title: prData?.title || `Pull Request #${prNumber}`,
      prUrl: prData?.html_url || `https://github.com/${owner}/${repo}/pull/${prNumber}`,
      baseSha: prData?.base?.sha || 'base-unknown',
      headSha: prData?.head?.sha || 'head-unknown',
      diff: diffText,
      additions: prData?.additions || 0,
      deletions: prData?.deletions || 0,
      changedFiles: prData?.changed_files || 1
    };
  }

  /**
   * Safely retrieves file content at a specific commit revision via shell-free git or GitHub API fallback
   */
  async getFileContentAtCommit(
    owner: string,
    repo: string,
    filePath: string,
    commitSha: string
  ): Promise<{ content?: string; isAvailable: boolean; unavailableReason?: string }> {
    validateRepoIdentifier(owner, repo);
    const safePath = validateSafeFilePath(filePath);
    const safeSha = validateSafeRevision(commitSha);

    if (!safeSha || safeSha === 'base-unknown' || safeSha === 'head-unknown') {
      return { isAvailable: false, unavailableReason: `Unknown or unprovided revision: ${commitSha}` };
    }

    const targetDir = path.join(ENV.REPOS_STORAGE_DIR, owner, repo);

    // 1. Try shell-free git show with argument array if local clone exists
    try {
      if (existsSync(path.join(targetDir, '.git'))) {
        const { stdout } = await execFileAsync('git', ['-C', targetDir, 'show', `${safeSha}:${safePath}`], {
          maxBuffer: 10 * 1024 * 1024
        });
        return { content: stdout, isAvailable: true };
      }
    } catch {
      // Commit may be missing from shallow clone or file not in local git tree; fall back to GitHub API
    }

    // 2. Fetch directly from GitHub REST API contents endpoint at explicit ref
    try {
      const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${safePath}?ref=${safeSha}`, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      if (res.data && res.data.content) {
        const decoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
        return { content: decoded, isAvailable: true };
      }
    } catch (apiErr: any) {
      if (apiErr.response?.status === 404) {
        return { isAvailable: false, unavailableReason: `File "${safePath}" does not exist at commit ${safeSha.substring(0, 7)}.` };
      }
    }

    return {
      isAvailable: false,
      unavailableReason: `Source for "${safePath}" could not be retrieved at commit ${safeSha.substring(0, 7)} (absent from shallow clone and GitHub API unreachable).`
    };
  }

  /**
   * Safely retrieves base and head source revisions for PR files without shell injection
   */
  async getFileContentAtRevisions(
    owner: string,
    repo: string,
    filePath: string,
    baseSha?: string,
    headSha?: string,
    fileStatus?: 'MODIFIED' | 'ADDED' | 'DELETED'
  ): Promise<SourceRevisionResult> {
    validateRepoIdentifier(owner, repo);
    const safePath = validateSafeFilePath(filePath);

    let baseContent: string | undefined;
    let headContent: string | undefined;
    let isBaseAvailable = false;
    let isHeadAvailable = false;
    let unavailableReason: string | undefined;

    // Head revision
    if (fileStatus === 'DELETED') {
      isHeadAvailable = false;
      unavailableReason = `File was deleted in this pull request.`;
    } else if (headSha) {
      const headRes = await this.getFileContentAtCommit(owner, repo, safePath, headSha);
      if (headRes.isAvailable) {
        headContent = headRes.content;
        isHeadAvailable = true;
      } else {
        unavailableReason = headRes.unavailableReason;
      }
    }

    // Base revision
    if (fileStatus === 'ADDED') {
      isBaseAvailable = false; // legitimately new file
    } else if (baseSha) {
      const baseRes = await this.getFileContentAtCommit(owner, repo, safePath, baseSha);
      if (baseRes.isAvailable) {
        baseContent = baseRes.content;
        isBaseAvailable = true;
      } else if (!unavailableReason) {
        unavailableReason = baseRes.unavailableReason;
      }
    }

    return {
      baseContent,
      headContent,
      isBaseAvailable,
      isHeadAvailable,
      unavailableReason
    };
  }
}

export const githubService = new GitHubService();
