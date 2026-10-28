package devPilot.backend.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import devPilot.backend.entity.Repository;
import devPilot.backend.exceptions.NotFoundException;
import devPilot.backend.repository.CodeStructureRepository;
import devPilot.backend.repository.RepositoryRepository;
import devPilot.backend.services.analysis.StructuralAnalysisService;
import devPilot.backend.services.github.GithubApiClient;

class RepositoryIsolationTest {

    @Test
    void userCannotAccessRepositoryOwnedByAnotherUser() {
        RepositoryRepository repositoryRepository = mock(RepositoryRepository.class);
        UserService userService = mock(UserService.class);
        GithubApiClient gitHubApiClient = mock(GithubApiClient.class);
        CodeStructureRepository codeStructureRepository = mock(CodeStructureRepository.class);
        StructuralAnalysisService structuralAnalysisService = mock(StructuralAnalysisService.class);

        RepoService repoService = new RepoService(
                repositoryRepository,
                userService,
                gitHubApiClient,
                codeStructureRepository,
                structuralAnalysisService);

        UUID repoId = UUID.randomUUID();
        UUID authorizedUser = UUID.randomUUID();
        UUID unauthorizedUser = UUID.randomUUID();

        Repository repo = Repository.builder()
                .id(repoId)
                .userId(authorizedUser)
                .fullName("company/secret-project")
                .build();

        // Authorized user lookup succeeds
        when(repositoryRepository.findByIdAndUserId(repoId, authorizedUser)).thenReturn(Optional.of(repo));
        // Unauthorized user lookup returns empty (scoped by userId)
        when(repositoryRepository.findByIdAndUserId(repoId, unauthorizedUser)).thenReturn(Optional.empty());

        // Authorized user can access
        Repository found = repoService.requireOwned(repoId, authorizedUser);
        assertNotNull(found);
        assertEquals(authorizedUser, found.getUserId());

        // Unauthorized user is strictly blocked
        assertThrows(NotFoundException.class, () ->
                repoService.requireOwned(repoId, unauthorizedUser));
    }
}
