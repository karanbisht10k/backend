package devPilot.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import devPilot.backend.entity.PullRequestAnalysis;

@Repository
public interface PullRequestAnalysisRepository extends JpaRepository<PullRequestAnalysis, UUID> {

    List<PullRequestAnalysis> findByRepositoryIdOrderByCreatedAtDesc(UUID repositoryId);

    List<PullRequestAnalysis> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<PullRequestAnalysis> findByIdAndUserId(UUID id, UUID userId);
}
