package devPilot.backend.services.ai;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.stereotype.Service;

import devPilot.backend.dto.CitationDto;
import devPilot.backend.entity.CodeStructure;
import devPilot.backend.repository.CodeStructureRepository;
import devPilot.backend.services.analysis.StructuralAnalysisService;
import devPilot.backend.services.analysis.StructuralSymbolModels.ClassSymbolDto;
import devPilot.backend.services.analysis.StructuralSymbolModels.FileStructureDto;
import devPilot.backend.services.analysis.StructuralSymbolModels.MethodSymbolDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class CodeContextRetriever {
    private static final String NO_MATCHES = "(no matching code chunks found in repository)";

    private final VectorStore vectorStore;
    private final CitationMapper citationMapper;
    private final CodeStructureRepository codeStructureRepository;
    private final StructuralAnalysisService structuralAnalysisService;

    public RetrievedContext retrieve(UUID repositoryId, String question) {
        List<CitationDto> citations = new ArrayList<>();
        List<String> contextSections = new ArrayList<>();

        // 1. Semantic Vector Search
        try {
            var filter = new FilterExpressionBuilder()
                    .eq(RagSettings.METADATA_REPO_ID, repositoryId.toString())
                    .build();

            var search = SearchRequest.builder()
                    .query(question)
                    .topK(RagSettings.TOP_K_CHUNKS)
                    .filterExpression(filter)
                    .build();

            var documents = vectorStore.similaritySearch(search);
            if (documents != null && !documents.isEmpty()) {
                for (Document doc : documents) {
                    citations.add(citationMapper.fromDocument(doc));
                }
                String semanticText = documents.stream()
                        .map(Document::getText)
                        .collect(Collectors.joining("\n\n---\n\n"));
                contextSections.add("=== SEMANTIC CODE CHUNKS ===\n" + semanticText);
            }
        } catch (Exception ex) {
            log.warn("Vector search failed or unavailable for repo {}: {}", repositoryId, ex.getMessage());
        }

        // 2. Structural AST Evidence Retrieval
        try {
            List<CodeStructure> structures = codeStructureRepository.findByRepositoryId(repositoryId);
            if (!structures.isEmpty()) {
                String structuralSummary = findRelevantStructuralEvidence(structures, question, citations);
                if (!structuralSummary.isBlank()) {
                    contextSections.add("=== REPOSITORY SKELETON & AST EVIDENCE ===\n" + structuralSummary);
                }
            }
        } catch (Exception ex) {
            log.warn("Structural context retrieval failed for repo {}: {}", repositoryId, ex.getMessage());
        }

        String finalContext = contextSections.isEmpty()
                ? NO_MATCHES
                : String.join("\n\n========================================\n\n", contextSections);

        List<CitationDto> distinctCitations = citations.stream().distinct().toList();
        return new RetrievedContext(distinctCitations, finalContext);
    }

    private String findRelevantStructuralEvidence(
            List<CodeStructure> structures,
            String question,
            List<CitationDto> citations) {

        Set<String> keywords = Arrays.stream(question.toLowerCase(Locale.ROOT).split("\\W+"))
                .filter(w -> w.length() > 2)
                .collect(Collectors.toSet());

        StringBuilder sb = new StringBuilder();
        int matchedFiles = 0;

        for (CodeStructure cs : structures) {
            FileStructureDto dto = structuralAnalysisService.getStructure(cs);
            boolean fileMatches = keywords.stream().anyMatch(kw -> cs.getFilePath().toLowerCase(Locale.ROOT).contains(kw));

            List<ClassSymbolDto> matchedClasses = dto.classes().stream()
                    .filter(c -> fileMatches || keywords.stream().anyMatch(kw -> c.name().toLowerCase(Locale.ROOT).contains(kw)))
                    .toList();

            List<MethodSymbolDto> matchedMethods = dto.methods().stream()
                    .filter(m -> fileMatches || keywords.stream().anyMatch(kw -> m.name().toLowerCase(Locale.ROOT).contains(kw)))
                    .toList();

            if (!matchedClasses.isEmpty() || !matchedMethods.isEmpty() || fileMatches) {
                matchedFiles++;
                sb.append("File: ").append(dto.filePath()).append(" (lines: 1-").append(dto.lineCount()).append(")\n");
                if (dto.packageName() != null && !dto.packageName().isBlank()) {
                    sb.append("  Package: ").append(dto.packageName()).append("\n");
                }
                for (ClassSymbolDto c : matchedClasses) {
                    sb.append("  ").append(c.kind()).append(" ").append(c.name())
                            .append(" [L").append(c.startLine()).append("-L").append(c.endLine()).append("]");
                    if (!c.annotations().isEmpty()) {
                        sb.append(" ").append(c.annotations());
                    }
                    sb.append("\n");
                }
                for (MethodSymbolDto m : matchedMethods) {
                    sb.append("    Method: ").append(m.name()).append("() [L").append(m.startLine()).append("-L").append(m.endLine()).append("]");
                    if (!m.annotations().isEmpty()) {
                        sb.append(" ").append(m.annotations());
                    }
                    if (!m.calledMethods().isEmpty()) {
                        sb.append(" -> calls: ").append(String.join(", ", m.calledMethods()));
                    }
                    sb.append("\n");

                    // Add structural citation with exact line numbers
                    citations.add(new CitationDto(dto.filePath(), m.startLine(), m.endLine(), m.name()));
                }
                sb.append("\n");

                if (matchedFiles >= 8) {
                    break;
                }
            }
        }

        return sb.toString();
    }
}
