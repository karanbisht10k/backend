package devPilot.backend.services.github;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import devPilot.backend.exceptions.BadRequestException;
import devPilot.backend.exceptions.NotFoundException;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GithubApiClient {

    private static final String API_BASE = "https://api.github.com";

    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_MAP = new ParameterizedTypeReference<>() {
    };
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };

    private final RestClient.Builder restClientBuilder;
    private final String defaultToken;

    public GithubApiClient(
            RestClient.Builder restClientBuilder,
            @Value("${app.github.token:}") String defaultToken) {
        this.restClientBuilder = restClientBuilder;
        this.defaultToken = defaultToken;
    }

    public List<Map<String, Object>> listUserRepos(String accessToken) {
        List<Map<String, Object>> all = new ArrayList<>();
        int page = 1;
        while (page <= 10) {
            final int currentPage = page;
            try {
                List<Map<String, Object>> pageRepos = client(accessToken)
                        .get()
                        .uri(uriBuilder -> uriBuilder
                                .path("/user/repos")
                                .queryParam("affiliation", "owner,collaborator,organization_member")
                                .queryParam("sort", "updated")
                                .queryParam("per_page", 100)
                                .queryParam("page", currentPage)
                                .build())
                        .retrieve()
                        .onStatus(HttpStatusCode::isError, (req, res) -> {
                            handleHttpError(res.getStatusCode().value(), "list user repos");
                        })
                        .body(LIST_MAP);

                if (pageRepos == null || pageRepos.isEmpty()) {
                    break;
                }
                all.addAll(pageRepos);
                if (pageRepos.size() < 100) {
                    break;
                }
                page++;
            } catch (Exception ex) {
                log.warn("Error fetching page {} of repos: {}", currentPage, ex.getMessage());
                break;
            }
        }
        return all;
    }

    public Map<String, Object> getRepo(String accessToken, String owner, String repo) {
        try {
            return client(accessToken)
                    .get()
                    .uri("/repos/{owner}/{repo}", owner, repo)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        handleHttpError(res.getStatusCode().value(), "repository " + owner + "/" + repo);
                    })
                    .body(MAP);
        } catch (HttpClientErrorException.NotFound ex) {
            throw new NotFoundException("GitHub repository not found or is private: " + owner + "/" + repo);
        }
    }

    public String getBranchCommitSha(String accessToken, String owner, String repo, String branch) {
        try {
            Map<String, Object> commitData = client(accessToken)
                    .get()
                    .uri("/repos/{owner}/{repo}/commits/{branch}", owner, repo, branch)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        handleHttpError(res.getStatusCode().value(), "branch commit " + branch);
                    })
                    .body(MAP);

            if (commitData != null && commitData.get("sha") != null) {
                return String.valueOf(commitData.get("sha"));
            }
            return branch;
        } catch (Exception ex) {
            log.warn("Could not resolve concrete SHA for branch {} in {}/{}: {}", branch, owner, repo, ex.getMessage());
            return branch;
        }
    }

    public Map<String, Object> getRepoTree(String accessToken, String owner, String repo, String branchOrSha) {
        try {
            Map<String, Object> tree = client(accessToken)
                    .get()
                    .uri("/repos/{owner}/{repo}/git/trees/{branch}?recursive=1", owner, repo, branchOrSha)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        handleHttpError(res.getStatusCode().value(), "git tree for " + owner + "/" + repo);
                    })
                    .body(MAP);

            if (tree != null && Boolean.TRUE.equals(tree.get("truncated"))) {
                log.warn("GitHub tree for {}/{} (ref: {}) was truncated by GitHub API (exceeds limit)", owner, repo, branchOrSha);
            }
            return tree;
        } catch (Exception ex) {
            log.error("Failed to fetch tree for {}/{}: {}", owner, repo, ex.getMessage());
            throw new BadRequestException("Failed to fetch repository tree: " + ex.getMessage());
        }
    }

    public String getFileContent(String accessToken, String owner, String repo, String path) {
        try {
            Map<String, Object> body = client(accessToken)
                    .get()
                    .uri("/repos/{owner}/{repo}/contents/{path}", owner, repo, path)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        handleHttpError(res.getStatusCode().value(), "file content " + path);
                    })
                    .body(MAP);

            if (body == null) {
                return null;
            }
            Object encoding = body.get("encoding");
            Object content = body.get("content");
            if (content == null) {
                return null;
            }
            if ("base64".equals(String.valueOf(encoding))) {
                String raw = String.valueOf(content).replaceAll("\\s", "");
                return new String(Base64.getDecoder().decode(raw), StandardCharsets.UTF_8);
            }
            return String.valueOf(content);
        } catch (Exception ex) {
            log.debug("Could not fetch file content for {}: {}", path, ex.getMessage());
            return null;
        }
    }

    public Map<String, Object> getPullRequest(String accessToken, String owner, String repo, int pullNumber) {
        try {
            return client(accessToken)
                    .get()
                    .uri("/repos/{owner}/{repo}/pulls/{pullNumber}", owner, repo, pullNumber)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        handleHttpError(res.getStatusCode().value(), "pull request #" + pullNumber);
                    })
                    .body(MAP);
        } catch (HttpClientErrorException.NotFound ex) {
            throw new NotFoundException("Pull request #" + pullNumber + " not found in " + owner + "/" + repo);
        }
    }

    public List<Map<String, Object>> getPullRequestFiles(String accessToken, String owner, String repo, int pullNumber) {
        List<Map<String, Object>> allFiles = new ArrayList<>();
        int page = 1;
        while (page <= 5) {
            final int currentPage = page;
            List<Map<String, Object>> pageFiles = client(accessToken)
                    .get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/repos/{owner}/{repo}/pulls/{pullNumber}/files")
                            .queryParam("per_page", 100)
                            .queryParam("page", currentPage)
                            .build(owner, repo, pullNumber))
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        handleHttpError(res.getStatusCode().value(), "PR files page " + currentPage);
                    })
                    .body(LIST_MAP);

            if (pageFiles == null || pageFiles.isEmpty()) {
                break;
            }
            allFiles.addAll(pageFiles);
            if (pageFiles.size() < 100 || allFiles.size() >= 300) {
                break;
            }
            page++;
        }
        return allFiles;
    }

    public String getPullRequestDiff(String accessToken, String owner, String repo, int pullNumber) {
        try {
            return client(accessToken)
                    .get()
                    .uri("/repos/{owner}/{repo}/pulls/{pullNumber}", owner, repo, pullNumber)
                    .header(HttpHeaders.ACCEPT, "application/vnd.github.v3.diff")
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        handleHttpError(res.getStatusCode().value(), "PR diff #" + pullNumber);
                    })
                    .body(String.class);
        } catch (Exception ex) {
            log.warn("Could not retrieve unified diff for PR #{}: {}", pullNumber, ex.getMessage());
            return "";
        }
    }

    private void handleHttpError(int statusCode, String action) {
        if (statusCode == 404) {
            throw new NotFoundException("Resource not found on GitHub during: " + action);
        } else if (statusCode == 403 || statusCode == 429) {
            throw new BadRequestException("GitHub API rate limit exceeded or access forbidden during: " + action);
        } else if (statusCode >= 500) {
            throw new BadRequestException("GitHub API service unavailable (status " + statusCode + ") during: " + action);
        }
    }

    private RestClient client(String accessToken) {
        String token = (accessToken != null && !accessToken.isBlank())
                ? accessToken
                : (defaultToken != null && !defaultToken.isBlank() ? defaultToken : null);

        var builder = restClientBuilder
                .baseUrl(API_BASE)
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
                .defaultHeader(HttpHeaders.USER_AGENT, "CodeSense-DevPilot");

        if (token != null && !token.isBlank()) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        }

        return builder.build();
    }
}
