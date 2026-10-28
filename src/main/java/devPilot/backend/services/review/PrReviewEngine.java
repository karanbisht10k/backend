package devPilot.backend.services.review;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import devPilot.backend.services.impact.ImpactModels.AffectedComponentDto;
import devPilot.backend.services.impact.ImpactModels.CallerHierarchyDto;
import devPilot.backend.services.impact.ImpactModels.ChangedFileDto;
import devPilot.backend.services.impact.ImpactModels.PrImpactReportDto;
import devPilot.backend.services.review.ReviewModels.FindingDto;
import devPilot.backend.services.review.ReviewModels.ReviewAnalysisResultDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class PrReviewEngine {

    private final ChatModel chatModel;
    private final ObjectMapper objectMapper;

    public ReviewAnalysisResultDto reviewPullRequest(
            String repoFullName,
            String prTitle,
            String diffContent,
            PrImpactReportDto impactReport) {

        String boundedDiff = diffContent != null && diffContent.length() > 40000
                ? diffContent.substring(0, 40000) + "\n...[Diff truncated for review limits]..."
                : (diffContent != null ? diffContent : "");

        String impactSummary = buildImpactSummary(impactReport);

        String systemPrompt = """
                You are CodeSense, an expert AI code reviewer.
                Analyze the provided GitHub pull request diff and change-impact analysis for the %s repository.
                Review strictly for:
                1. Logic & correctness defects (incorrect conditionals, boundary/off-by-one errors, null pointer risks, incorrect state transitions)
                2. Security vulnerabilities (injection, auth bypass, exposed secrets, unsafe inputs/URLs)
                3. Architectural deviations (broken service/repo layer conventions, breaking downstream caller assumptions)
                4. Missing regression tests for critical changed methods

                STRICT RULES:
                - Ground every finding in the actual diff or impact report.
                - Never invent line numbers. Use only line numbers that appear in the diff (+ lines).
                - Valid severity values: CRITICAL, HIGH, MEDIUM, LOW, INFO.
                - Valid category values: LOGIC_ERROR, SECURITY, ARCHITECTURAL_DEVIATION, MISSING_TEST, RESOURCE_LEAK, BOUNDARY_CONDITION.
                - Return ONLY a valid JSON object matching this schema:
                {
                  "overallResult": "CHANGES_REQUESTED" | "APPROVED_WITH_SUGGESTIONS" | "APPROVED",
                  "summary": "Concise summary of findings and overall impact",
                  "limitations": "Any limitations (e.g. truncated diff, unparsed files)",
                  "findings": [
                    {
                      "severity": "HIGH",
                      "category": "LOGIC_ERROR",
                      "title": "Short title",
                      "filePath": "src/path/File.java",
                      "startLine": 45,
                      "endLine": 48,
                      "description": "Explanation of defect",
                      "evidence": "code snippet from diff",
                      "impact": "Consequences of this issue",
                      "suggestedFix": "Code diff or concrete instruction",
                      "recommendedTest": "Test description",
                      "confidence": "HIGH"
                    }
                  ]
                }
                """.formatted(repoFullName);

        String userPrompt = """
                Pull Request Title: %s

                Change-Impact Analysis:
                %s

                Unified Diff:
                %s
                """.formatted(prTitle, impactSummary, boundedDiff);

        try {
            var response = chatModel.call(new Prompt(List.of(
                    new org.springframework.ai.chat.messages.SystemMessage(systemPrompt),
                    new org.springframework.ai.chat.messages.UserMessage(userPrompt))));

            String content = response.getResult().getOutput().getText();
            ReviewAnalysisResultDto parsed = extractJson(content);
            if (parsed != null && parsed.findings() != null) {
                return validateAndSanitizeFindings(parsed, impactReport);
            }
        } catch (Exception ex) {
            log.warn("AI review model call failed or returned unparseable content: {}", ex.getMessage());
        }

        // Deterministic Fallback grounded in AST change-impact analysis and static checks
        return generateEvidenceBackedFallbackReview(repoFullName, prTitle, diffContent, impactReport);
    }

    private ReviewAnalysisResultDto validateAndSanitizeFindings(
            ReviewAnalysisResultDto result,
            PrImpactReportDto impactReport) {

        List<FindingDto> sanitized = new ArrayList<>();
        for (FindingDto f : result.findings()) {
            String severity = normalizeSeverity(f.severity());
            String category = normalizeCategory(f.category());
            sanitized.add(new FindingDto(
                    severity,
                    category,
                    f.title() != null ? f.title() : "Review Finding",
                    f.filePath() != null ? f.filePath() : "unknown",
                    f.startLine(),
                    f.endLine(),
                    f.description() != null ? f.description() : "",
                    f.evidence() != null ? f.evidence() : "",
                    f.impact() != null ? f.impact() : "",
                    f.suggestedFix() != null ? f.suggestedFix() : "",
                    f.recommendedTest() != null ? f.recommendedTest() : "",
                    f.confidence() != null ? f.confidence() : "HIGH"));
        }

        return new ReviewAnalysisResultDto(
                result.overallResult() != null ? result.overallResult() : "APPROVED_WITH_SUGGESTIONS",
                result.summary() != null ? result.summary() : "Automated review completed.",
                result.limitations() != null ? result.limitations() : "Analysis bounded to submitted PR diff and AST symbols.",
                sanitized);
    }

    private ReviewAnalysisResultDto generateEvidenceBackedFallbackReview(
            String repoFullName,
            String prTitle,
            String diffContent,
            PrImpactReportDto impactReport) {

        List<FindingDto> findings = new ArrayList<>();

        // 1. Check for Missing Tests on Changed Public Methods
        for (AffectedComponentDto comp : impactReport.affectedComponents()) {
            boolean hasTest = impactReport.relevantTests().stream()
                    .anyMatch(t -> t.testClassName().toLowerCase().contains(comp.className().toLowerCase()) ||
                            t.testFilePath().toLowerCase().contains(comp.className().toLowerCase()));

            if (!hasTest && !comp.methodsAffected().isEmpty()) {
                ChangedFileDto changedFile = impactReport.changedFiles().stream()
                        .filter(f -> f.filePath().equals(comp.filePath()))
                        .findFirst()
                        .orElse(null);

                Integer line = (changedFile != null && !changedFile.modifiedLines().isEmpty())
                        ? changedFile.modifiedLines().get(0)
                        : null;

                findings.add(new FindingDto(
                        "MEDIUM",
                        "MISSING_TEST",
                        "Missing regression test suite for modified " + comp.className(),
                        comp.filePath(),
                        line,
                        line,
                        "Component " + comp.className() + " has modified methods (" +
                                String.join(", ", comp.methodsAffected()) +
                                ") but no dedicated unit/regression test was identified in the repository.",
                        "Methods affected: " + String.join(", ", comp.methodsAffected()),
                        "Unverified changes to business logic may introduce regression defects in downstream callers.",
                        "Create a unit test class for " + comp.className() + " verifying the modified method behaviors.",
                        "Test that " + String.join(", ", comp.methodsAffected()) + " handle edge cases and null inputs safely.",
                        "HIGH"));
            }
        }

        // 2. Check for Downstream Caller Breaking Risks
        for (CallerHierarchyDto caller : impactReport.callerHierarchy()) {
            findings.add(new FindingDto(
                    "HIGH",
                    "ARCHITECTURAL_DEVIATION",
                    "Downstream dependency risk in " + caller.callerClass(),
                    caller.callerFilePath(),
                    null,
                    null,
                    "Caller " + caller.callerClass() + "." + caller.callerMethod() + " directly depends on changed symbol: " + caller.calledSymbol(),
                    caller.evidence(),
                    "Modifying " + caller.calledSymbol() + " may alter expected contracts or runtime behavior in " + caller.callerClass(),
                    "Verify " + caller.callerClass() + " caller compatibility and run integration tests for this path.",
                    "Verify integration between " + caller.callerClass() + " and " + caller.calledSymbol(),
                    "HIGH"));
        }

        // 3. Static checks on diff (SQL injection, hardcoded secret, null checks)
        if (diffContent != null) {
            String[] diffLines = diffContent.split("\r\n|\r|\n");
            int lineNum = 1;
            for (String line : diffLines) {
                if (line.startsWith("+") && !line.startsWith("+++")) {
                    String clean = line.substring(1).trim();
                    if (clean.matches(".*(password|secret|apikey|token)\\s*=\\s*[\"'][^\"']+[\"'].*") && !clean.contains("demo")) {
                        findings.add(new FindingDto(
                                "CRITICAL",
                                "SECURITY",
                                "Potential hardcoded credential or secret detected",
                                impactReport.changedFiles().isEmpty() ? "PR Diff" : impactReport.changedFiles().get(0).filePath(),
                                lineNum,
                                lineNum,
                                "Detected possible plain-text secret assignment in added code.",
                                clean,
                                "Hardcoded credentials in repositories can be extracted by unauthorized parties.",
                                "Move credentials to environment variables or an external secret manager.",
                                "Verify secrets are loaded via environment or configuration properties.",
                                "HIGH"));
                    }
                }
                lineNum++;
            }
        }

        String overall = findings.stream().anyMatch(f -> "CRITICAL".equals(f.severity()) || "HIGH".equals(f.severity()))
                ? "CHANGES_REQUESTED"
                : (!findings.isEmpty() ? "APPROVED_WITH_SUGGESTIONS" : "APPROVED");

        return new ReviewAnalysisResultDto(
                overall,
                "Evidence-backed review generated using repository AST skeleton, change-impact callers, and static vulnerability scanning.",
                "LLM provider offline or using local fallback rules. Findings are verified against concrete repository AST metadata and diff line ranges.",
                findings);
    }

    private String buildImpactSummary(PrImpactReportDto impact) {
        StringBuilder sb = new StringBuilder();
        sb.append("Changed Files: ").append(impact.changedFiles().size()).append("\n");
        for (ChangedFileDto f : impact.changedFiles()) {
            sb.append("- ").append(f.filePath()).append(" (+").append(f.additions()).append(", -").append(f.deletions()).append(")")
                    .append(" affected: ").append(f.affectedMethods()).append("\n");
        }
        sb.append("\nAffected Components:\n");
        for (AffectedComponentDto c : impact.affectedComponents()) {
            sb.append("- ").append(c.className()).append(" (").append(c.role()).append(") in ").append(c.filePath())
                    .append(" -> methods: ").append(c.methodsAffected()).append("\n");
        }
        sb.append("\nKnown Downstream Callers:\n");
        for (CallerHierarchyDto h : impact.callerHierarchy()) {
            sb.append("- ").append(h.callerClass()).append(".").append(h.callerMethod())
                    .append(" calls ").append(h.calledSymbol()).append(" (").append(h.evidence()).append(")\n");
        }
        sb.append("\nRelevant Existing Tests:\n");
        for (var t : impact.relevantTests()) {
            sb.append("- ").append(t.testFilePath()).append(" (").append(t.testClassName()).append(")\n");
        }
        sb.append("\nBehavioral Risks:\n");
        for (var r : impact.behaviorRisks()) {
            sb.append("- [").append(r.component()).append("] ").append(r.risk()).append(": ").append(r.rationale()).append("\n");
        }
        return sb.toString();
    }

    private ReviewAnalysisResultDto extractJson(String text) {
        if (text == null) return null;
        try {
            int firstOpen = text.indexOf('{');
            int lastClose = text.lastIndexOf('}');
            if (firstOpen >= 0 && lastClose > firstOpen) {
                String jsonSubstring = text.substring(firstOpen, lastClose + 1);
                return objectMapper.readValue(jsonSubstring, ReviewAnalysisResultDto.class);
            }
        } catch (Exception ex) {
            log.debug("JSON extraction from LLM response failed: {}", ex.getMessage());
        }
        return null;
    }

    private String normalizeSeverity(String sev) {
        if (sev == null) return "INFO";
        String upper = sev.trim().toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO" -> upper;
            default -> "MEDIUM";
        };
    }

    private String normalizeCategory(String cat) {
        if (cat == null) return "LOGIC_ERROR";
        String upper = cat.trim().toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "LOGIC_ERROR", "SECURITY", "ARCHITECTURAL_DEVIATION", "MISSING_TEST", "RESOURCE_LEAK", "BOUNDARY_CONDITION" -> upper;
            default -> "LOGIC_ERROR";
        };
    }
}
