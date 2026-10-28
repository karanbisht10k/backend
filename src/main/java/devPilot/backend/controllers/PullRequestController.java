package devPilot.backend.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import devPilot.backend.dto.AnalyzePrRequest;
import devPilot.backend.dto.PrAnalysisResponse;
import devPilot.backend.dto.PrFindingResponse;
import devPilot.backend.security.CurrentUser;
import devPilot.backend.services.PullRequestService;
import devPilot.backend.services.impact.ImpactModels.PrImpactReportDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/pull-requests")
@RequiredArgsConstructor
public class PullRequestController {

    private final CurrentUser currentUser;
    private final PullRequestService pullRequestService;

    @PostMapping("/analyze")
    public ResponseEntity<PrAnalysisResponse> analyze(@Valid @RequestBody AnalyzePrRequest request) {
        UUID userId = currentUser.require().getId();
        PrAnalysisResponse initial = pullRequestService.startAnalysis(userId, request);
        pullRequestService.analyzeAsync(initial.id(), userId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(initial);
    }

    @GetMapping("/analyses/{analysisId}")
    public PrAnalysisResponse getAnalysis(@PathVariable UUID analysisId) {
        UUID userId = currentUser.require().getId();
        return pullRequestService.getAnalysis(analysisId, userId);
    }

    @GetMapping("/analyses/{analysisId}/impact")
    public PrImpactReportDto getImpact(@PathVariable UUID analysisId) {
        UUID userId = currentUser.require().getId();
        return pullRequestService.getImpactReport(analysisId, userId);
    }

    @GetMapping("/analyses/{analysisId}/findings")
    public List<PrFindingResponse> getFindings(@PathVariable UUID analysisId) {
        UUID userId = currentUser.require().getId();
        return pullRequestService.getFindings(analysisId, userId);
    }

    @GetMapping("/repository/{repositoryId}")
    public List<PrAnalysisResponse> listByRepository(@PathVariable UUID repositoryId) {
        UUID userId = currentUser.require().getId();
        return pullRequestService.listByRepository(repositoryId, userId);
    }
}
