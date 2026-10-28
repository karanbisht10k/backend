package devPilot.backend.services.analysis;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.RecordDeclaration;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.expr.MethodCallExpr;

import devPilot.backend.services.analysis.StructuralSymbolModels.ClassSymbolDto;
import devPilot.backend.services.analysis.StructuralSymbolModels.FileStructureDto;
import devPilot.backend.services.analysis.StructuralSymbolModels.MethodSymbolDto;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class JavaAstParser {

    public FileStructureDto parseJavaFile(String filePath, String content) {
        if (content == null || content.isBlank()) {
            return new FileStructureDto(filePath, "java", "", isTestPath(filePath), 0, List.of(), List.of(), List.of());
        }

        int lineCount = content.split("\r\n|\r|\n", -1).length;
        boolean isTest = isTestPath(filePath);

        try {
            CompilationUnit cu = StaticJavaParser.parse(content);

            String packageName = cu.getPackageDeclaration()
                    .map(pd -> pd.getName().asString())
                    .orElse("");

            List<String> imports = cu.getImports().stream()
                    .map(id -> id.getName().asString())
                    .toList();

            List<ClassSymbolDto> classes = new ArrayList<>();
            List<MethodSymbolDto> methods = new ArrayList<>();

            for (TypeDeclaration<?> type : cu.getTypes()) {
                String typeName = type.getNameAsString();
                String kind = "CLASS";
                if (type.isClassOrInterfaceDeclaration()) {
                    kind = type.asClassOrInterfaceDeclaration().isInterface() ? "INTERFACE" : "CLASS";
                } else if (type.isEnumDeclaration()) {
                    kind = "ENUM";
                } else if (type.isRecordDeclaration()) {
                    kind = "RECORD";
                }

                int startLine = type.getBegin().map(pos -> pos.line).orElse(1);
                int endLine = type.getEnd().map(pos -> pos.line).orElse(lineCount);

                List<String> annotations = type.getAnnotations().stream()
                        .map(a -> a.getNameAsString())
                        .toList();

                if (annotations.stream().anyMatch(a -> a.contains("Test"))) {
                    isTest = true;
                }

                List<String> fieldTypes = new ArrayList<>();
                for (FieldDeclaration field : type.getFields()) {
                    fieldTypes.add(field.getElementType().asString());
                }

                classes.add(new ClassSymbolDto(typeName, kind, startLine, endLine, annotations, fieldTypes));

                for (MethodDeclaration method : type.getMethods()) {
                    int mStart = method.getBegin().map(pos -> pos.line).orElse(startLine);
                    int mEnd = method.getEnd().map(pos -> pos.line).orElse(endLine);
                    String mName = method.getNameAsString();
                    String returnType = method.getType().asString();
                    String signature = method.getDeclarationAsString(false, false, false);

                    List<String> methodAnnotations = method.getAnnotations().stream()
                            .map(a -> a.getNameAsString())
                            .toList();

                    if (methodAnnotations.stream().anyMatch(a -> a.equalsIgnoreCase("Test"))) {
                        isTest = true;
                    }

                    List<String> calledMethods = new ArrayList<>();
                    method.findAll(MethodCallExpr.class).forEach(call -> {
                        String called = call.getNameAsString();
                        Optional<?> scope = call.getScope();
                        if (scope.isPresent()) {
                            calledMethods.add(scope.get() + "." + called);
                        } else {
                            calledMethods.add(called);
                        }
                    });

                    methods.add(new MethodSymbolDto(
                            typeName,
                            mName,
                            signature,
                            returnType,
                            mStart,
                            mEnd,
                            methodAnnotations,
                            calledMethods));
                }
            }

            return new FileStructureDto(filePath, "java", packageName, isTest, lineCount, imports, classes, methods);
        } catch (Exception ex) {
            log.debug("AST parse failed for Java file {}: {}", filePath, ex.getMessage());
            return new FileStructureDto(filePath, "java", "", isTest, lineCount, List.of(), List.of(), List.of());
        }
    }

    private boolean isTestPath(String path) {
        String lower = path.toLowerCase();
        return lower.contains("/test/") || lower.contains("\\test\\") ||
                lower.endsWith("test.java") || lower.endsWith("tests.java") || lower.endsWith("testcase.java");
    }
}
