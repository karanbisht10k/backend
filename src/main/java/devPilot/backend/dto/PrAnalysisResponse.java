package devPilot.backend.dto;

import java.time.Instant;
import java.util.UUID;

import devPilot.backend.entity.AnalysisStatus;

public record PrAnalysisResponse(
        UUID id,
        UUID repositoryId,
        int prNumber,
        String prUrl,
        String prTitle,
        String baseSha,
        String headSha,
        AnalysisStatus status,
        String overallResult,
        int criticalCount,
        int highCount,
        int mediumCount,
        int lowCount,
        int infoCount,
        String summaryText,
        String limitations,
        String errorMessage,
        Instant createdAt,
        Instant completedAt) {
}
