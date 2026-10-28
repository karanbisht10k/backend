package devPilot.backend.services.review;

import java.util.List;

public class ReviewModels {

    public record ReviewAnalysisResultDto(
            String overallResult,
            String summary,
            String limitations,
            List<FindingDto> findings) {
    }

    public record FindingDto(
            String severity,
            String category,
            String title,
            String filePath,
            Integer startLine,
            Integer endLine,
            String description,
            String evidence,
            String impact,
            String suggestedFix,
            String recommendedTest,
            String confidence) {
    }
}
