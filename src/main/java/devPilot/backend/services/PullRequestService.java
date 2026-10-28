package devPilot.backend.services;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;

import devPilot.backend.dto.AnalyzePrRequest;
import devPilot.backend.dto.PrAnalysisResponse;
import devPilot.backend.dto.PrFindingResponse;
import devPilot.backend.dto.RepositoryResponse;
import devPilot.backend.entity.AnalysisStatus;
import devPilot.backend.entity.FindingCategory;
import devPilot.backend.entity.FindingSeverity;
import devPilot.backend.entity.PrFinding;
import devPilot.backend.entity.PrImpactReportEntity;
import devPilot.backend.entity.PullRequestAnalysis;
import devPilot.backend.entity.Repository;
import devPilot.backend.entity.User;
import devPilot.backend.exceptions.BadRequestException;
import devPilot.backend.exceptions.NotFoundException;
import devPilot.backend.repository.PrFindingRepository;
import devPilot.backend.repository.PrImpactReportRepository;
import devPilot.backend.repository.PullRequestAnalysisRepository;
import devPilot.backend.repository.RepositoryRepository;
import devPilot.backend.services.github.GitHubUrlParser;
import devPilot.backend.services.github.GitHubUrlParser.ParsedPullRequest;
import devPilot.backend.services.github.GithubApiClient;
import devPilot.backend.services.impact.ChangeImpactService;
import devPilot.backend.services.impact.ImpactModels.PrImpactReportDto;
import devPilot.backend.services.review.PrReviewEngine;
import devPilot.backend.services.review.ReviewModels.FindingDto;
import devPilot.backend.services.review.ReviewModels.ReviewAnalysisResultDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class PullRequestService {

    private final PullRequestAnalysisRepository analysisRepository;
    private final PrFindingRepository findingRepository;
    private final PrImpactReportRepository impactReportRepository;
    private final RepositoryRepository repositoryRepository;
    private final RepoService repoService;
    private final UserService userService;
    private final GithubApiClient gitHubApiClient;
    private final ChangeImpactService changeImpactService;
    private final PrReviewEngine prReviewEngine;
    private final ObjectMapper objectMapper;

    @Transactional
    public PrAnalysisResponse startAnalysis(UUID userId, AnalyzePrRequest request) {
        ParsedPullRequest parsedPr = GitHubUrlParser.parsePullRequestUrl(request.pullRequestUrl());

        Repository repo;
        if (request.repositoryId() != null) {
            repo = repoService.requireOwned(request.repositoryId(), userId);
            if (!repo.getOwner().equalsIgnoreCase(parsedPr.owner()) || !repo.getName().equalsIgnoreCase(parsedPr.repo())) {
                throw new BadRequestException("PR belongs to " + parsedPr.repoFullName() +
                        ", which does not match selected repository: " + repo.getFullName());
            }
        } else {
            // Find existing repository or automatically import it
            repo = repositoryRepository.findByUserIdOrderByFullNameAsc(userId).stream()
                    .filter(r -> r.getOwner().equalsIgnoreCase(parsedPr.owner()) && r.getName().equalsIgnoreCase(parsedPr.repo()))
                    .findFirst()
                    .orElseGet(() -> {
                        RepositoryResponse imported = repoService.importPublicRepo(
                                userId, "https://github.com/" + parsedPr.repoFullName());
                        return repoService.requireOwned(imported.id(), userId);
                    });
        }

        PullRequestAnalysis analysis = PullRequestAnalysis.builder()
                .repositoryId(repo.getId())
                .userId(userId)
                .prNumber(parsedPr.pullNumber())
                .prUrl(request.pullRequestUrl().trim())
                .status(AnalysisStatus.PROCESSING)
                .build();

        PullRequestAnalysis saved = analysisRepository.save(analysis);
        return toResponse(saved);
    }

    @Async("indexingExecutor")
    public void analyzeAsync(UUID analysisId, UUID userId) {
        try {
            doAnalyze(analysisId, userId);
        } catch (Exception ex) {
            log.error("PR analysis failed for analysisId {}", analysisId, ex);
            markAnalysisFailed(analysisId, ex.getMessage());
        }
    }

    private void doAnalyze(UUID analysisId, UUID userId) {
        PullRequestAnalysis analysis = analysisRepository.findById(analysisId)
                .orElseThrow(() -> new NotFoundException("Analysis record not found"));

        Repository repo = repositoryRepository.findById(analysis.getRepositoryId())
                .orElseThrow(() -> new NotFoundException("Repository not found"));

        String token = null;
        try {
            User user = userService.requiredById(userId);
            if (user.getAccessToken() != null && !user.getAccessToken().isBlank()) {
                token = userService.decryptAccessToken(user);
            }
        } catch (Exception ex) {
            log.debug("Using public client for PR analysis: {}", ex.getMessage());
        }

        // 1. Fetch Pull Request metadata
        Map<String, Object> prData = gitHubApiClient.getPullRequest(
                token, repo.getOwner(), repo.getName(), analysis.getPrNumber());

        String prTitle = String.valueOf(prData.get("title"));
        String baseSha = extractSha(prData.get("base"));
        String headSha = extractSha(prData.get("head"));

        analysis.setPrTitle(prTitle);
        analysis.setBaseSha(baseSha);
        analysis.setHeadSha(headSha);
        analysisRepository.save(analysis);

        // 2. Fetch Changed Files and Diff
        List<Map<String, Object>> changedFilesRaw = gitHubApiClient.getPullRequestFiles(
                token, repo.getOwner(), repo.getName(), analysis.getPrNumber());
        String diffContent = gitHubApiClient.getPullRequestDiff(
                token, repo.getOwner(), repo.getName(), analysis.getPrNumber());

        // 3. Evidence-Backed Change-Impact Analysis
        PrImpactReportDto impactReport = changeImpactService.analyzeImpact(repo.getId(), changedFilesRaw);

        // Persist Impact Report
        try {
            impactReportRepository.deleteByAnalysisId(analysisId);
            String impactJson = objectMapper.writeValueAsString(impactReport);
            impactReportRepository.save(PrImpactReportEntity.builder()
                    .analysisId(analysisId)
                    .impactJson(impactJson)
                    .build());
        } catch (Exception ex) {
            log.warn("Failed to serialize impact report: {}", ex.getMessage());
        }

        // 4. Run AI PR Review Engine
        ReviewAnalysisResultDto reviewResult = prReviewEngine.reviewPullRequest(
                repo.getFullName(), prTitle, diffContent, impactReport);

        // 5. Persist Findings
        findingRepository.deleteByAnalysisId(analysisId);
        int critical = 0, high = 0, medium = 0, low = 0, info = 0;

        for (FindingDto f : reviewResult.findings()) {
            FindingSeverity severity = parseSeverity(f.severity());
            FindingCategory category = parseCategory(f.category());

            switch (severity) {
                case CRITICAL -> critical++;
                case HIGH -> high++;
                case MEDIUM -> medium++;
                case LOW -> low++;
                case INFO -> info++;
            }

            PrFinding finding = PrFinding.builder()
                    .analysisId(analysisId)
                    .severity(severity)
                    .category(category)
                    .title(f.title())
                    .filePath(f.filePath())
                    .startLine(f.startLine())
                    .endLine(f.endLine())
                    .description(f.description())
                    .evidence(f.evidence())
                    .impact(f.impact())
                    .suggestedFix(f.suggestedFix())
                    .recommendedTest(f.recommendedTest())
                    .confidence(f.confidence())
                    .build();

            findingRepository.save(finding);
        }

        // 6. Complete Analysis Record
        analysis.setStatus(AnalysisStatus.COMPLETED);
        analysis.setOverallResult(reviewResult.overallResult());
        analysis.setCriticalCount(critical);
        analysis.setHighCount(high);
        analysis.setMediumCount(medium);
        analysis.setLowCount(low);
        analysis.setInfoCount(info);
        analysis.setSummaryText(reviewResult.summary());
        analysis.setLimitations(reviewResult.limitations());
        analysis.setErrorMessage(null);
        analysis.setCompletedAt(Instant.now());
        analysisRepository.save(analysis);

        log.info("PR analysis completed for PR #{} ({}) with {} findings",
                analysis.getPrNumber(), repo.getFullName(), reviewResult.findings().size());
    }

    @Transactional(readOnly = true)
    public PrAnalysisResponse getAnalysis(UUID analysisId, UUID userId) {
        PullRequestAnalysis analysis = analysisRepository.findByIdAndUserId(analysisId, userId)
                .orElseThrow(() -> new NotFoundException("Analysis record not found"));
        return toResponse(analysis);
    }

    @Transactional(readOnly = true)
    public PrImpactReportDto getImpactReport(UUID analysisId, UUID userId) {
        analysisRepository.findByIdAndUserId(analysisId, userId)
                .orElseThrow(() -> new NotFoundException("Analysis record not found"));

        return impactReportRepository.findByAnalysisId(analysisId)
                .map(entity -> {
                    try {
                        return objectMapper.readValue(entity.getImpactJson(), PrImpactReportDto.class);
                    } catch (Exception ex) {
                        log.error("Failed to deserialize impact report for analysis {}", analysisId, ex);
                        return null;
                    }
                })
                .orElseThrow(() -> new NotFoundException("Impact report not found for analysis: " + analysisId));
    }

    @Transactional(readOnly = true)
    public List<PrFindingResponse> getFindings(UUID analysisId, UUID userId) {
        analysisRepository.findByIdAndUserId(analysisId, userId)
                .orElseThrow(() -> new NotFoundException("Analysis record not found"));

        return findingRepository.findByAnalysisIdOrderBySeverityAscCreatedAtAsc(analysisId).stream()
                .map(this::toFindingResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PrAnalysisResponse> listByRepository(UUID repositoryId, UUID userId) {
        repoService.requireOwned(repositoryId, userId);
        return analysisRepository.findByRepositoryIdOrderByCreatedAtDesc(repositoryId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    protected void markAnalysisFailed(UUID analysisId, String message) {
        analysisRepository.findById(analysisId).ifPresent(analysis -> {
            analysis.setStatus(AnalysisStatus.FAILED);
            analysis.setErrorMessage(message != null && message.length() > 2000
                    ? message.substring(0, 2000)
                    : message);
            analysis.setCompletedAt(Instant.now());
            analysisRepository.save(analysis);
        });
    }

    public PrAnalysisResponse toResponse(PullRequestAnalysis a) {
        return new PrAnalysisResponse(
                a.getId(),
                a.getRepositoryId(),
                a.getPrNumber(),
                a.getPrUrl(),
                a.getPrTitle(),
                a.getBaseSha(),
                a.getHeadSha(),
                a.getStatus(),
                a.getOverallResult(),
                a.getCriticalCount(),
                a.getHighCount(),
                a.getMediumCount(),
                a.getLowCount(),
                a.getInfoCount(),
                a.getSummaryText(),
                a.getLimitations(),
                a.getErrorMessage(),
                a.getCreatedAt(),
                a.getCompletedAt());
    }

    private PrFindingResponse toFindingResponse(PrFinding f) {
        return new PrFindingResponse(
                f.getId(),
                f.getAnalysisId(),
                f.getSeverity(),
                f.getCategory(),
                f.getTitle(),
                f.getFilePath(),
                f.getStartLine(),
                f.getEndLine(),
                f.getDescription(),
                f.getEvidence(),
                f.getImpact(),
                f.getSuggestedFix(),
                f.getRecommendedTest(),
                f.getConfidence(),
                f.getCreatedAt());
    }

    private String extractSha(Object commitRefObj) {
        if (commitRefObj instanceof Map<?, ?> map && map.get("sha") != null) {
            return String.valueOf(map.get("sha"));
        }
        return null;
    }

    private FindingSeverity parseSeverity(String sev) {
        try {
            return FindingSeverity.valueOf(sev.toUpperCase());
        } catch (Exception ex) {
            return FindingSeverity.MEDIUM;
        }
    }

    private FindingCategory parseCategory(String cat) {
        try {
            return FindingCategory.valueOf(cat.toUpperCase());
        } catch (Exception ex) {
            return FindingCategory.LOGIC_ERROR;
        }
    }
}
