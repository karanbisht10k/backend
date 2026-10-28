import { githubService } from '../services/github.service.js';
import { diffAnalysisService } from '../services/diff.service.js';

async function verifyGitHubLive() {
  console.log('===============================================================');
  console.log('🐙 GitHub Live Read-Only Integration Verification');
  console.log('===============================================================\n');

  // Check token authentication mode
  const tokenConfigured = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim().length > 0);
  console.log(`Authentication Mode: ${tokenConfigured ? 'Authenticated (Token Configured)' : 'Unauthenticated (Public API with standard rate-limit)'}`);

  const owner = 'expressjs';
  const repo = 'express';
  const prNumber = 7567;

  console.log(`\n1. Fetching Pull Request metadata for ${owner}/${repo}#${prNumber}...`);
  const pr = await githubService.getPullRequest(owner, repo, prNumber);

  console.log(`   PR Number : #${pr.prNumber}`);
  console.log(`   PR Title  : ${pr.title}`);
  console.log(`   Base SHA  : ${pr.baseSha}`);
  console.log(`   Head SHA  : ${pr.headSha}`);
  console.log(`   Diff Size : ${pr.diff.length} bytes`);
  console.log(`   Diff Preview:\n${pr.diff.split('\n').slice(0, 8).map(l => '     ' + l).join('\n')}`);

  // Parse diff to discover modified files
  const parsedFiles = diffAnalysisService.parseUnifiedDiff(pr.diff);
  console.log(`\n2. Parsed Diff Files: ${parsedFiles.length} file(s)`);
  for (const f of parsedFiles) {
    console.log(`   - File: ${f.newPath} (Status: ${f.status}, +${f.additions}, -${f.deletions}, modified lines: [${f.modifiedLines.join(', ')}])`);
  }

  // Retrieve actual base and head file content at explicit commit SHAs
  if (parsedFiles.length > 0) {
    const targetFile = parsedFiles[0].newPath;
    console.log(`\n3. Verifying exact revision content retrieval for "${targetFile}"...`);

    const revisionsResult = await githubService.getFileContentAtRevisions(
      owner,
      repo,
      targetFile,
      pr.baseSha,
      pr.headSha,
      parsedFiles[0].status
    );

    console.log(`   Base Revision (${pr.baseSha.substring(0, 7)}) Available : ${revisionsResult.isBaseAvailable}`);
    console.log(`   Head Revision (${pr.headSha.substring(0, 7)}) Available : ${revisionsResult.isHeadAvailable}`);

    if (revisionsResult.baseContent) {
      console.log(`   Base Content Length : ${revisionsResult.baseContent.length} chars`);
    }
    if (revisionsResult.headContent) {
      console.log(`   Head Content Length : ${revisionsResult.headContent.length} chars`);
    }

    if (revisionsResult.isBaseAvailable && revisionsResult.isHeadAvailable) {
      console.log('\n   ✅ Base and Head contents successfully retrieved at exact PR commit SHAs without checking out local branches.');
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 GitHub Read-Only API Smoke Test Completed Successfully');
  console.log('===============================================================\n');
}

verifyGitHubLive().catch((err) => {
  console.error('❌ GitHub Verification Error:', err.message);
  process.exit(1);
});
