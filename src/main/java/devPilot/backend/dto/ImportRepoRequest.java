package devPilot.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ImportRepoRequest(
        @NotBlank(message = "repositoryUrl is required")
        String repositoryUrl) {
}
