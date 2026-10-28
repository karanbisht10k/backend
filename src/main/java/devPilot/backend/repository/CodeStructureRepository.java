package devPilot.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import devPilot.backend.entity.CodeStructure;

@Repository
public interface CodeStructureRepository extends JpaRepository<CodeStructure, UUID> {

    List<CodeStructure> findByRepositoryId(UUID repositoryId);

    Optional<CodeStructure> findByRepositoryIdAndFilePath(UUID repositoryId, String filePath);

    void deleteByRepositoryId(UUID repositoryId);

    List<CodeStructure> findByRepositoryIdAndIsTest(UUID repositoryId, boolean isTest);
}
