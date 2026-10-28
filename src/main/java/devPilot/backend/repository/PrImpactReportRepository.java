package devPilot.backend.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import devPilot.backend.entity.PrImpactReportEntity;

@Repository
public interface PrImpactReportRepository extends JpaRepository<PrImpactReportEntity, UUID> {

    Optional<PrImpactReportEntity> findByAnalysisId(UUID analysisId);

    void deleteByAnalysisId(UUID analysisId);
}
