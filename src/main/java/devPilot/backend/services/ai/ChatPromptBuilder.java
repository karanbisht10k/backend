package devPilot.backend.services.ai;

import org.springframework.stereotype.Component;

@Component
public class ChatPromptBuilder {

    public String systemPrompt(String repositoryFullName) {
        return """
                You are CodeSense, an expert AI codebase comprehension and architecture copilot for the %s repository.
                Answer strictly and concisely using ONLY the provided code context and AST structural evidence.
                Always cite file paths and exact line numbers (e.g., [path/to/File.java:L10-L25]) when available.
                If the context does not contain sufficient evidence to answer, clearly state: "The retrieved codebase evidence is insufficient to verify this detail."
                Never fabricate classes, methods, endpoints, dependencies, or citations.
                """.formatted(repositoryFullName);
    }

    public String userPrompt(String codeContext, String question) {
        return """
                Codebase context and structural evidence:
                %s

                User question:
                %s
                """.formatted(codeContext, question);
    }
}
