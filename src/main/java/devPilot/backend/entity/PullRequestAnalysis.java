package devPilot.backend.entity;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "pull_request_analyses", indexes = {
        @Index(name = "idx_pra_repo", columnList = "repository_id"),
        @Index(name = "idx_pra_user", columnList = "user_id"),
        @Index(name = "idx_pra_repo_pr", columnList = "repository_id, pr_number")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PullRequestAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "repository_id", nullable = false)
    private UUID repositoryId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "pr_number", nullable = false)
    private int prNumber;

    @Column(name = "pr_url", nullable = false, length = 500)
    private String prUrl;

    @Column(name = "pr_title", length = 500)
    private String prTitle;

    @Column(name = "base_sha", length = 100)
    private String baseSha;

    @Column(name = "head_sha", length = 100)
    private String headSha;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private AnalysisStatus status = AnalysisStatus.PENDING;

    @Column(name = "overall_result", length = 50)
    private String overallResult;

    @Column(name = "critical_count", nullable = false)
    @Builder.Default
    private int criticalCount = 0;

    @Column(name = "high_count", nullable = false)
    @Builder.Default
    private int highCount = 0;

    @Column(name = "medium_count", nullable = false)
    @Builder.Default
    private int mediumCount = 0;

    @Column(name = "low_count", nullable = false)
    @Builder.Default
    private int lowCount = 0;

    @Column(name = "info_count", nullable = false)
    @Builder.Default
    private int infoCount = 0;

    @Column(name = "summary_text", columnDefinition = "TEXT")
    private String summaryText;

    @Column(columnDefinition = "TEXT")
    private String limitations;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (status == null) {
            status = AnalysisStatus.PENDING;
        }
    }
}
