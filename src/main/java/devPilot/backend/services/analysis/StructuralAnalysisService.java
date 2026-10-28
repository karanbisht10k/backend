package devPilot.backend.services.analysis;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import devPilot.backend.entity.CodeStructure;
import devPilot.backend.repository.CodeStructureRepository;
import devPilot.backend.services.analysis.StructuralSymbolModels.ClassSymbolDto;
import devPilot.backend.services.analysis.StructuralSymbolModels.FileStructureDto;
import devPilot.backend.services.analysis.StructuralSymbolModels.MethodSymbolDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class StructuralAnalysisService {

    private final JavaAstParser javaAstParser;
    private final CodeStructureRepository codeStructureRepository;
    private final ObjectMapper objectMapper;

    public CodeStructure analyzeAndStore(UUID repositoryId, String commitSha, String filePath, String content, String language) {
        FileStructureDto structure;
        if ("java".equalsIgnoreCase(language) || filePath.endsWith(".java")) {
            structure = javaAstParser.parseJavaFile(filePath, content);
        } else {
            structure = parseGenericFile(filePath, content, language);
        }

        String importsJson = writeJson(structure.imports());
        String symbolsJson = writeJson(new SymbolContainer(structure.classes(), structure.methods()));

        CodeStructure codeStructure = CodeStructure.builder()
                .repositoryId(repositoryId)
                .commitSha(commitSha)
                .filePath(filePath)
                .language(language)
                .packageName(structure.packageName())
                .isTest(structure.isTest())
                .lineCount(structure.lineCount())
                .importsJson(importsJson)
                .symbolsJson(symbolsJson)
                .build();

        return codeStructureRepository.save(codeStructure);
    }

    public FileStructureDto getStructure(CodeStructure cs) {
        List<String> imports = readJson(cs.getImportsJson(), new TypeReference<List<String>>() {});
        SymbolContainer symbols = readJson(cs.getSymbolsJson(), new TypeReference<SymbolContainer>() {});
        List<ClassSymbolDto> classes = symbols != null ? symbols.classes() : List.of();
        List<MethodSymbolDto> methods = symbols != null ? symbols.methods() : List.of();

        return new FileStructureDto(
                cs.getFilePath(),
                cs.getLanguage(),
                cs.getPackageName(),
                cs.isTest(),
                cs.getLineCount(),
                imports != null ? imports : List.of(),
                classes != null ? classes : List.of(),
                methods != null ? methods : List.of());
    }

    public record SymbolContainer(List<ClassSymbolDto> classes, List<MethodSymbolDto> methods) {}

    private FileStructureDto parseGenericFile(String filePath, String content, String language) {
        int lineCount = content != null ? content.split("\r\n|\r|\n", -1).length : 0;
        boolean isTest = filePath.toLowerCase().contains("test");
        List<ClassSymbolDto> classes = new ArrayList<>();
        List<MethodSymbolDto> methods = new ArrayList<>();
        List<String> imports = new ArrayList<>();

        if (content != null) {
            String[] lines = content.split("\r\n|\r|\n");
            for (int i = 0; i < lines.length; i++) {
                String line = lines[i].trim();
                int lineNum = i + 1;
                if (line.startsWith("import ") || line.startsWith("from ") || line.startsWith("require(")) {
                    imports.add(line);
                } else if (line.startsWith("class ") || line.startsWith("export class ") || line.startsWith("struct ") || line.startsWith("type ")) {
                    String[] parts = line.split("\\s+");
                    if (parts.length > 1) {
                        String name = parts[1].replaceAll("[^a-zA-Z0-9_]", "");
                        classes.add(new ClassSymbolDto(name, "CLASS", lineNum, lineNum, List.of(), List.of()));
                    }
                } else if (line.startsWith("def ") || line.startsWith("function ") || line.startsWith("export function ") || line.startsWith("func ")) {
                    String[] parts = line.split("\\s+");
                    if (parts.length > 1) {
                        String name = parts[1].replaceAll("\\(.*", "").replaceAll("[^a-zA-Z0-9_]", "");
                        methods.add(new MethodSymbolDto("", name, line, "void", lineNum, lineNum, List.of(), List.of()));
                    }
                }
            }
        }

        return new FileStructureDto(filePath, language, "", isTest, lineCount, imports, classes, methods);
    }

    private String writeJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception ex) {
            log.warn("Error serializing to JSON: {}", ex.getMessage());
            return "[]";
        }
    }

    private <T> T readJson(String json, TypeReference<T> typeRef) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (Exception ex) {
            log.warn("Error deserializing JSON: {}", ex.getMessage());
            return null;
        }
    }
}
