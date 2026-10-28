import path from 'node:path';
import { db } from '../db/pgvector.js';
import { githubService } from './github.service.js';
import { embeddingService } from './embedding.service.js';
import { geminiService } from './gemini.service.js';
import { diffAnalysisService } from './diff.service.js';
import { codeChunkerService } from './chunker.service.js';
import { PullRequestAnalysis, PrFinding, PrImpactReport, CodeStructure } from '../types/index.js';

export class ReviewService {
  /**
   * Initiates PR Review pipeline
   */
  async startAnalysis(pullRequestUrl: string, repositoryId?: string): Promise<PullRequestAnalysis> {
    const parsed = githubService.parseGitHubUrl(pullRequestUrl);
    if (parsed.type !== 'PULL_REQUEST' || !parsed.prNumber) {
      throw new Error('Provided URL is not a valid GitHub Pull Request URL.');
    }

    const repoFullName = `${parsed.owner}/${parsed.repo}`;
    const resolvedRepoId = repositoryId || repoFullName;

    // Ensure repository exists in DB
    const existingRepo = await db.getRepositoryById(resolvedRepoId);
    if (!existingRepo) {
      const details = await githubService.getRepoDetails(parsed.owner, parsed.repo);
      await db.upsertRepository({
        id: resolvedRepoId,
        name: details.name,
        fullName: details.fullName,
        url: details.url,
        defaultBranch: details.defaultBranch,
        description: details.description,
        isPrivate: details.isPrivate,
        indexStatus: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    const analysisId = `pr-${parsed.prNumber}-${Date.now()}`;
    const initialAnalysis: PullRequestAnalysis = {
      id: analysisId,
      repositoryId: resolvedRepoId,
      prNumber: parsed.prNumber,
      prTitle: `Analyzing PR #${parsed.prNumber}...`,
      prUrl: parsed.canonicalUrl,
      baseSha: '',
      headSha: '',
      status: 'ANALYZING',
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      createdAt: new Date().toISOString()
    };

    await db.savePullRequestAnalysis(initialAnalysis);

    // Run review pipeline asynchronously
    (async () => {
      try {
        console.log(`🔍 [Review Engine] Fetching metadata and diff for PR #${parsed.prNumber}...`);
        const pr = await githubService.getPullRequest(parsed.owner, parsed.repo, parsed.prNumber!);

        // 1. Fetch Repository AST Structural Skeleton
        console.log(`🏛️ [Review Engine] Loading AST structures for repository ${resolvedRepoId} (baseSha: ${pr.baseSha || 'latest'})...`);
        let structures: CodeStructure[] = await db.getCodeStructures(resolvedRepoId, pr.baseSha);
        if (structures.length === 0 && pr.headSha) {
          structures = await db.getCodeStructures(resolvedRepoId, pr.headSha);
        }
        if (structures.length === 0) {
          structures = await db.getCodeStructures(resolvedRepoId);
        }

        const repoFullyIndexed = structures.length > 0;

        // 2. Parse Unified Diff into structured hunks and modified line ranges
        console.log(`📄 [Review Engine] Parsing unified diff lines and hunks...`);
        const changedDiffFiles = diffAnalysisService.parseUnifiedDiff(pr.diff);

        // If target revision is unindexed, extract ad-hoc AST for changed files at head commit
        if (!repoFullyIndexed && parsed.owner && parsed.repo) {
          console.log(`📥 [Review Engine] Revision unindexed. Extracting ad-hoc AST for changed files at head ${pr.headSha}...`);
          try {
            const fetchPromises = changedDiffFiles.map(async (file) => {
              try {
                const fileRes = await githubService.getFileContentAtCommit(parsed.owner, parsed.repo, file.newPath, pr.headSha);
                if (fileRes.isAvailable && fileRes.content) {
                  const ext = path.extname(file.newPath).toLowerCase();
                  const language = ext.includes('ts') ? 'typescript' : ext.includes('js') ? 'javascript' : ext.includes('java') ? 'java' : ext.includes('py') ? 'python' : 'text';
                  return codeChunkerService.extractStructure(resolvedRepoId, file.newPath, fileRes.content, language, pr.headSha);
                }
              } catch {
                // Ignore individual file retrieval errors
              }
              return null;
            });
            const fetched = await Promise.all(fetchPromises);
            const adHocStructures = fetched.filter((s): s is CodeStructure => s !== null);
            if (adHocStructures.length > 0) {
              structures = adHocStructures;
              console.log(`✅ [Review Engine] Extracted ${adHocStructures.length} ad-hoc structures in parallel for modified files.`);
            }
          } catch (adHocErr: any) {
            console.warn(`⚠️ [Review Engine] Ad-hoc AST extraction warning: ${adHocErr.message}`);
          }
        }

        const structuralAnalysisAvailable = structures.length > 0;

        // 3. Map changed lines to AST symbols (classes, methods, functions)
        console.log(`🗺️ [Review Engine] Correlating modified lines with AST symbols...`);
        const { affectedFiles, affectedSymbolsByFile } = diffAnalysisService.mapChangedLinesToSymbols(
          changedDiffFiles,
          structures
        );

        // 4. Trace confirmed downstream callers (direct depth 1 and transitive depth 2)
        console.log(`🔗 [Review Engine] Tracing direct and transitive downstream callers...`);
        const confirmedCallers = structuralAnalysisAvailable
          ? diffAnalysisService.traceStructuralCallers(affectedSymbolsByFile, structures, 2)
          : [];

        // 5. Discover existing tests and flag missing coverage gaps
        console.log(`🧪 [Review Engine] Discovering existing tests and analyzing coverage gaps...`);
        const { relevantTests, behaviorRisks } = structuralAnalysisAvailable
          ? diffAnalysisService.findRelevantTests(affectedSymbolsByFile, structures)
          : { relevantTests: [], behaviorRisks: [] };

        if (!repoFullyIndexed) {
          behaviorRisks.unshift({
            component: 'Repository Structural Index',
            risk: 'Repository structural index is missing or partial for this revision',
            rationale: 'Cross-repo callers could not be fully verified statically. Do not interpret empty caller/test lists as absence of dependencies.',
            missingTest: false
          });
        }

        // 6. Detect semantic behavior changes (signatures, exports, return values, exceptions, validations, logic)
        console.log(`🔬 [Review Engine] Analyzing semantic behavior changes between revisions...`);
        const behaviorChanges = diffAnalysisService.detectSemanticBehaviorChanges(
          changedDiffFiles,
          structures
        );

        // 7. Generate grounded symbol impact records
        console.log(`📊 [Review Engine] Generating structured symbol impact records...`);
        const rawSymbolImpacts = diffAnalysisService.generateSymbolImpactRecords(
          affectedFiles,
          confirmedCallers,
          behaviorChanges,
          relevantTests
        );

        // 8. Build dependency graph
        console.log(`🕸️ [Review Engine] Constructing dependency graph...`);
        const dependencyGraph = diffAnalysisService.buildDependencyGraph(
          affectedFiles,
          confirmedCallers,
          relevantTests,
          rawSymbolImpacts
        );

        // 9. Detect dominant language and test framework
        const frameworkInfo = diffAnalysisService.detectRepositoryLanguageAndFramework(structures);

        // 10. Vector Search for INFERRED semantic neighbors (explicitly separated from callers)
        const providerName = embeddingService.getActiveProvider().toUpperCase();
        console.log(`🧠 [Review Engine] Generating ${providerName} query vector for semantic codebase context...`);
        const querySnippet = pr.diff.substring(0, 1500) || pr.title;
        const queryVector = await embeddingService.embedQuery(querySnippet);

        console.log(`⚡ [Review Engine] Querying PGVector for domain context chunks...`);
        const relevantChunks = await db.searchSimilarChunks(resolvedRepoId, queryVector, 8, pr.baseSha || pr.headSha);

        // 11. Grounded AI PR Review (Gemini with heuristic fallback)
        console.log(`🤖 [Review Engine] Executing grounded multi-dimensional review...`);
        const review = await geminiService.reviewPullRequest({
          prTitle: pr.title,
          prNumber: pr.prNumber,
          prUrl: pr.prUrl,
          diff: pr.diff,
          relevantChunks,
          confirmedCallers,
          relevantTests,
          behaviorRisks,
          affectedFiles,
          frameworkInfo,
          behaviorChanges,
          symbolImpacts: rawSymbolImpacts
        });

        // 12. Validate and sanitize findings against actual diff and repo paths
        const validatedFindings = diffAnalysisService.validateAndSanitizeFindings(
          review.findings,
          changedDiffFiles,
          structures
        );

        const findingsWithIds: PrFinding[] = validatedFindings.map((f, i) => ({
          ...f,
          id: f.id || `finding-${analysisId}-${i + 1}`,
          analysisId
        }));
        await db.savePrFindings(analysisId, findingsWithIds);

        // 13. Sanitize symbol impacts against actual files/symbols to guarantee grounding
        const validFiles = new Set(affectedFiles.map((f) => f.filePath));
        const validSymbols = new Set<string>();
        for (const s of affectedSymbolsByFile.values()) {
          s.classes.forEach((c) => validSymbols.add(c));
          s.methods.forEach((m) => validSymbols.add(m));
        }

        const symbolImpacts = diffAnalysisService.sanitizeSymbolImpacts(
          review.impactReport.symbolImpacts || rawSymbolImpacts,
          validFiles,
          validSymbols
        );

        // 14. Persist complete impact report
        const indexLimitation = !repoFullyIndexed
          ? 'Repository structural AST index is missing for this revision. Callers across the wider repository could not be verified statically. Do not interpret empty caller/test lists as absence of dependencies.\n'
          : '';

        const impactReport: PrImpactReport = {
          analysisId,
          repositoryId: resolvedRepoId,
          headSha: pr.headSha,
          changedFiles: affectedFiles,
          affectedFiles,
          callerHierarchy: review.impactReport.callerHierarchy || confirmedCallers,
          relevantTests: review.impactReport.relevantTests || relevantTests,
          behaviorRisks: review.impactReport.behaviorRisks || behaviorRisks,
          structuralAnalysisAvailable,
          symbolImpacts,
          behaviorChanges: review.impactReport.behaviorChanges || behaviorChanges,
          dependencyGraph: review.impactReport.dependencyGraph || dependencyGraph,
          overview: review.overview || review.summaryText,
          limitations: indexLimitation + (review.limitations || '')
        };
        await db.savePrImpact(impactReport);

        // 15. Update Analysis status to COMPLETED
        const completedAnalysis: PullRequestAnalysis = {
          ...initialAnalysis,
          prTitle: pr.title,
          baseSha: pr.baseSha,
          headSha: pr.headSha,
          status: 'COMPLETED',
          overallResult: review.overallResult,
          criticalCount: findingsWithIds.filter((f) => f.severity === 'CRITICAL').length,
          highCount: findingsWithIds.filter((f) => f.severity === 'HIGH').length,
          mediumCount: findingsWithIds.filter((f) => f.severity === 'MEDIUM').length,
          lowCount: findingsWithIds.filter((f) => f.severity === 'LOW').length,
          infoCount: findingsWithIds.filter((f) => f.severity === 'INFO').length,
          summaryText: !repoFullyIndexed
            ? `[⚠️ Index Partial/Ad-hoc] ${review.summaryText}`
            : review.summaryText,
          limitations: indexLimitation + (review.limitations || ''),
          structuralAnalysisAvailable
        };

        await db.savePullRequestAnalysis(completedAnalysis);
        console.log(`✅ [Review Engine] PR #${parsed.prNumber} analysis completed successfully!`);
      } catch (err: any) {
        console.error(`❌ [Review Engine] PR #${parsed.prNumber} review failed:`, err.message);
        await db.savePullRequestAnalysis({
          ...initialAnalysis,
          status: 'FAILED',
          errorMessage: err.message
        });
      }
    })();

    return initialAnalysis;
  }
}

export const reviewService = new ReviewService();

