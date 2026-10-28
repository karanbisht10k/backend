export type IndexStatus = 'PENDING' | 'INDEXING' | 'COMPLETED' | 'FAILED';
export type AnalysisStatus = 'PENDING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type FindingCategory = 'LOGIC_ERROR' | 'SECURITY' | 'ARCHITECTURAL' | 'TEST_GAP' | 'PERFORMANCE';

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  description: string;
  isPrivate: boolean;
  indexStatus: IndexStatus;
  indexedCommitSha?: string;
  indexingStartedAt?: string;
  indexingError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodeChunk {
  id: string;
  repositoryId: string;
  commitSha?: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  symbolName: string;
  symbolType: 'class' | 'function' | 'interface' | 'method' | 'block' | 'file';
  content: string;
  embedding?: number[];
  similarity?: number;
  createdAt?: string;
}

export interface ExtractedClass {
  name: string;
  kind?: string;
  startLine: number;
  endLine: number;
  annotations?: string[];
  methods?: ExtractedMethod[];
}

export interface ExtractedMethod {
  name: string;
  signature?: string;
  startLine: number;
  endLine: number;
  className?: string;
  parameters?: string[];
  returnType?: string;
  calledMethods?: string[];
}

export interface CodeStructure {
  id?: string;
  repositoryId: string;
  commitSha?: string;
  filePath: string;
  language: string;
  packageName?: string;
  imports?: string[];
  classes: ExtractedClass[];
  methods: ExtractedMethod[];
  functions?: ExtractedMethod[];
  exports?: string[];
  indexedAt?: Date;
}

export interface PullRequestAnalysis {
  id: string;
  repositoryId?: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  baseSha: string;
  headSha: string;
  status: AnalysisStatus;
  overallResult?: string; // 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENT'
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  summaryText?: string;
  limitations?: string;
  errorMessage?: string;
  structuralAnalysisAvailable?: boolean;
  createdAt: string;
}

export interface PrFinding {
  id: string;
  analysisId: string;
  severity: Severity;
  category: FindingCategory;
  title: string;
  filePath: string;
  lineRange: string;
  startLine?: number;
  confidence: number;
  description: string;
  diffSnippet?: string;
  evidence?: string;
  suggestedFix?: string;
  impactExplanation?: string;
  impact?: string;
  testRecipe?: string;
  recommendedTest?: string;
}

export interface AffectedFile {
  filePath: string;
  additions: number;
  deletions: number;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedMethods?: string[];
  status?: string;
}

export interface CallerDependency {
  callerClass: string;
  callerMethod: string;
  calledSymbol: string;
  evidence: string;
  isConfirmed?: boolean;
  relationshipTier?: 'CONFIRMED' | 'TRANSITIVE' | 'INFERRED' | 'UNRESOLVED';
  dependencyType?: 'CONFIRMED' | 'TRANSITIVE' | 'INFERRED' | 'UNRESOLVED';
  componentType?: 'CONTROLLER' | 'SERVICE' | 'REPOSITORY' | 'UTILITY' | 'API_CONSUMER' | 'TEST' | 'COMPONENT' | string;
  filePath?: string;
  depth?: number;
}

export interface RelevantTest {
  testFilePath: string;
  testClassName: string;
  testMethods: string[];
  isDirectCoverage?: boolean;
}

export interface BehaviorRisk {
  component: string;
  risk: string;
  rationale: string;
  missingTest?: boolean;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence?: number;
}

export interface BehaviorChange {
  file?: string;
  filePath?: string;
  symbol?: string;
  symbolName?: string;
  oldBehavior?: string;
  previousBehavior?: string;
  newBehavior?: string;
  changeType: 'SIGNATURE' | 'LOGIC' | 'RETURN_VALUE' | 'EXCEPTION' | 'VALIDATION' | 'EXPORT_REMOVED' | 'NEW_SYMBOL' | string;
  isBreaking: boolean;
  reason?: string;
  description?: string;
}

export interface AffectedCaller {
  component?: string;
  componentType?: 'CONTROLLER' | 'SERVICE' | 'REPOSITORY' | 'UTILITY' | 'API_CONSUMER' | 'TEST' | 'COMPONENT' | string;
  filePath: string;
  callerSymbol?: string;
  callerMethod?: string;
  callerClass?: string;
  relationshipTier?: 'CONFIRMED' | 'TRANSITIVE' | 'INFERRED' | 'UNRESOLVED';
  dependencyType?: 'CONFIRMED' | 'TRANSITIVE' | 'INFERRED' | 'UNRESOLVED';
  depth?: number;
  evidence: string;
  reason?: string;
}

export interface SymbolImpactRecord {
  id?: string;
  changedFile?: string;
  file?: string;
  symbol: string;
  changeType?: 'MODIFIED' | 'ADDED' | 'DELETED' | 'SIGNATURE_CHANGED' | 'CONTRACT_CHANGED' | string;
  changeDescription?: string;
  previousBehavior: string;
  newBehavior: string;
  affectedCallers: AffectedCaller[];
  runtimeBusinessEffect?: string;
  runtimeEffect: string;
  breakingChanges?: string;
  potentialBreakingChanges?: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number | 'HIGH' | 'MEDIUM' | 'LOW';
  supportingReferences?: any[];
  recommendedTests?: string[];
  recommendedRegressionTests?: string[];
  verificationStatus?: 'VERIFIED' | 'INFERRED' | 'UNKNOWN';
  isVerified?: 'VERIFIED' | 'INFERRED' | 'UNKNOWN';
}

export interface DependencyNode {
  id: string;
  label: string;
  file: string;
  type: 'CHANGED_SYMBOL' | 'DIRECT_CALLER' | 'TRANSITIVE_CALLER' | 'INFERRED_CALLER' | 'TEST';
  riskLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DependencyEdge {
  source: string;
  target: string;
  tier?: 'CONFIRMED' | 'TRANSITIVE' | 'INFERRED' | 'UNRESOLVED' | string;
  relationship?: 'CONFIRMED' | 'TRANSITIVE' | 'INFERRED' | 'UNRESOLVED' | string;
  evidence?: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface PrImpactReport {
  analysisId: string;
  pullRequestId?: string;
  repositoryId?: string;
  headSha?: string;
  changedFiles?: AffectedFile[];
  affectedFiles: AffectedFile[];
  callerHierarchy: CallerDependency[];
  relevantTests: RelevantTest[];
  behaviorRisks: BehaviorRisk[];
  structuralAnalysisAvailable?: boolean;
  symbolImpacts?: SymbolImpactRecord[];
  behaviorChanges?: BehaviorChange[];
  dependencyGraph?: DependencyGraph;
  overview?: string;
  limitations?: string;
}

export interface ParsedDiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  modifiedLines: number[];
  header: string;
  content: string;
}

export interface ParsedDiffFile {
  oldPath: string;
  newPath: string;
  status: 'MODIFIED' | 'ADDED' | 'DELETED';
  additions: number;
  deletions: number;
  modifiedLines: number[];
  hunks: ParsedDiffHunk[];
  affectedSymbols?: string[];
}

export interface ChatSession {
  id: string;
  repositoryId: string;
  title: string;
  createdAt: string;
}

export interface ChatCitation {
  filePath: string;
  lineRange: string;
  symbolName?: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  citations: ChatCitation[];
  createdAt: string;
}

export interface User {
  id: string;
  githubId: string;
  login: string;
  name?: string;
  email?: string | null;
  avatarUrl?: string;
  accessToken?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt?: string;
}
