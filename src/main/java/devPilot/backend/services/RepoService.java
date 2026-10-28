package devPilot.backend.services;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import devPilot.backend.dto.IndexStatusResponse;
import devPilot.backend.dto.RepositoryResponse;
import devPilot.backend.entity.CodeStructure;
import devPilot.backend.entity.Repository;
import devPilot.backend.entity.User;
import devPilot.backend.exceptions.NotFoundException;
import devPilot.backend.repository.CodeStructureRepository;
import devPilot.backend.repository.RepositoryRepository;
import devPilot.backend.services.analysis.StructuralAnalysisService;
import devPilot.backend.services.analysis.StructuralSymbolModels.FileStructureDto;
import devPilot.backend.services.github.GitHubUrlParser;
import devPilot.backend.services.github.GithubApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class RepoService {
    private final RepositoryRepository repositoryRepository;
    private final UserService userService;
    private final GithubApiClient gitHubApiClient;
    private final CodeStructureRepository codeStructureRepository;
    private final StructuralAnalysisService structuralAnalysisService;

    @Transactional
    public RepositoryResponse importPublicRepo(UUID userId, String repoUrl) {
        GitHubUrlParser.ParsedRepo parsed = GitHubUrlParser.parseRepositoryUrl(repoUrl);
        String token = null;
        try {
            User user = userService.requiredById(userId);
            if (user.getAccessToken() != null && !user.getAccessToken().isBlank()) {
                token = userService.decryptAccessToken(user);
            }
        } catch (Exception ex) {
            log.debug("Using public GitHub client for import of {}", parsed.fullName());
        }

        Map<String, Object> remote = gitHubApiClient.getRepo(token, parsed.owner(), parsed.repo());
        Long githubRepoId = toLong(remote.get("id"));

        Repository repo = repositoryRepository
                .findByUserIdAndGithubRepoId(userId, githubRepoId)
                .orElseGet(Repository::new);

        String fullName = String.valueOf(remote.get("full_name"));
        String defaultBranch = remote.get("default_branch") != null
                ? String.valueOf(remote.get("default_branch"))
                : "main";
        String commitSha = gitHubApiClient.getBranchCommitSha(token, parsed.owner(), parsed.repo(), defaultBranch);

        repo.setUserId(userId);
        repo.setGithubRepoId(githubRepoId);
        repo.setOwner(parsed.owner());
        repo.setName(parsed.repo());
        repo.setFullName(fullName);
        repo.setPrivate(Boolean.TRUE.equals(remote.get("private")));
        repo.setDefaultBranch(defaultBranch);
        repo.setCommitSha(commitSha);
        repo.setLanguage(remote.get("language") != null ? String.valueOf(remote.get("language")) : null);
        repo.setHtmlUrl(remote.get("html_url") != null ? String.valueOf(remote.get("html_url")) : "https://github.com/" + fullName);
        repo.setDescription(remote.get("description") != null ? String.valueOf(remote.get("description")) : null);
        repo.setUpdatedAt(Instant.now());

        Repository saved = repositoryRepository.save(repo);
        log.info("Imported public repository: {} (commit: {}) for user {}", fullName, commitSha, userId);
        return toResponse(saved);
    }

    @Transactional
    public List<RepositoryResponse> syncAndListRepos(UUID userId) {
        User user = userService.requiredById(userId);
        String token = userService.decryptAccessToken(user);
        List<Map<String, Object>> remoteRepos = gitHubApiClient.listUserRepos(token);

        List<Repository> saved = new ArrayList<>();

        for (Map<String, Object> remote : remoteRepos) {
            Long githubRepoId = toLong(remote.get("id"));
            Repository repo = repositoryRepository
                    .findByUserIdAndGithubRepoId(userId, githubRepoId)
                    .orElseGet(Repository::new);

            String fullName = String.valueOf(remote.get("full_name"));
            String[] parts = fullName.split("/", 2);

            repo.setUserId(userId);
            repo.setGithubRepoId(githubRepoId);
            repo.setOwner(parts.length > 0 ? parts[0] : String.valueOf(remote.get("owner")));
            repo.setName(parts.length > 1 ? parts[1] : String.valueOf(remote.get("name")));
            repo.setFullName(fullName);
            repo.setPrivate(Boolean.TRUE.equals(remote.get("private")));
            repo.setDefaultBranch(remote.get("default_branch") != null
                    ? String.valueOf(remote.get("default_branch"))
                    : "main");
            repo.setLanguage(remote.get("language") != null ? String.valueOf(remote.get("language")) : null);
            repo.setHtmlUrl(remote.get("html_url") != null ? String.valueOf(remote.get("html_url")) : null);
            repo.setDescription(remote.get("description") != null ? String.valueOf(remote.get("description")) : null);
            repo.setUpdatedAt(Instant.now());
            if (repo.getOwner() == null || repo.getOwner().isBlank()) {
                Object ownerObj = remote.get("owner");
                if (ownerObj instanceof Map<?, ?> ownerMap && ownerMap.get("login") != null) {
                    repo.setOwner(String.valueOf(ownerMap.get("login")));
                }
            }
            saved.add(repositoryRepository.save(repo));
        }

        return saved.stream()
                .sorted((a, b) -> a.getFullName().compareToIgnoreCase(b.getFullName()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RepositoryResponse> listStored(UUID userId) {
        return repositoryRepository.findByUserIdOrderByFullNameAsc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Repository requireOwned(UUID repoId, UUID userId) {
        return repositoryRepository.findByIdAndUserId(repoId, userId)
                .orElseThrow(() -> new NotFoundException("Repository not found"));
    }

    @Transactional(readOnly = true)
    public IndexStatusResponse status(UUID repoId, UUID userId) {
        Repository repo = requireOwned(repoId, userId);
        return new IndexStatusResponse(
                repo.getId(),
                repo.getIndexStatus(),
                repo.getFilesTotal(),
                repo.getFilesProcessed(),
                repo.getChunkCount(),
                repo.getIndexedAt(),
                repo.getErrorMessage());
    }

    @Transactional(readOnly = true)
    public List<FileStructureDto> getRepositoryStructures(UUID repoId, UUID userId) {
        requireOwned(repoId, userId);
        List<CodeStructure> structures = codeStructureRepository.findByRepositoryId(repoId);
        return structures.stream()
                .map(structuralAnalysisService::getStructure)
                .toList();
    }

    public RepositoryResponse toResponse(Repository repo) {
        return new RepositoryResponse(
                repo.getId(),
                repo.getGithubRepoId(),
                repo.getOwner(),
                repo.getName(),
                repo.getFullName(),
                repo.isPrivate(),
                repo.getDefaultBranch(),
                repo.getCommitSha(),
                repo.getLanguage(),
                repo.getHtmlUrl(),
                repo.getDescription(),
                repo.getIndexStatus(),
                repo.getIndexedAt(),
                repo.getChunkCount(),
                repo.getFilesTotal(),
                repo.getFilesProcessed(),
                repo.getErrorMessage());
    }

    private static Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }
}
