package devPilot.backend.dto;

import java.time.Instant;
import java.util.UUID;

import devPilot.backend.entity.FindingCategory;
import devPilot.backend.entity.FindingSeverity;

public record PrFindingResponse(
        UUID id,
        UUID analysisId,
        FindingSeverity severity,
        FindingCategory category,
        String title,
        String filePath,
        Integer startLine,
        Integer endLine,
        String description,
        String evidence,
        String impact,
        String suggestedFix,
        String recommendedTest,
        String confidence,
        Instant createdAt) {
}
