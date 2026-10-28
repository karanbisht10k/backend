package devPilot.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import devPilot.backend.entity.PrFinding;

@Repository
public interface PrFindingRepository extends JpaRepository<PrFinding, UUID> {

    List<PrFinding> findByAnalysisIdOrderBySeverityAscCreatedAtAsc(UUID analysisId);

    void deleteByAnalysisId(UUID analysisId);
}
