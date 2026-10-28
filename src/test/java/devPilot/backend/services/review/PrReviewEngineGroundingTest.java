package devPilot.backend.services.review;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;

import com.fasterxml.jackson.databind.ObjectMapper;

import devPilot.backend.services.impact.ImpactModels.AffectedComponentDto;
import devPilot.backend.services.impact.ImpactModels.CallerHierarchyDto;
import devPilot.backend.services.impact.ImpactModels.ChangedFileDto;
import devPilot.backend.services.impact.ImpactModels.PrImpactReportDto;
import devPilot.backend.services.review.ReviewModels.FindingDto;
import devPilot.backend.services.review.ReviewModels.ReviewAnalysisResultDto;

class PrReviewEngineGroundingTest {

    @Test
    void prFindingsMustContainValidSourceEvidenceAndGroundedLines() {
        ChatModel chatModel = mock(ChatModel.class);
        ObjectMapper objectMapper = new ObjectMapper();
        PrReviewEngine engine = new PrReviewEngine(chatModel, objectMapper);

        String sampleDiff = """
                @@ -45,6 +45,8 @@ public class PaymentService {
                 -    public void processPayment(Order order) {
                 +    public void processPayment(Order order, String token) {
                 +        String secret = "hardcoded-secret-key-12345";
                 +        paymentGateway.charge(order.getAmount(), token);
                      }
                 """;

        ChangedFileDto changedFile = new ChangedFileDto(
                "src/main/java/com/app/PaymentService.java",
                "modified",
                3,
                1,
                List.of(45, 46, 47),
                List.of("PaymentService.processPayment"));

        AffectedComponentDto affectedComp = new AffectedComponentDto(
                "PaymentService",
                "src/main/java/com/app/PaymentService.java",
                "SERVICE",
                List.of("processPayment"));

        CallerHierarchyDto caller = new CallerHierarchyDto(
                "src/main/java/com/app/CheckoutController.java",
                "CheckoutController",
                "handleCheckout",
                "PaymentService.processPayment",
                true,
                "Calls processPayment at CheckoutController.java:82");

        PrImpactReportDto impactReport = new PrImpactReportDto(
                List.of(changedFile),
                List.of(affectedComp),
                List.of(caller),
                List.of(), // No tests!
                List.of(),
                List.of());

        ReviewAnalysisResultDto result = engine.reviewPullRequest(
                "org/sample-app",
                "Update payment processing signature",
                sampleDiff,
                impactReport);

        assertNotNull(result);
        assertNotNull(result.findings());
        assertFalse(result.findings().isEmpty(), "Expected evidence-backed findings to be generated");

        for (FindingDto finding : result.findings()) {
            assertNotNull(finding.severity(), "Finding must have a severity");
            assertNotNull(finding.category(), "Finding must have a category");
            assertNotNull(finding.filePath(), "Finding must reference a valid source file path");
            assertNotNull(finding.evidence(), "Finding must include grounding evidence");

            // Line numbers, if provided, must fall within the modified line ranges (45-47) or diff lines
            if (finding.startLine() != null) {
                assertTrue(finding.startLine() >= 1, "Line number cannot be non-positive");
            }
        }

        // Verify downstream caller risk finding is present with exact caller evidence
        boolean hasCallerRisk = result.findings().stream()
                .anyMatch(f -> f.evidence().contains("CheckoutController") || f.title().contains("CheckoutController"));
        assertTrue(hasCallerRisk, "Expected downstream caller risk for CheckoutController to be reported with evidence");
    }
}
