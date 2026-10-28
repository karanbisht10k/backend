package devPilot.backend.services.github;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import devPilot.backend.exceptions.BadRequestException;
import devPilot.backend.services.github.GitHubUrlParser.ParsedPullRequest;
import devPilot.backend.services.github.GitHubUrlParser.ParsedRepo;

class GitHubUrlParserTest {

    @Test
    void shouldAcceptCanonicalGitHubRepoUrls() {
        ParsedRepo parsed = GitHubUrlParser.parseRepositoryUrl("https://github.com/spring-projects/spring-boot");
        assertEquals("spring-projects", parsed.owner());
        assertEquals("spring-boot", parsed.repo());
        assertEquals("spring-projects/spring-boot", parsed.fullName());

        ParsedRepo withGit = GitHubUrlParser.parseRepositoryUrl("https://github.com/octocat/Hello-World.git");
        assertEquals("octocat", withGit.owner());
        assertEquals("Hello-World", withGit.repo());
    }

    @Test
    void shouldRejectUnsafeAndNonGitHubHosts() {
        assertThrows(BadRequestException.class, () ->
                GitHubUrlParser.parseRepositoryUrl("https://gitlab.com/owner/repo"));

        assertThrows(BadRequestException.class, () ->
                GitHubUrlParser.parseRepositoryUrl("https://malicious-site.com/octocat/Hello-World"));

        assertThrows(BadRequestException.class, () ->
                GitHubUrlParser.parseRepositoryUrl("ftp://github.com/owner/repo"));

        assertThrows(BadRequestException.class, () ->
                GitHubUrlParser.parseRepositoryUrl("file:///etc/passwd"));
    }

    @Test
    void shouldRejectPathTraversalAndMalformedPaths() {
        assertThrows(BadRequestException.class, () ->
                GitHubUrlParser.parseRepositoryUrl("https://github.com/../malicious"));

        assertThrows(BadRequestException.class, () ->
                GitHubUrlParser.parseRepositoryUrl("https://github.com/owner/"));

        assertThrows(BadRequestException.class, () ->
                GitHubUrlParser.parseRepositoryUrl("not-a-url"));
    }

    @Test
    void shouldParseCanonicalPullRequestUrls() {
        ParsedPullRequest pr = GitHubUrlParser.parsePullRequestUrl("https://github.com/owner/repo/pull/42");
        assertEquals("owner", pr.owner());
        assertEquals("repo", pr.repo());
        assertEquals(42, pr.pullNumber());
        assertEquals("owner/repo", pr.repoFullName());
    }

    @Test
    void shouldRejectInvalidPullRequestUrls() {
        assertThrows(BadRequestException.class, () ->
                GitHubUrlParser.parsePullRequestUrl("https://github.com/owner/repo/pull/not-a-number"));

        assertThrows(BadRequestException.class, () ->
                GitHubUrlParser.parsePullRequestUrl("https://evil.com/owner/repo/pull/1"));
    }
}
