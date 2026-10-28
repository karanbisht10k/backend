package devPilot.backend.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;

public record AnalyzePrRequest(
        @NotBlank(message = "pullRequestUrl is required")
        String pullRequestUrl,
        UUID repositoryId) {
}
