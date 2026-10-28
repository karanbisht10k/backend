package devPilot.backend.services.github;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import devPilot.backend.exceptions.BadRequestException;

public class GitHubUrlParser {

    private static final Pattern REPO_PATH_PATTERN = Pattern.compile("^/([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\\.git)?/?$");
    private static final Pattern PR_PATH_PATTERN = Pattern.compile("^/([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)/pull/([0-9]+)/?$");

    public record ParsedRepo(String owner, String repo) {
        public String fullName() {
            return owner + "/" + repo;
        }
    }

    public record ParsedPullRequest(String owner, String repo, int pullNumber) {
        public String repoFullName() {
            return owner + "/" + repo;
        }
    }

    public static ParsedRepo parseRepositoryUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new BadRequestException("Repository URL cannot be empty");
        }

        URI uri = validateGitHubUri(rawUrl.trim());
        String path = uri.getPath();
        if (path == null) {
            throw new BadRequestException("Invalid GitHub repository URL path: " + rawUrl);
        }

        Matcher matcher = REPO_PATH_PATTERN.matcher(path);
        if (!matcher.matches()) {
            throw new BadRequestException("Repository URL must follow the format 'https://github.com/owner/repository': " + rawUrl);
        }

        String owner = matcher.group(1);
        String repo = matcher.group(2);

        validateName(owner, "owner");
        validateName(repo, "repository name");

        return new ParsedRepo(owner, repo);
    }

    public static ParsedPullRequest parsePullRequestUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new BadRequestException("Pull request URL cannot be empty");
        }

        URI uri = validateGitHubUri(rawUrl.trim());
        String path = uri.getPath();
        if (path == null) {
            throw new BadRequestException("Invalid GitHub pull request URL path: " + rawUrl);
        }

        Matcher matcher = PR_PATH_PATTERN.matcher(path);
        if (!matcher.matches()) {
            throw new BadRequestException("Pull request URL must follow the format 'https://github.com/owner/repository/pull/{number}': " + rawUrl);
        }

        String owner = matcher.group(1);
        String repo = matcher.group(2);
        int pullNumber;
        try {
            pullNumber = Integer.parseInt(matcher.group(3));
        } catch (NumberFormatException e) {
            throw new BadRequestException("Invalid pull request number: " + matcher.group(3));
        }

        validateName(owner, "owner");
        validateName(repo, "repository name");

        return new ParsedPullRequest(owner, repo, pullNumber);
    }

    private static URI validateGitHubUri(String rawUrl) {
        URI uri;
        try {
            uri = URI.create(rawUrl);
        } catch (Exception ex) {
            throw new BadRequestException("Malformed URL: " + rawUrl);
        }

        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
            throw new BadRequestException("Unsupported URL scheme (only http/https supported): " + scheme);
        }

        String host = uri.getHost();
        if (host == null || (!host.equalsIgnoreCase("github.com") && !host.equalsIgnoreCase("www.github.com"))) {
            throw new BadRequestException("Host not allowed (only github.com is supported): " + host);
        }

        return uri;
    }

    private static void validateName(String name, String label) {
        if (name == null || name.isBlank() || name.contains("..") || name.equalsIgnoreCase(".git")) {
            throw new BadRequestException("Invalid " + label + ": " + name);
        }
    }
}
