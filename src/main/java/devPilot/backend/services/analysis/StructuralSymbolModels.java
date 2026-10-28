package devPilot.backend.services.analysis;

import java.util.List;

public class StructuralSymbolModels {

    public record FileStructureDto(
            String filePath,
            String language,
            String packageName,
            boolean isTest,
            int lineCount,
            List<String> imports,
            List<ClassSymbolDto> classes,
            List<MethodSymbolDto> methods) {
    }

    public record ClassSymbolDto(
            String name,
            String kind,
            int startLine,
            int endLine,
            List<String> annotations,
            List<String> fieldTypes) {
    }

    public record MethodSymbolDto(
            String className,
            String name,
            String signature,
            String returnType,
            int startLine,
            int endLine,
            List<String> annotations,
            List<String> calledMethods) {
    }
}
