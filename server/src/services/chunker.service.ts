import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { CodeChunk, CodeStructure, ExtractedClass, ExtractedMethod } from '../types/index.js';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'target',
  '.mvn',
  '.vscode',
  '.idea',
  'vendor',
  'coverage',
  '.next'
]);

const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.java': 'java',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.sql': 'sql',
  '.md': 'markdown'
};

export class CodeChunkerService {
  /**
   * Recursively finds all code files in the repository
   */
  async discoverFiles(dir: string, baseDir: string = dir): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.discoverFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS[ext]) {
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          files.push(relPath);
        }
      }
    }

    return files;
  }

  /**
   * Extracts AST structures and creates embeddings-ready chunks from repository files
   */
  async processRepositoryFiles(
    repoRoot: string,
    repositoryId: string,
    maxFiles = 600,
    commitSha?: string
  ): Promise<{ chunks: CodeChunk[]; structures: CodeStructure[] }> {
    const fileList = await this.discoverFiles(repoRoot);
    const selectedFiles = fileList.slice(0, maxFiles);

    const allChunks: CodeChunk[] = [];
    const allStructures: CodeStructure[] = [];

    for (const relPath of selectedFiles) {
      const fullPath = path.join(repoRoot, relPath);
      let content = '';
      try {
        content = await fs.readFile(fullPath, 'utf-8');
      } catch {
        continue;
      }

      if (!content.trim() || content.length > 500000) continue; // skip binary or massive files

      const ext = path.extname(relPath).toLowerCase();
      const language = SUPPORTED_EXTENSIONS[ext] || 'text';

      try {
        // 1. Extract AST structures
        const structure = this.extractStructure(repositoryId, relPath, content, language, commitSha);
        allStructures.push(structure);

        // 2. Generate chunks for Gemini code embeddings
        const fileChunks = this.generateChunksForFile(repositoryId, relPath, content, language, structure, commitSha);
        allChunks.push(...fileChunks);
      } catch (err: any) {
        console.warn(`⚠️ [Chunker] Failed parsing AST for ${relPath}: ${err.message}. Creating fallback entry.`);
        const fallbackStructure: CodeStructure = {
          id: `${repositoryId}:${relPath}`,
          repositoryId,
          commitSha,
          filePath: relPath,
          language,
          imports: [],
          classes: [{ name: path.basename(relPath), kind: 'file', startLine: 1, endLine: content.split('\n').length }],
          methods: []
        };
        allStructures.push(fallbackStructure);
        const fileChunks = this.generateChunksForFile(repositoryId, relPath, content, language, fallbackStructure, commitSha);
        allChunks.push(...fileChunks);
      }
    }

    // 3. Resolve cross-file symbol references across extracted structures
    this.resolveCrossFileReferences(allStructures);

    return { chunks: allChunks, structures: allStructures };
  }

  /**
   * Resolves caller and reference relationships across files in the repository.
   * Genuinely correlates declared methods and imports across files.
   */
  resolveCrossFileReferences(structures: CodeStructure[]): void {
    // 1. Build a lookup index of all exported/declared symbols by file and by base file name
    const fileByNormalized = new Map<string, CodeStructure>();
    const fileByBaseName = new Map<string, CodeStructure[]>();

    for (const s of structures) {
      const norm = s.filePath.replace(/^\.?\//, '').replace(/\.[^/.]+$/, '');
      fileByNormalized.set(norm, s);

      const base = path.basename(s.filePath).replace(/\.[^/.]+$/, '');
      const list = fileByBaseName.get(base) || [];
      list.push(s);
      fileByBaseName.set(base, list);
    }

    // 2. For each structure, resolve imports to matching target structures
    for (const s of structures) {
      const currentDir = path.dirname(s.filePath);

      for (const imp of s.imports || []) {
        let targetStructure: CodeStructure | undefined;

        if (imp.startsWith('.')) {
          // Relative import
          const resolvedPath = path.normalize(path.join(currentDir, imp)).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\.[^/.]+$/, '');
          targetStructure = fileByNormalized.get(resolvedPath);
        } else {
          // Module / package import
          const base = path.basename(imp).replace(/\.[^/.]+$/, '');
          const candidates = fileByBaseName.get(base) || [];
          if (candidates.length === 1) {
            targetStructure = candidates[0];
          }
        }

        if (targetStructure) {
          // Mark target structure methods in caller methods if called
          const targetMethodNames = new Set(targetStructure.methods.map((m) => m.name));
          for (const m of s.methods) {
            for (const called of m.calledMethods || []) {
              const short = called.includes('.') ? called.split('.').pop()! : called;
              if (targetMethodNames.has(short) && !m.calledMethods?.includes(`${targetStructure.filePath}#${short}`)) {
                m.calledMethods?.push(`${targetStructure.filePath}#${short}`);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Extracts classes, methods, imports, and called symbols from code files.
   * Uses TypeScript compiler AST for TypeScript/JavaScript, and syntax-aware scanners for other languages.
   */
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

  /**
   * Syntax-aware AST extractor using the official TypeScript Compiler API.
   * Handles classes, interfaces, methods, functions, arrow functions, multiline declarations,
   * same-named methods in different classes, and call expressions with exact line accuracy.
   */
  private extractTypeScriptAst(
    repositoryId: string,
    filePath: string,
    content: string,
    language: string,
    commitSha?: string
  ): CodeStructure {
    const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
    const scriptKind = filePath.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : filePath.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : filePath.endsWith('.js')
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );

    const classes: ExtractedClass[] = [];
    const methods: ExtractedMethod[] = [];
    const imports: string[] = [];

    const getLine = (pos: number): number => {
      return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
    };

    // Helper to extract function call names from an AST node subtree
    const extractCallExpressions = (rootNode: ts.Node): string[] => {
      const calls: string[] = [];
      const visitCall = (n: ts.Node) => {
        if (ts.isCallExpression(n)) {
          const expr = n.expression;
          if (ts.isIdentifier(expr)) {
            calls.push(expr.text);
          } else if (ts.isPropertyAccessExpression(expr)) {
            calls.push(expr.name.text);
            try {
              calls.push(expr.getText(sourceFile));
            } catch {
              // fallback
            }
          }
        }
        ts.forEachChild(n, visitCall);
      };
      ts.forEachChild(rootNode, visitCall);
      return Array.from(new Set(calls));
    };

    // Helper to get text snippet for signature
    const getSignature = (node: ts.Node): string => {
      try {
        const text = node.getText(sourceFile);
        const firstLine = text.split('\n')[0].trim();
        return firstLine.substring(0, 100);
      } catch {
        return '';
      }
    };

    // Traverse AST nodes
    const visit = (node: ts.Node, currentClassName?: string) => {
      // 1. Imports
      if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          imports.push(node.moduleSpecifier.text);
        }
      } else if (ts.isCallExpression(node)) {
        // require('...')
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'require' &&
          node.arguments.length > 0 &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          imports.push((node.arguments[0] as ts.StringLiteral).text);
        }
      }

      // 2. Classes and Interfaces
      if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
        const name = node.name?.text || '(anonymous)';
        const startLine = getLine(node.getStart(sourceFile));
        const endLine = getLine(node.getEnd());
        const kind = ts.isInterfaceDeclaration(node) ? 'interface' : 'class';

        classes.push({
          name,
          kind,
          startLine,
          endLine,
          annotations: []
        });

        // Traverse children within the context of this class
        ts.forEachChild(node, (child) => visit(child, name));
        return;
      }

      // 3. Methods inside classes
      if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
        const name = node.name ? node.name.getText(sourceFile) : 'constructor';
        const startLine = getLine(node.getStart(sourceFile));
        const endLine = getLine(node.getEnd());
        const calls = extractCallExpressions(node);

        methods.push({
          name,
          className: currentClassName,
          signature: getSignature(node),
          startLine,
          endLine,
          calledMethods: calls
        });

        return; // already processed calls in body
      }

      // 4. Standalone functions
      if (ts.isFunctionDeclaration(node)) {
        const name = node.name?.text || '(anonymous)';
        const startLine = getLine(node.getStart(sourceFile));
        const endLine = getLine(node.getEnd());
        const calls = extractCallExpressions(node);

        methods.push({
          name,
          className: currentClassName,
          signature: getSignature(node),
          startLine,
          endLine,
          calledMethods: calls
        });

        return;
      }

      // 5. Const/let variable initialized with ArrowFunction or FunctionExpression
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) &&
            ts.isIdentifier(decl.name)
          ) {
            const name = decl.name.text;
            const startLine = getLine(decl.getStart(sourceFile));
            const endLine = getLine(decl.getEnd());
            const calls = extractCallExpressions(decl.initializer);

            methods.push({
              name,
              className: currentClassName,
              signature: getSignature(decl),
              startLine,
              endLine,
              calledMethods: calls
            });
          }
        }
      }

      ts.forEachChild(node, (child) => visit(child, currentClassName));
    };

    visit(sourceFile);

    return {
      id: `${repositoryId}:${filePath}`,
      repositoryId,
      commitSha,
      filePath,
      language,
      imports,
      classes,
      methods
    };
  }

  /**
   * Syntax-aware Java extractor with true brace counting for method & class line accuracy.
   */
  private extractJavaStructure(
    repositoryId: string,
    filePath: string,
    content: string,
    commitSha?: string
  ): CodeStructure {
    const lines = content.split('\n');
    const classes: ExtractedClass[] = [];
    const methods: ExtractedMethod[] = [];
    const imports: string[] = [];
    let packageName = '';

    const pkgMatch = content.match(/package\s+([A-Za-z0-9_.]+);/);
    if (pkgMatch) packageName = pkgMatch[1];

    // Helper to find closing brace line
    const findClosingBraceLine = (startIdx: number): number => {
      let braceCount = 0;
      let foundOpen = false;
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
          if (char === '{') {
            braceCount++;
            foundOpen = true;
          } else if (char === '}') {
            braceCount--;
            if (foundOpen && braceCount === 0) {
              return i + 1;
            }
          }
        }
      }
      return Math.min(lines.length, startIdx + 30);
    };

    let currentClassName: string | undefined;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Imports
      const impMatch = trimmed.match(/^import\s+(?:static\s+)?([A-Za-z0-9_.]+);/);
      if (impMatch) imports.push(impMatch[1]);

      // Classes
      const classMatch = line.match(/(?:public|protected|private)?\s*(?:static)?\s*(class|interface|record|enum)\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        currentClassName = classMatch[2];
        const startLine = idx + 1;
        const endLine = findClosingBraceLine(idx);
        const prevLine = idx > 0 ? lines[idx - 1].trim() : '';
        const annotations = prevLine.startsWith('@') ? [prevLine.replace('@', '')] : [];

        classes.push({
          name: currentClassName,
          kind: classMatch[1],
          startLine,
          endLine,
          annotations
        });
      }

      // Methods
      const methodMatch = line.match(/(?:public|protected|private)\s+(?:static\s+)?(?:[\w<>[\]]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
      if (methodMatch) {
        const name = methodMatch[1];
        if (name && !['if', 'while', 'for', 'switch'].includes(name)) {
          const startLine = idx + 1;
          const endLine = findClosingBraceLine(idx);
          const snippet = lines.slice(idx, endLine).join('\n');
          const calls = Array.from(snippet.matchAll(/(?:[a-zA-Z0-9_]+)\.([A-Za-z0-9_]+)\(/g))
            .map((m) => m[1])
            .filter((c, i, arr) => arr.indexOf(c) === i && c !== name);

          methods.push({
            name,
            className: currentClassName,
            signature: line.trim().substring(0, 80),
            startLine,
            endLine,
            calledMethods: calls
          });
        }
      }
    });

    return {
      id: `${repositoryId}:${filePath}`,
      repositoryId,
      commitSha,
      filePath,
      language: 'java',
      packageName,
      imports,
      classes,
      methods
    };
  }

  /**
   * Syntax-aware Python extractor using indentation-level tracking for line boundaries.
   */
  private extractPythonStructure(
    repositoryId: string,
    filePath: string,
    content: string,
    commitSha?: string
  ): CodeStructure {
    const lines = content.split('\n');
    const classes: ExtractedClass[] = [];
    const methods: ExtractedMethod[] = [];
    const imports: string[] = [];

    const getIndent = (str: string): number => {
      const match = str.match(/^([ \t]*)/);
      return match ? match[1].replace(/\t/g, '    ').length : 0;
    };

    // Helper to find block end based on indentation
    const findBlockEndLine = (startIdx: number, baseIndent: number): number => {
      for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue; // skip blank lines
        const indent = getIndent(line);
        if (indent <= baseIndent) {
          return i; // ends on previous non-blank line
        }
      }
      return lines.length;
    };

    let currentClassName: string | undefined;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Imports
      const impMatch = trimmed.match(/^(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.]+))/);
      if (impMatch) imports.push(impMatch[1] || impMatch[2]);

      // Classes
      const classMatch = line.match(/^class\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        currentClassName = classMatch[1];
        const baseIndent = getIndent(line);
        const startLine = idx + 1;
        const endLine = findBlockEndLine(idx, baseIndent);

        classes.push({
          name: currentClassName,
          kind: 'class',
          startLine,
          endLine
        });
      }

      // Functions / Methods
      const funcMatch = line.match(/^(\s*)(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
      if (funcMatch) {
        const indentLen = funcMatch[1].replace(/\t/g, '    ').length;
        const name = funcMatch[2];
        const startLine = idx + 1;
        const endLine = findBlockEndLine(idx, indentLen);
        const snippet = lines.slice(idx, endLine).join('\n');
        const calls = Array.from(snippet.matchAll(/(?:self\.|[a-zA-Z0-9_]+\.)([A-Za-z0-9_]+)\(/g))
          .map((m) => m[1])
          .filter((c, i, arr) => arr.indexOf(c) === i && c !== name);

        methods.push({
          name,
          className: indentLen > 0 ? currentClassName : undefined,
          signature: line.trim().substring(0, 80),
          startLine,
          endLine,
          calledMethods: calls
        });
      }
    });

    return {
      id: `${repositoryId}:${filePath}`,
      repositoryId,
      commitSha,
      filePath,
      language: 'python',
      imports,
      classes,
      methods
    };
  }

  /**
   * Limited fallback parser for other languages (Go, Rust, etc.)
   */
  private extractGenericStructure(
    repositoryId: string,
    filePath: string,
    content: string,
    language: string,
    commitSha?: string
  ): CodeStructure {
    const lines = content.split('\n');
    const classes: ExtractedClass[] = [];
    const methods: ExtractedMethod[] = [];
    const imports: string[] = [];

    classes.push({
      name: path.basename(filePath),
      kind: 'file',
      startLine: 1,
      endLine: lines.length
    });

    return {
      id: `${repositoryId}:${filePath}`,
      repositoryId,
      commitSha,
      filePath,
      language,
      imports,
      classes,
      methods
    };
  }

  /**
   * Generates overlapping text chunks for vector embeddings
   */
  generateChunksForFile(
    repositoryId: string,
    filePath: string,
    content: string,
    language: string,
    structure: CodeStructure,
    commitSha?: string
  ): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];

    // If small file, treat whole file as a chunk
    if (lines.length <= 60) {
      chunks.push({
        id: `${repositoryId}:${filePath}:1-${lines.length}`,
        repositoryId,
        commitSha,
        filePath,
        language,
        startLine: 1,
        endLine: lines.length,
        symbolName: structure.classes[0]?.name || path.basename(filePath),
        symbolType: structure.classes[0]?.kind === 'interface' ? 'interface' : 'file',
        content: `// File: ${filePath}\n${content}`
      });
      return chunks;
    }

    // Sliding window of 50 lines with 10 line overlap
    const windowSize = 50;
    const overlap = 10;
    let start = 0;

    while (start < lines.length) {
      const end = Math.min(lines.length, start + windowSize);
      const chunkLines = lines.slice(start, end);
      const startLine = start + 1;
      const endLine = end;

      // Find if any method or class belongs in this window
      const matchedMethod = structure.methods.find(
        (m) => m.startLine >= startLine && m.startLine <= endLine
      );
      const matchedClass = structure.classes.find(
        (c) => c.startLine >= startLine && c.startLine <= endLine
      );

      const symbolName = matchedMethod?.name || matchedClass?.name || path.basename(filePath);
      const symbolType = matchedMethod ? 'method' : matchedClass ? 'class' : 'block';

      const header = `// Repository: ${repositoryId} | File: ${filePath} (L${startLine}-L${endLine}) | Symbol: ${symbolName}\n`;
      const chunkText = header + chunkLines.join('\n');

      chunks.push({
        id: `${repositoryId}:${filePath}:${startLine}-${endLine}`,
        repositoryId,
        commitSha,
        filePath,
        language,
        startLine,
        endLine,
        symbolName,
        symbolType,
        content: chunkText
      });

      if (end >= lines.length) break;
      start += windowSize - overlap;
    }

    return chunks;
  }
}

export const codeChunkerService = new CodeChunkerService();
export const chunkerService = codeChunkerService;
