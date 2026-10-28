package devPilot.backend.entity;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "code_structures", indexes = {
        @Index(name = "idx_cs_repo", columnList = "repository_id"),
        @Index(name = "idx_cs_repo_file", columnList = "repository_id, file_path")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodeStructure {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "repository_id", nullable = false)
    private UUID repositoryId;

    @Column(name = "commit_sha", length = 100)
    private String commitSha;

    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @Column(length = 50)
    private String language;

    @Column(name = "package_name", length = 300)
    private String packageName;

    @Column(name = "is_test", nullable = false)
    private boolean isTest;

    @Column(name = "line_count", nullable = false)
    private int lineCount;

    @Column(name = "imports_json", columnDefinition = "TEXT")
    private String importsJson;

    @Column(name = "symbols_json", columnDefinition = "TEXT")
    private String symbolsJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
