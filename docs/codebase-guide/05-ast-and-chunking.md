# Module 05: AST Parsing, Skeleton Extraction & Code Chunking

## 1. What is an Abstract Syntax Tree (AST)?

When a compiler or code analysis tool reads source code, it does not treat it as raw text. Instead, it converts character streams into a hierarchical tree data structure called an **Abstract Syntax Tree (AST)**.

Every node in the tree corresponds to a syntactic construct in the language: an `ImportDeclaration`, a `ClassDeclaration`, a `MethodDeclaration`, a `BinaryExpression`, or a `CallExpression`.

### Concrete Example:
Consider this simple TypeScript snippet from an authentication service:

```typescript
// authService.ts
import { TokenManager } from './tokenManager';

export class AuthService {
  async authenticate(user: string, token: string): Promise<boolean> {
    const isValid = TokenManager.verify(token);
    return isValid;
  }
}
```

### Conceptual Syntax Tree Representation:

```text
SourceFile ("authService.ts")
 ├── ImportDeclaration
 │    ├── ImportClause (TokenManager)
 │    └── StringLiteral ("./tokenManager")
 └── ClassDeclaration ("AuthService")
      └── MethodDeclaration ("authenticate")
           ├── Parameters: [user: string, token: string]
           ├── TypeReference: Promise<boolean>
           └── Block
                ├── VariableStatement: const isValid = ...
                │    └── CallExpression
                │         ├── PropertyAccessExpression: TokenManager.verify
                │         └── Arguments: [token]
                └── ReturnStatement: isValid
```

From this tree, CodeSense extracts:
1. **Declared Symbol**: Class `AuthService` (Lines 3–8).
2. **Declared Method**: `authenticate` (Lines 4–7).
3. **External Import**: `./tokenManager`.
4. **Call Expression**: `TokenManager.verify` invoked inside `authenticate`.

---

## 2. AST Parser Selection in CodeSense

Earlier architectural documentation mentioned *Tree-sitter*. However, an inspection of the actual working codebase reveals:

**CodeSense uses the official TypeScript Compiler API (`typescript`) as its primary AST engine**, complemented by specialized lexical scanners for Java and Python:

```typescript
// server/src/services/chunker.service.ts: lines 187-203
extractStructure(
  repositoryId: string,
  filePath: string,
  content: string,
  language: string,
  commitSha?: string
): CodeStructure {
  if (language === 'typescript' || language === 'javascript') {
    return this.extractTypeScriptAst(repositoryId, filePath, content, language, commitSha);
  } else if (language === 'java') {
    return this.extractJavaStructure(repositoryId, filePath, content, commitSha);
  } else if (language === 'python') {
    return this.extractPythonStructure(repositoryId, filePath, content, commitSha);
  } else {
    return this.extractGenericStructure(repositoryId, filePath, content, language, commitSha);
  }
}
```

### Why the TypeScript Compiler API was Chosen:
- **No Native Binary Dependencies**: Tree-sitter requires platform-specific C/C++ compiled binaries that often fail to build across Windows, ARM Linux, and macOS environments. The official TypeScript compiler runs natively in any Node.js environment.
- **Full Type-Aware AST**: Handles modern TypeScript features including decorators, interfaces, type aliases, JSX/TSX syntax, and arrow functions with 100% syntactic accuracy.

---

## 3. How the TypeScript AST Extractor Works

In `server/src/services/chunker.service.ts`:

1. **Source File Creation**:
   ```typescript
   const sourceFile = ts.createSourceFile(
     filePath,
     content,
     ts.ScriptTarget.Latest,
     true,
     scriptKind // Handles TSX, JSX, TS, JS
   );
   ```
2. **Line Number Resolution**:
   Lines are 1-indexed using the source file's character offset map:
   ```typescript
   const getLine = (pos: number): number => {
     return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
   };
   ```
3. **AST Traversal (`visitNode`)**:
   Recursively walks the tree, capturing:
   - `ts.isImportDeclaration`: Records relative and module import paths.
   - `ts.isClassDeclaration` / `ts.isInterfaceDeclaration`: Captures class name and start/end line bounds.
   - `ts.isMethodDeclaration` / `ts.isFunctionDeclaration` / `ts.isArrowFunction`: Captures method name, signature, and class enclosure.
