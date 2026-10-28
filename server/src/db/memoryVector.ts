import {
  Repository,
  CodeChunk,
  CodeStructure,
  PullRequestAnalysis,
  PrFinding,
  PrImpactReport,
  ChatSession,
  ChatMessage,
  User,
  UserSession
} from '../types/index.js';

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

class InMemoryVectorStore {
  private repos = new Map<string, Repository>();
  // Partitioned by repositoryId and commitSha: Map<repoKey, CodeChunk[]> where repoKey is `${repositoryId}:::${commitSha}`
  private chunks = new Map<string, CodeChunk[]>();
  // Partitioned by repositoryId and commitSha: Map<repoKey, CodeStructure[]> where repoKey is `${repositoryId}:::${commitSha}`
  private structures = new Map<string, CodeStructure[]>();
  private analyses = new Map<string, PullRequestAnalysis>();
  private findings = new Map<string, PrFinding[]>(); // analysisId -> findings
  private impacts = new Map<string, PrImpactReport>(); // analysisId -> impact
  private sessions = new Map<string, ChatSession>();
  private messages = new Map<string, ChatMessage[]>(); // sessionId -> messages
  private users = new Map<string, User>();
  private userSessions = new Map<string, UserSession>();

  upsertRepository(repo: Repository): Repository {
    this.repos.set(repo.id, { ...repo, updatedAt: repo.updatedAt || new Date().toISOString() });
    return this.repos.get(repo.id)!;
  }

