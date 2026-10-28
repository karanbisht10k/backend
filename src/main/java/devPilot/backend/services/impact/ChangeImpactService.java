package devPilot.backend.services.impact;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import devPilot.backend.entity.CodeStructure;
import devPilot.backend.repository.CodeStructureRepository;
import devPilot.backend.services.analysis.StructuralAnalysisService;
import devPilot.backend.services.analysis.StructuralSymbolModels.ClassSymbolDto;
import devPilot.backend.services.analysis.StructuralSymbolModels.FileStructureDto;
import devPilot.backend.services.analysis.StructuralSymbolModels.MethodSymbolDto;
import devPilot.backend.services.impact.ImpactModels.AffectedComponentDto;
import devPilot.backend.services.impact.ImpactModels.BehaviorRiskDto;
import devPilot.backend.services.impact.ImpactModels.CallerHierarchyDto;
import devPilot.backend.services.impact.ImpactModels.ChangedFileDto;
import devPilot.backend.services.impact.ImpactModels.PrImpactReportDto;
import devPilot.backend.services.impact.ImpactModels.RelevantTestDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChangeImpactService {

    private static final Pattern HUNK_PATTERN = Pattern.compile("@@ -(\\d+)(?:,(\\d+))? \\+(\\d+)(?:,(\\d+))? @@");

    private final CodeStructureRepository codeStructureRepository;
    private final StructuralAnalysisService structuralAnalysisService;

    public PrImpactReportDto analyzeImpact(
            UUID repositoryId,
            List<Map<String, Object>> changedFilesRaw) {

        List<CodeStructure> allRepoStructures = codeStructureRepository.findByRepositoryId(repositoryId);
        Map<String, FileStructureDto> structureMap = new HashMap<>();
        for (CodeStructure cs : allRepoStructures) {
            structureMap.put(cs.getFilePath(), structuralAnalysisService.getStructure(cs));
        }

        List<ChangedFileDto> changedFiles = new ArrayList<>();
        Map<String, Set<String>> classToAffectedMethods = new HashMap<>();
        Map<String, String> classToFilePath = new HashMap<>();

        for (Map<String, Object> fileMap : changedFilesRaw) {
            String filename = String.valueOf(fileMap.get("filename"));
            String status = String.valueOf(fileMap.get("status"));
            int additions = fileMap.get("additions") instanceof Number n ? n.intValue() : 0;
            int deletions = fileMap.get("deletions") instanceof Number n ? n.intValue() : 0;
            String patch = fileMap.get("patch") != null ? String.valueOf(fileMap.get("patch")) : "";

            List<Integer> modifiedLines = parseModifiedLines(patch);
            List<String> affectedMethodsInFile = new ArrayList<>();

            FileStructureDto fileStructure = structureMap.get(filename);
            if (fileStructure != null) {
                for (ClassSymbolDto clazz : fileStructure.classes()) {
                    classToFilePath.put(clazz.name(), filename);
                }

                for (MethodSymbolDto method : fileStructure.methods()) {
                    boolean methodTouched = modifiedLines.stream()
                            .anyMatch(line -> line >= method.startLine() && line <= method.endLine());
                    if (methodTouched) {
                        String fullName = (method.className() != null && !method.className().isBlank())
                                ? method.className() + "." + method.name()
                                : method.name();
                        affectedMethodsInFile.add(fullName);

                        if (method.className() != null && !method.className().isBlank()) {
                            classToAffectedMethods
                                    .computeIfAbsent(method.className(), k -> new HashSet<>())
                                    .add(method.name());
                        }
                    }
                }
            }

            changedFiles.add(new ChangedFileDto(
                    filename,
                    status,
                    additions,
                    deletions,
                    modifiedLines,
                    affectedMethodsInFile));
        }

        // 2. Identify Affected Components and their roles
        List<AffectedComponentDto> affectedComponents = new ArrayList<>();
        for (Map.Entry<String, Set<String>> entry : classToAffectedMethods.entrySet()) {
            String className = entry.getKey();
            String path = classToFilePath.getOrDefault(className, "");
            String role = determineComponentRole(className, path);
            affectedComponents.add(new AffectedComponentDto(
                    className,
                    path,
                    role,
                    new ArrayList<>(entry.getValue())));
        }

        // 3. Trace Known Callers and Dependent Code across the repository
        List<CallerHierarchyDto> callerHierarchy = new ArrayList<>();
        for (Map.Entry<String, Set<String>> entry : classToAffectedMethods.entrySet()) {
            String targetClass = entry.getKey();
            Set<String> targetMethods = entry.getValue();

            for (Map.Entry<String, FileStructureDto> fileEntry : structureMap.entrySet()) {
                String callerFilePath = fileEntry.getKey();
                FileStructureDto callerFile = fileEntry.getValue();

                // Skip the changed file itself when searching for callers
                if (callerFilePath.equals(classToFilePath.get(targetClass))) {
                    continue;
                }

                boolean importsTarget = callerFile.imports().stream()
                        .anyMatch(imp -> imp.endsWith("." + targetClass) || imp.contains("." + targetClass + "."));

                for (MethodSymbolDto callerMethod : callerFile.methods()) {
                    for (String called : callerMethod.calledMethods()) {
                        for (String targetMethod : targetMethods) {
                            if (called.endsWith("." + targetMethod) || called.equals(targetMethod)) {
                                callerHierarchy.add(new CallerHierarchyDto(
                                        callerFilePath,
                                        callerMethod.className(),
                                        callerMethod.name(),
                                        targetClass + "." + targetMethod,
                                        true,
                                        "Method call in " + callerFilePath + ":" + callerMethod.startLine()));
                            }
                        }
                    }
                }

                if (importsTarget && callerHierarchy.stream().noneMatch(c -> c.callerFilePath().equals(callerFilePath))) {
                    callerHierarchy.add(new CallerHierarchyDto(
                            callerFilePath,
                            callerFile.classes().isEmpty() ? "" : callerFile.classes().get(0).name(),
                            "(Class import / dependency)",
                            targetClass,
                            true,
                            "Imports " + targetClass + " in " + callerFilePath));
                }
            }
        }

        // 4. Retrieve Relevant Existing Tests
        List<RelevantTestDto> relevantTests = new ArrayList<>();
        Set<String> testedClasses = new HashSet<>();

        for (Map.Entry<String, FileStructureDto> fileEntry : structureMap.entrySet()) {
            String testPath = fileEntry.getKey();
            FileStructureDto testStructure = fileEntry.getValue();

            if (testStructure.isTest()) {
                for (String targetClass : classToAffectedMethods.keySet()) {
                    boolean matchesName = testPath.toLowerCase().contains(targetClass.toLowerCase());
                    boolean importsClass = testStructure.imports().stream()
                            .anyMatch(imp -> imp.endsWith("." + targetClass));

                    if (matchesName || importsClass) {
                        testedClasses.add(targetClass);
                        List<String> testMethods = testStructure.methods().stream()
                                .map(MethodSymbolDto::name)
                                .toList();
                        String testClass = testStructure.classes().isEmpty() ? "" : testStructure.classes().get(0).name();
                        relevantTests.add(new RelevantTestDto(
                                testPath,
                                testClass,
                                testMethods,
                                true));
                    }
                }
            }
        }

        // 5. Behavior Risks & Targeted Recommendations
        List<BehaviorRiskDto> behaviorRisks = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();

        for (AffectedComponentDto component : affectedComponents) {
            if (!testedClasses.contains(component.className())) {
                behaviorRisks.add(new BehaviorRiskDto(
                        "Missing direct test coverage",
                        "Component " + component.className() + " has modified methods (" +
                                String.join(", ", component.methodsAffected()) + ") but no dedicated test file was detected.",
                        component.className(),
                        false));
                recommendations.add("Add unit/regression tests for " + component.className() + " covering: " +
                        String.join(", ", component.methodsAffected()));
            }

            long callerCount = callerHierarchy.stream()
                    .filter(c -> c.calledSymbol().startsWith(component.className()))
                    .count();
            if (callerCount > 0) {
                behaviorRisks.add(new BehaviorRiskDto(
                        "Downstream caller cascade risk",
                        "Changes to " + component.className() + " directly affect " + callerCount +
                                " confirmed caller(s) across the repository.",
                        component.className(),
                        false));
                recommendations.add("Verify callers of " + component.className() +
                        " to ensure API contract compatibility and return type assumptions remain intact.");
            }
        }

        if (affectedComponents.isEmpty() && !changedFiles.isEmpty()) {
            behaviorRisks.add(new BehaviorRiskDto(
                    "Non-structural or configuration modification",
                    "Modified files are outside the parsed AST component graph (e.g. build scripts, config, documentation, or unsupported language).",
                    "Repository Config",
                    true));
        }

        return new PrImpactReportDto(
                changedFiles,
                affectedComponents,
                callerHierarchy,
                relevantTests,
                behaviorRisks,
                recommendations);
    }

    private List<Integer> parseModifiedLines(String patch) {
        if (patch == null || patch.isBlank()) {
            return List.of();
        }

        List<Integer> lines = new ArrayList<>();
        String[] patchLines = patch.split("\r\n|\r|\n");
        int currentNewLine = 0;

        for (String line : patchLines) {
            Matcher matcher = HUNK_PATTERN.matcher(line);
            if (matcher.find()) {
                currentNewLine = Integer.parseInt(matcher.group(3));
            } else if (line.startsWith("+") && !line.startsWith("+++")) {
                lines.add(currentNewLine);
                currentNewLine++;
            } else if (!line.startsWith("-")) {
                currentNewLine++;
            }
        }

        return lines;
    }

    private String determineComponentRole(String className, String path) {
        String lower = (className + " " + path).toLowerCase();
        if (lower.contains("controller") || lower.contains("resource") || lower.contains("endpoint")) {
            return "CONTROLLER";
        } else if (lower.contains("service") || lower.contains("manager")) {
            return "SERVICE";
        } else if (lower.contains("repository") || lower.contains("dao")) {
            return "REPOSITORY";
        } else if (lower.contains("entity") || lower.contains("model")) {
            return "ENTITY";
        } else if (lower.contains("config")) {
            return "CONFIG";
        }
        return "COMPONENT";
    }
}
