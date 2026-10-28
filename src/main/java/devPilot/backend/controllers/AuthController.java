package devPilot.backend.controllers;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.encrypt.TextEncryptor;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import devPilot.backend.dto.UserResponse;
import devPilot.backend.entity.User;
import devPilot.backend.repository.UserRepository;
import devPilot.backend.security.AppUserPrincipal;
import devPilot.backend.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final CurrentUser currentUser;
    private final UserRepository userRepository;
    private final TextEncryptor tokenEncryptor;

    @GetMapping("/login-url")
    public Map<String, String> loginUrl() {
        return Map.of("url", "/oauth2/authorization/github");
    }

    @PostMapping("/demo-login")
    public ResponseEntity<UserResponse> demoLogin(HttpServletRequest request) {
        User demoUser = userRepository.findByGithubUsername("demo-developer").orElseGet(() -> {
            User u = User.builder()
                    .githubId(999999999L)
                    .githubUsername("demo-developer")
                    .displayName("CodeSense Demo Engineer")
                    .avatarUrl("https://avatars.githubusercontent.com/u/9919?v=4")
                    .accessToken(tokenEncryptor.encrypt("demo-token"))
                    .tokenScopes("read:user,repo")
                    .build();
            return userRepository.save(u);
        });

        AppUserPrincipal principal = new AppUserPrincipal(demoUser, Map.of(
                "id", demoUser.getGithubId(),
                "login", demoUser.getGithubUsername(),
                "name", demoUser.getDisplayName(),
                "avatar_url", demoUser.getAvatarUrl()
        ));

        Authentication auth = new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
        HttpSession session = request.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, SecurityContextHolder.getContext());

        return ResponseEntity.ok(new UserResponse(
                demoUser.getId(),
                demoUser.getGithubId(),
                demoUser.getGithubUsername(),
                demoUser.getDisplayName(),
                demoUser.getAvatarUrl()));
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me() {
        AppUserPrincipal principal = currentUser.require();
        User user = principal.getUser();
        return ResponseEntity.ok(new UserResponse(
                user.getId(),
                user.getGithubId(),
                user.getGithubUsername(),
                user.getDisplayName(),
                user.getAvatarUrl()));
    }
}
