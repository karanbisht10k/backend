package devPilot.backend.services.impact;

import java.util.List;

public class ImpactModels {

    public record PrImpactReportDto(
            List<ChangedFileDto> changedFiles,
            List<AffectedComponentDto> affectedComponents,
            List<CallerHierarchyDto> callerHierarchy,
            List<RelevantTestDto> relevantTests,
            List<BehaviorRiskDto> behaviorRisks,
            List<String> recommendations) {
    }

    public record ChangedFileDto(
            String filePath,
            String status,
            int additions,
            int deletions,
            List<Integer> modifiedLines,
            List<String> affectedMethods) {
    }

    public record AffectedComponentDto(
            String className,
            String filePath,
            String role,
            List<String> methodsAffected) {
    }

    public record CallerHierarchyDto(
            String callerFilePath,
            String callerClass,
            String callerMethod,
            String calledSymbol,
            boolean confirmed,
            String evidence) {
    }

    public record RelevantTestDto(
            String testFilePath,
            String testClassName,
            List<String> testMethods,
            boolean directlyCovers) {
    }

    public record BehaviorRiskDto(
            String risk,
            String rationale,
            String component,
            boolean uncertain) {
    }
}
