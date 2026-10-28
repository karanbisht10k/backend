package devPilot.backend.services.indexing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.ai.vectorstore.VectorStore;

import devPilot.backend.entity.IndexStatus;
import devPilot.backend.entity.Repository;
import devPilot.backend.exceptions.BadRequestException;
import devPilot.backend.repository.CodeStructureRepository;
import devPilot.backend.repository.RepositoryRepository;
import devPilot.backend.services.UserService;
import devPilot.backend.services.analysis.StructuralAnalysisService;
import devPilot.backend.services.github.GitHubRateLimiter;
import devPilot.backend.services.github.GithubApiClient;

class IndexingServiceFailureTest {

    @Test
    void unusableIndexingOperationCannotReportSuccessfulCompletion() {
        RepositoryRepository repositoryRepository = mock(RepositoryRepository.class);
        UserService userService = mock(UserService.class);
        GithubApiClient gitHubApiClient = mock(GithubApiClient.class);
        CodeFileFilter fileFilter = mock(CodeFileFilter.class);
        CodeChunker codeChunker = mock(CodeChunker.class);
        GitHubRateLimiter rateLimiter = mock(GitHubRateLimiter.class);
        VectorStore vectorStore = mock(VectorStore.class);
        StructuralAnalysisService structuralAnalysisService = mock(StructuralAnalysisService.class);
        CodeStructureRepository codeStructureRepository = mock(CodeStructureRepository.class);

        IndexingService service = new IndexingService(
                repositoryRepository,
                userService,
                gitHubApiClient,
                fileFilter,
                codeChunker,
                rateLimiter,
                vectorStore,
                structuralAnalysisService,
                codeStructureRepository);

        UUID repoId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        Repository repo = Repository.builder()
                .id(repoId)
                .userId(userId)
                .owner("test-owner")
                .name("test-repo")
                .fullName("test-owner/test-repo")
                .defaultBranch("main")
                .indexStatus(IndexStatus.INDEXING)
                .build();

        when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(repo));
        // Simulate GitHub failure (rate limit / tree retrieval error)
        when(gitHubApiClient.getRepoTree(any(), any(), any(), any()))
                .thenThrow(new BadRequestException("GitHub tree API rate limit exceeded"));

        // Execute asynchronous indexing worker
        service.indexAsync(repoId, userId);

        // Verify that repo status is marked FAILED and NEVER marked READY
        assertEquals(IndexStatus.FAILED, repo.getIndexStatus());
        assertNotEquals(IndexStatus.READY, repo.getIndexStatus());
        assertEquals("GitHub tree API rate limit exceeded", repo.getErrorMessage());
    }
}