  getRepositories(): Repository[] {
    return Array.from(this.repos.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getRepositoryById(id: string): Repository | null {
    return this.repos.get(id) || null;
  }

  updateRepositoryStatus(id: string, status: Repository['indexStatus'], commitSha?: string, errorMessage?: string): void {
    const repo = this.repos.get(id);
    if (repo) {
      repo.indexStatus = status;
      if (commitSha) repo.indexedCommitSha = commitSha;
      if (status === 'INDEXING') {
        repo.indexingStartedAt = new Date().toISOString();
        repo.indexingError = undefined;
      } else if (status === 'FAILED') {
        repo.indexingError = errorMessage || repo.indexingError || 'Indexing failed';
      } else if (status === 'COMPLETED') {
        repo.indexingError = undefined;
      }
      repo.updatedAt = new Date().toISOString();
    }
  }

  touchRepositoryHeartbeat(id: string): void {
    const repo = this.repos.get(id);
    if (repo && repo.indexStatus === 'INDEXING') {
      repo.updatedAt = new Date().toISOString();
    }
  }

  recoverStaleIndexingJobs(timeoutMs: number = 15 * 60 * 1000): number {
    const now = Date.now();
    let recovered = 0;
    for (const repo of this.repos.values()) {
      if (repo.indexStatus === 'INDEXING') {
        // Measure staleness against the last progress update (heartbeat), not job start time
        const lastActivity = repo.updatedAt
          ? new Date(repo.updatedAt).getTime()
          : (repo.indexingStartedAt ? new Date(repo.indexingStartedAt).getTime() : 0);
        if (now - lastActivity > timeoutMs) {
          repo.indexStatus = 'FAILED';
          repo.indexingError = `Indexing job timed out after ${Math.round(timeoutMs / 60000)} minutes of inactivity. Safe to retry.`;
          repo.updatedAt = new Date().toISOString();
          recovered++;
        }
      }
    }
    return recovered;
  }

  private makeKey(repositoryId: string, commitSha?: string): string {
    return `${repositoryId}:::${commitSha || 'latest'}`;
  }

  saveCodeChunks(repositoryId: string, chunksList: CodeChunk[], commitSha?: string): void {
    const taggedChunks = chunksList.map((c) => ({
      ...c,
      commitSha: commitSha || c.commitSha
    }));
    // Save to specific commit partition
    const key = this.makeKey(repositoryId, commitSha);
    this.chunks.set(key, taggedChunks);

    // Also update 'latest' key for fallback access
    this.chunks.set(this.makeKey(repositoryId, 'latest'), taggedChunks);
  }

  searchSimilarChunks(repositoryId: string, queryEmbedding: number[], limit = 6, commitSha?: string): CodeChunk[] {
    let repoChunks: CodeChunk[] = [];

    if (commitSha) {
      repoChunks = this.chunks.get(this.makeKey(repositoryId, commitSha)) || [];
    }

    if (!repoChunks.length) {
      repoChunks = this.chunks.get(this.makeKey(repositoryId, 'latest')) || [];
    }

    if (!repoChunks.length) {
      // Find any commit partition for this repo
      for (const [k, v] of this.chunks.entries()) {
        if (k.startsWith(`${repositoryId}:::`)) {
          repoChunks = v;
          break;
        }
      }
    }

    if (!repoChunks.length || !queryEmbedding.length) return [];

    const scored = repoChunks
      .filter((c) => c.embedding && c.embedding.length > 0)
      .map((c) => ({
        ...c,
        similarity: cosineSimilarity(queryEmbedding, c.embedding!)
      }))
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    return scored.slice(0, limit);
  }

  saveCodeStructures(repositoryId: string, structuresList: CodeStructure[], commitSha?: string): void {
    const taggedStructures = structuresList.map((s) => ({
      ...s,
      commitSha: commitSha || s.commitSha
    }));
    // Save to specific commit partition
    const key = this.makeKey(repositoryId, commitSha);
    this.structures.set(key, taggedStructures);

    // Also update 'latest' key for fallback access
    this.structures.set(this.makeKey(repositoryId, 'latest'), taggedStructures);
  }

  getCodeStructures(repositoryId: string, commitSha?: string): CodeStructure[] {
    if (commitSha) {
      const match = this.structures.get(this.makeKey(repositoryId, commitSha));
      if (match && match.length > 0) return match;
    }

    const latest = this.structures.get(this.makeKey(repositoryId, 'latest'));
    if (latest && latest.length > 0) return latest;

    for (const [k, v] of this.structures.entries()) {
      if (k.startsWith(`${repositoryId}:::`)) {
        return v;
      }
    }

    return [];
  }

  savePullRequestAnalysis(analysis: PullRequestAnalysis): PullRequestAnalysis {
    this.analyses.set(analysis.id, analysis);
    return analysis;
  }

  getPullRequestAnalysis(id: string): PullRequestAnalysis | null {
    return this.analyses.get(id) || null;
  }

  getPullRequestsByRepo(repoId: string): PullRequestAnalysis[] {
    return Array.from(this.analyses.values())
      .filter((a) => !repoId || a.repositoryId === repoId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  savePrFindings(analysisId: string, findingsList: PrFinding[]): void {
    this.findings.set(analysisId, findingsList);
  }

  getPrFindings(analysisId: string): PrFinding[] {
    return this.findings.get(analysisId) || [];
  }

  savePrImpact(impact: PrImpactReport): void {
    const id = impact.analysisId || (impact as any).pullRequestId;
    if (id) {
      this.impacts.set(id, { ...impact, analysisId: id, pullRequestId: id });
    }
  }

  getPrImpact(analysisId: string): PrImpactReport | null {
    const impact = this.impacts.get(analysisId);
    if (!impact) return null;
    return {
      ...impact,
      analysisId: impact.analysisId || analysisId,
      pullRequestId: (impact as any).pullRequestId || analysisId,
      changedFiles: impact.changedFiles || impact.affectedFiles || []
    };
  }

  createChatSession(session: ChatSession): ChatSession {
    this.sessions.set(session.id, session);
    return session;
  }

  getChatSessionById(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getChatSessions(repositoryId: string): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.repositoryId === repositoryId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  saveChatMessage(message: ChatMessage): ChatMessage {
    const list = this.messages.get(message.sessionId) || [];
    list.push(message);
    this.messages.set(message.sessionId, list);
    return message;
  }

  getChatMessages(sessionId: string): ChatMessage[] {
    return this.messages.get(sessionId) || [];
  }

  upsertUser(user: User): User {
    // Check if user already exists by githubId
    let existingId = user.id;
    for (const [id, u] of this.users.entries()) {
      if (u.githubId === user.githubId) {
        existingId = id;
        break;
      }
    }
    const finalUser: User = {
      ...user,
      id: existingId || user.id,
      updatedAt: new Date().toISOString(),
      createdAt: this.users.get(existingId)?.createdAt || user.createdAt || new Date().toISOString()
    };
    this.users.set(finalUser.id, finalUser);
    return finalUser;
  }

  getUserById(id: string): User | null {
    return this.users.get(id) || null;
  }

  getUserByGithubId(githubId: string): User | null {
    for (const user of this.users.values()) {
      if (user.githubId === githubId) return user;
    }
    return null;
  }

  createSession(sessionId: string, userId: string, ttlMs: number = 7 * 24 * 60 * 60 * 1000): UserSession {
    const session: UserSession = {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      createdAt: new Date().toISOString()
    };
    this.userSessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): { session: UserSession; user: User } | null {
    const session = this.userSessions.get(sessionId);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.userSessions.delete(sessionId);
      return null;
    }
    const user = this.users.get(session.userId);
    if (!user) return null;
    return { session, user };
  }

  deleteSession(sessionId: string): void {
    this.userSessions.delete(sessionId);
  }
}

export const inMemoryDb = new InMemoryVectorStore();
