package devPilot.backend.services.analysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

import devPilot.backend.entity.CodeStructure;
import devPilot.backend.repository.CodeStructureRepository;
import devPilot.backend.services.impact.ChangeImpactService;
import devPilot.backend.services.impact.ImpactModels.PrImpactReportDto;

class AstAndChangeImpactWorkflowTest {

    @Test
    void coreAstAnalysisAndChangeImpactWorkflowSmokeCheck() {
        JavaAstParser astParser = new JavaAstParser();
        ObjectMapper objectMapper = new ObjectMapper();
        CodeStructureRepository codeStructureRepo = mock(CodeStructureRepository.class);
        StructuralAnalysisService analysisService = new StructuralAnalysisService(astParser, codeStructureRepo, objectMapper);
        ChangeImpactService impactService = new ChangeImpactService(codeStructureRepo, analysisService);

        UUID repoId = UUID.randomUUID();

        String serviceCode = """
                package com.example.service;

                import org.springframework.stereotype.Service;

                @Service
                public class OrderService {
                    public boolean processOrder(String orderId) {
                        return orderId != null && !orderId.isBlank();
                    }
                }
                """;

        String controllerCode = """
                package com.example.controller;

                import com.example.service.OrderService;
                import org.springframework.web.bind.annotation.RestController;

                @RestController
                public class OrderController {
                    private final OrderService orderService;

                    public OrderController(OrderService orderService) {
                        this.orderService = orderService;
                    }

                    public void create(String id) {
                        orderService.processOrder(id);
                    }
                }
                """;

        when(codeStructureRepo.save(any(CodeStructure.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CodeStructure csService = analysisService.analyzeAndStore(
                repoId, "sha-1", "src/main/java/com/example/service/OrderService.java", serviceCode, "java");
        CodeStructure csController = analysisService.analyzeAndStore(
                repoId, "sha-1", "src/main/java/com/example/controller/OrderController.java", controllerCode, "java");

        when(codeStructureRepo.findByRepositoryId(repoId)).thenReturn(List.of(csService, csController));

        // Realistic diff touching lines 7-8 of OrderService.java
        String diffPatch = "@@ -7,2 +7,4 @@\n" +
                "-    public boolean processOrder(String orderId) {\n" +
                "+    public boolean processOrder(String orderId) {\n" +
                "+        if (orderId == null) throw new IllegalArgumentException();\n";

        List<Map<String, Object>> changedFilesRaw = List.of(Map.of(
                "filename", "src/main/java/com/example/service/OrderService.java",
                "status", "modified",
                "additions", 2,
                "deletions", 1,
                "patch", diffPatch
        ));

        PrImpactReportDto impactReport = impactService.analyzeImpact(repoId, changedFilesRaw);

        assertNotNull(impactReport);
        assertFalse(impactReport.changedFiles().isEmpty());

        // Verify affected method recognized
        assertTrue(impactReport.changedFiles().get(0).affectedMethods().contains("OrderService.processOrder"),
                "Expected OrderService.processOrder to be recognized in affected methods");

        // Verify caller discovered in OrderController
        boolean callerFound = impactReport.callerHierarchy().stream()
                .anyMatch(c -> c.callerClass().equals("OrderController") && c.calledSymbol().contains("processOrder"));
        assertTrue(callerFound, "Expected caller OrderController.create() -> OrderService.processOrder to be discovered");

        // Verify missing test coverage flagged
        boolean missingTestFlagged = impactReport.behaviorRisks().stream()
                .anyMatch(r -> r.risk().contains("Missing direct test coverage"));
        assertTrue(missingTestFlagged, "Expected missing test coverage to be flagged for OrderService");
    }
}