4. **Call Expression Harvesting**:
   For every method subtree, the extractor runs `extractCallExpressions(rootNode)`:
   - When encountering a `ts.isCallExpression`, it checks whether the invocation is an identifier (`verify()`) or a property access (`TokenManager.verify()`).
   - Both the unqualified name (`verify`) and qualified name (`TokenManager.verify`) are stored in `calledMethods[]`.

---

## 4. Multi-Language Scanning (Java & Python)

For codebases containing non-TypeScript languages, CodeSense implements syntax-aware structural parsers:

### Java Structure Extractor (`extractJavaStructure`):
- Uses regex patterns to identify `package`, `import`, `class`, `interface`, and method declarations.
- Employs **brace-depth tracking** (`{` vs `}`) to compute exact start and end line ranges for every class and method block.
- Extracts called methods by inspecting tokens preceding parentheses (e.g., `service.processOrder(...)`).

### Python Structure Extractor (`extractPythonStructure`):
- Scans for `import ...` and `from ... import ...` statements.
- Tracks `class Name:` and `def method_name(...):` declarations.
- Uses **indentation block depth tracking** (spaces/tabs) to determine where Python function and class bodies conclude.

---

## 5. Cross-File Reference Resolution

Extracting AST symbols per file is only the first step. The true power of CodeSense lies in **linking declarations across files**:

In `chunker.service.ts`:
```typescript
resolveCrossFileReferences(structures: CodeStructure[]): void
```

1. **Symbol Index Construction**:
   Builds an in-memory map of all normalized file paths and base file names across the repository.
2. **Import Target Matching**:
   - For relative imports (`./tokenManager`), resolves the exact target file path (`services/tokenManager.ts`).
   - For named imports, matches declared classes across candidate structures.
3. **Call Graph Linking**:
   When method `authenticate()` calls `verify()`, and `tokenManager.ts` exports `verify()`, the system updates `calledMethods[]` to contain the fully qualified cross-file symbol reference:
   `services/tokenManager.ts#verify`.

This cross-file reference linking forms the foundation of CodeSense's deterministic PR impact analysis.

---

## 6. The Code Chunking Algorithm

Once AST structures are persisted, source code must be chunked into fragments suitable for vector embedding generation.

Unlike naive text splitters that break code at arbitrary character lengths, CodeSense uses **AST-attributed sliding-window chunking**:

```typescript
// server/src/services/chunker.service.ts: lines 627-698
generateChunksForFile(repositoryId, filePath, content, language, structure, commitSha)
```

1. **Small File Optimization**:
   - If a file is 60 lines or fewer, the entire file is preserved as a single chunk.
   - Prevents splitting small classes, interfaces, or config files across artificial boundaries.
2. **Sliding Window Slicing**:
   - For larger files, uses a **50-line window with a 10-line overlap**.
   - Window Step: `50 - 10 = 40 lines` per advancement.
3. **AST Symbol Attribution**:
   Every chunk is correlated with the AST structures extracted in the previous pass:
   - Scans whether any method or class declaration overlaps the chunk line range `[startLine, endLine]`.
   - If an AST symbol is present, the chunk records `symbolName: "authenticate"` and `symbolType: "method"`.
   - Attaches a structured header to the chunk text:
     ```text
     // Repository: expressjs/express | File: src/router/index.js (L41-L90) | Symbol: handle
     ```
   - This header ensures that when Gemini embeds or retrieves the chunk, the model understands the file name, line numbers, and enclosing function name.

---

## 7. Five Short Questions to Test Your Understanding

1. What compiler library does CodeSense actually use to parse TypeScript and JavaScript code?
2. How does the TypeScript AST extractor record exact line numbers for classes and methods?
3. How does the Java parser know where a method body ends without using an AST parser?
4. What does `resolveCrossFileReferences` append to `calledMethods` when a call is linked across files?
5. What are the window size and overlap parameters used by the code chunking algorithm?
