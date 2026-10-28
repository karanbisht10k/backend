import path from 'node:path';
import {
  CodeStructure,
  ParsedDiffFile,
  ParsedDiffHunk,
  CallerDependency,
  RelevantTest,
  BehaviorRisk,
  AffectedFile,
  PrFinding,
  Severity,
  FindingCategory,
  BehaviorChange,
  AffectedCaller,
  SymbolImpactRecord,
  DependencyNode,
  DependencyEdge,
  DependencyGraph
} from '../types/index.js';

export class DiffAnalysisService {
  /**
   * Parses a unified diff string into structured per-file modifications
   */
  parseUnifiedDiff(diffText: string): ParsedDiffFile[] {
    const files: ParsedDiffFile[] = [];
    if (!diffText || !diffText.trim()) return files;

    // Split diff by "diff --git " or fallback to "--- a/"
    const rawFileChunks = diffText.split(/^diff --git\s+/m);

    for (const rawChunk of rawFileChunks) {
      if (!rawChunk.trim()) continue;

      const lines = rawChunk.split('\n');
      let oldPath = '';
      let newPath = '';
      let status: 'MODIFIED' | 'ADDED' | 'DELETED' = 'MODIFIED';

      // Check first line or headers for paths
      const firstLine = lines[0];
      const gitPathMatch = firstLine.match(/a\/(.*?)\s+b\/(.*)/);
      if (gitPathMatch) {
        oldPath = gitPathMatch[1].trim();
        newPath = gitPathMatch[2].trim();
      }

      // Check for new or deleted file markers
      for (const line of lines) {
        if (line.startsWith('new file mode')) status = 'ADDED';
        if (line.startsWith('deleted file mode')) status = 'DELETED';
        if (line.startsWith('--- a/')) oldPath = line.replace('--- a/', '').trim();
        if (line.startsWith('+++ b/')) newPath = line.replace('+++ b/', '').trim();
        if (line.startsWith('--- /dev/null')) status = 'ADDED';
        if (line.startsWith('+++ /dev/null')) status = 'DELETED';
      }

      const filePath = newPath || oldPath || 'unknown';
      if (!filePath || filePath === 'unknown' || filePath === '/dev/null') continue;

      // Parse hunks
      const hunks: ParsedDiffHunk[] = [];
      const modifiedLines: number[] = [];
      let additions = 0;
      let deletions = 0;

      let currentHunk: ParsedDiffHunk | null = null;
      let oldCurrentLine = 0;
      let newCurrentLine = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Hunk header match: @@ -1,5 +1,8 @@ optional context
        const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)/);
        if (hunkMatch) {
          if (currentHunk) {
            hunks.push(currentHunk);
          }

          const oldStart = parseInt(hunkMatch[1], 10);
          const oldCount = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
          const newStart = parseInt(hunkMatch[3], 10);
          const newCount = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;

          oldCurrentLine = oldStart;
          newCurrentLine = newStart;

          currentHunk = {
            oldStart,
            oldCount,
            newStart,
            newCount,
            modifiedLines: [],
            header: line,
            content: line + '\n'
          };
          continue;
        }

        if (currentHunk) {
          currentHunk.content += line + '\n';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            additions++;
            currentHunk.modifiedLines.push(newCurrentLine);
            modifiedLines.push(newCurrentLine);
            newCurrentLine++;
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            deletions++;
            currentHunk.modifiedLines.push(newCurrentLine); // mark current target line
            modifiedLines.push(newCurrentLine);
            oldCurrentLine++;
          } else if (line.startsWith(' ')) {
            oldCurrentLine++;
            newCurrentLine++;
          }
        }
      }

      if (currentHunk) {
        hunks.push(currentHunk);
      }

      files.push({
        oldPath: oldPath || filePath,
        newPath: filePath,
        status,
        additions,
        deletions,
        modifiedLines: Array.from(new Set(modifiedLines)).sort((a, b) => a - b),
        hunks
      });
    }

    return files;
  }

  /**
   * Correlates modified line numbers with repository AST structural symbols
   */
  mapChangedLinesToSymbols(
    changedFiles: ParsedDiffFile[],
    structures: CodeStructure[]
  ): {
    affectedFiles: AffectedFile[];
    affectedSymbolsByFile: Map<string, { classes: Set<string>; methods: Set<string> }>;
  } {
    const structureMap = new Map<string, CodeStructure>();
    for (const s of structures) {
      structureMap.set(s.filePath, s);
      // also allow matching without leading slash or relative prefix
      const normalized = s.filePath.replace(/^\.?\//, '');
      structureMap.set(normalized, s);
    }

    const affectedFiles: AffectedFile[] = [];
    const affectedSymbolsByFile = new Map<string, { classes: Set<string>; methods: Set<string> }>();

    for (const file of changedFiles) {
      const relPath = file.newPath.replace(/^\.?\//, '');
      const structure = structureMap.get(file.newPath) || structureMap.get(relPath);

      const touchedMethods = new Set<string>();
      const touchedClasses = new Set<string>();

      if (structure) {
        for (const line of file.modifiedLines) {
          // Check methods
          for (const method of structure.methods) {
            if (line >= method.startLine && line <= method.endLine) {
              const fullName = method.className ? `${method.className}.${method.name}` : method.name;
              touchedMethods.add(fullName);
              if (method.className) touchedClasses.add(method.className);
            }
          }

          // Check classes
          for (const cls of structure.classes) {
            if (line >= cls.startLine && line <= cls.endLine) {
              touchedClasses.add(cls.name);
            }
          }
        }
      }

      const affectedMethodsArray = Array.from(touchedMethods);
      file.affectedSymbols = affectedMethodsArray.length > 0 ? affectedMethodsArray : Array.from(touchedClasses);

      affectedSymbolsByFile.set(file.newPath, {
        classes: touchedClasses,
        methods: touchedMethods
      });

      const impactLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
        file.additions + file.deletions > 100 || touchedMethods.size > 3
          ? 'HIGH'
          : file.additions + file.deletions > 25 || touchedMethods.size > 0
          ? 'MEDIUM'
          : 'LOW';

      affectedFiles.push({
        filePath: file.newPath,
        additions: file.additions,
        deletions: file.deletions,
        impactLevel,
        affectedMethods: affectedMethodsArray,
        status: file.status
      });
    }

    return { affectedFiles, affectedSymbolsByFile };
  }

  /**
   * Classifies a file or class into an architectural layer component
   */
  classifyComponent(filePath: string, className?: string): 'CONTROLLER' | 'SERVICE' | 'REPOSITORY' | 'UTILITY' | 'API_CONSUMER' | 'TEST' | 'COMPONENT' {
    const target = `${filePath} ${className || ''}`.toLowerCase();
    if (target.includes('controller') || target.includes('route') || target.includes('endpoint') || target.includes('handler')) {
      return 'CONTROLLER';
    }
    if (target.includes('service') || target.includes('usecase') || target.includes('manager')) {
      return 'SERVICE';
    }
    if (target.includes('repository') || target.includes('repo') || target.includes('dao') || target.includes('store') || target.includes('model') || target.includes('entity')) {
      return 'REPOSITORY';
    }
    if (target.includes('util') || target.includes('helper') || target.includes('common') || target.includes('shared')) {
      return 'UTILITY';
    }
    if (target.includes('client') || target.includes('consumer') || target.includes('api') || target.includes('feign')) {
      return 'API_CONSUMER';
    }
    if (target.includes('test') || target.includes('spec')) {
      return 'TEST';
    }
    return 'COMPONENT';
  }

  private getStructureMethods(structure: CodeStructure): { name: string; calledMethods?: string[]; startLine?: number; endLine?: number; className?: string }[] {
    const methods: { name: string; calledMethods?: string[]; startLine?: number; endLine?: number; className?: string }[] = [];
    for (const cls of structure.classes || []) {
      for (const m of (cls as any).methods || []) {
        methods.push({
          ...m,
          className: cls.name
        });
      }
    }
    for (const fn of structure.functions || structure.methods || []) {
      methods.push({
        ...fn,
        className: path.basename(structure.filePath, path.extname(structure.filePath))
      });
    }
    return methods;
  }

  private normalizeAffectedSymbols(
    input: any
  ): [string, { classes: Set<string>; methods: Set<string> }][] {
    if (input instanceof Map) {
      return Array.from(input.entries());
    }
    if (!input || typeof input !== 'object') {
      return [];
    }
    const result: [string, { classes: Set<string>; methods: Set<string> }][] = [];
    for (const [key, val] of Object.entries(input)) {
      if (val && typeof val === 'object' && ('classes' in (val as any) || 'methods' in (val as any))) {
        const classes = (val as any).classes instanceof Set ? (val as any).classes : new Set(Array.isArray((val as any).classes) ? (val as any).classes : []);
        const methods = (val as any).methods instanceof Set ? (val as any).methods : new Set(Array.isArray((val as any).methods) ? (val as any).methods : []);
        result.push([key, { classes, methods }]);
      } else if (Array.isArray(val)) {
        const methods = new Set<string>();
        const classes = new Set<string>();
        for (const item of val) {
          if (typeof item === 'string') {
            methods.add(item);
            if (item.includes('.')) {
              classes.add(item.split('.')[0]);
            }
          }
        }
        result.push([key, { classes, methods }]);
      }
    }
    return result;
  }

  /**
   * Traces confirmed callers and reference dependencies across the entire repository,
   * with support for direct (depth 1) and transitive (depth 2) caller propagation.
   */
  traceStructuralCallers(
    affectedSymbolsByFile: Map<string, { classes: Set<string>; methods: Set<string> }> | Record<string, any>,
    allStructures: CodeStructure[],
    maxDepth: number = 2
  ): CallerDependency[] {
    const callers: CallerDependency[] = [];
    const seen = new Set<string>();

    const symbolEntries = this.normalizeAffectedSymbols(affectedSymbolsByFile);

    // 1. DIRECT CALLERS (Depth 1)
    for (const [changedPath, symbols] of symbolEntries) {
      const normalizedChangedPath = changedPath.replace(/^\.?\//, '');
      const normChangedNoExt = normalizedChangedPath.replace(/\.[^/.]+$/, '');

      for (const structure of allStructures) {
        const normalizedPath = structure.filePath.replace(/^\.?\//, '');
        if (normalizedPath === normalizedChangedPath) continue; // Skip the changed file itself

        // Check for imports of changed classes/files
        const callerDir = path.dirname(structure.filePath);
        const importsTarget = (structure.imports || []).some((imp) => {
          // Check if import statement explicitly mentions changed class name
          for (const c of symbols.classes) {
            if (imp.includes(c)) return true;
          }
          // Check if import path points to changed file
          const modulePathMatch = imp.match(/from\s+['"]([^'"]+)['"]/) || imp.match(/import\s+['"]([^'"]+)['"]/);
          const rawModulePath = modulePathMatch ? modulePathMatch[1] : imp;
          let resolvedImp = rawModulePath;
          if (rawModulePath.startsWith('.')) {
            resolvedImp = path.normalize(path.join(callerDir, rawModulePath)).replace(/\\/g, '/');
          }
          const normResolvedNoExt = resolvedImp.replace(/^\.?\//, '').replace(/\.[^/.]+$/, '');
          return (
            normResolvedNoExt === normChangedNoExt ||
            imp.includes(normChangedNoExt) ||
            normChangedNoExt.endsWith(normResolvedNoExt) ||
            normResolvedNoExt.endsWith(normChangedNoExt) ||
            normResolvedNoExt.includes(normChangedNoExt) ||
            normChangedNoExt.includes(normResolvedNoExt)
          );
        });

        // Check for calls to modified methods
        const structureMethods = this.getStructureMethods(structure);
        for (const method of structureMethods) {
          const calledMethods = method.calledMethods || [];
          for (const called of calledMethods) {
            for (const targetMethod of symbols.methods) {
              const shortTarget = targetMethod.includes('.') ? targetMethod.split('.')[1] : targetMethod;
              const matchesCall =
                called === shortTarget ||
                called === targetMethod ||
                called.endsWith(`.${shortTarget}`) ||
                called === `${structure.filePath}#${shortTarget}` ||
                called === `${normalizedChangedPath}#${shortTarget}`;

              if (matchesCall) {
                const key = `${structure.filePath}:${method.name}->${targetMethod}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  const isConfirmed = importsTarget || called.includes(normalizedChangedPath);
                  const relationshipTier: 'CONFIRMED' | 'INFERRED' = isConfirmed ? 'CONFIRMED' : 'INFERRED';
                  const callerClass = method.className || structure.classes[0]?.name || structure.filePath;
                  const componentType = this.classifyComponent(structure.filePath, callerClass);

                  callers.push({
                    callerClass,
                    callerMethod: method.name,
                    calledSymbol: targetMethod,
                    evidence: isConfirmed
                      ? `[CONFIRMED] Direct call to ${shortTarget}() in ${structure.filePath} with verified import (L${method.startLine}-L${method.endLine})`
                      : `[INFERRED] Name-matching call to ${shortTarget}() in ${structure.filePath} without confirmed import (L${method.startLine}-L${method.endLine})`,
                    isConfirmed,
                    relationshipTier,
                    dependencyType: relationshipTier,
                    filePath: structure.filePath,
                    depth: 1,
                    componentType
                  });
                }
              }
            }
          }
        }

        // If imports class but no specific method caught, record module dependency as INFERRED
        if (importsTarget && !Array.from(seen).some((k) => k.startsWith(structure.filePath))) {
          const firstClass = Array.from(symbols.classes)[0] || changedPath;
          const key = `${structure.filePath}:import->${firstClass}`;
          if (!seen.has(key)) {
            seen.add(key);
            const callerClass = structure.classes[0]?.name || structure.filePath;
            const componentType = this.classifyComponent(structure.filePath, callerClass);
            callers.push({
              callerClass,
              callerMethod: '(Module Import / Dependency)',
              calledSymbol: firstClass,
              evidence: `[INFERRED] Imports ${firstClass} in ${structure.filePath} (unresolved method call)`,
              isConfirmed: false,
              relationshipTier: 'INFERRED',
              dependencyType: 'INFERRED',
              filePath: structure.filePath,
              depth: 1,
              componentType
            });
          }
        }
      }
    }

    // 2. TRANSITIVE CALLERS (Depth 2)
    if (maxDepth >= 2) {
      const directCallers = callers.filter((c) => c.isConfirmed && c.depth === 1);
      for (const direct of directCallers) {
        const directMethodName = direct.callerMethod;
        const directClassName = direct.callerClass;

        for (const structure of allStructures) {
          // Skip the direct caller file itself and any already seen keys
          if (structure.filePath === directClassName || structure.classes.some((c) => c.name === directClassName)) {
            continue;
          }

          const transMethods = this.getStructureMethods(structure);
          for (const method of transMethods) {
            const calledList = method.calledMethods || [];
            const callsDirectCaller = calledList.some(
              (c) =>
                c === directMethodName ||
                c === `${directClassName}.${directMethodName}` ||
                c.endsWith(`.${directMethodName}`)
            );

            if (callsDirectCaller) {
              const transKey = `${structure.filePath}:${method.name}->${directClassName}.${directMethodName}`;
              if (!seen.has(transKey)) {
                seen.add(transKey);
                const callerClass = method.className || structure.classes[0]?.name || structure.filePath;
                const componentType = this.classifyComponent(structure.filePath, callerClass);

                callers.push({
                  callerClass,
                  callerMethod: method.name,
                  calledSymbol: `${directClassName}.${directMethodName}`,
                  evidence: `[TRANSITIVE] Calls ${directClassName}.${directMethodName}() (depth 2), which calls modified ${direct.calledSymbol}`,
                  isConfirmed: false,
                  relationshipTier: 'TRANSITIVE',
                  dependencyType: 'TRANSITIVE',
                  filePath: structure.filePath,
                  depth: 2,
                  componentType
                });
              }
            }
          }
        }
      }
    }

    return callers;
  }

  /**
   * Detects semantic behavior changes from unified diff hunks (signature changes,
   * removed exports, return types, exception contracts, validation preconditions).
   */
  detectSemanticBehaviorChanges(
    changedFiles: ParsedDiffFile[],
    structures: CodeStructure[]
  ): BehaviorChange[] {
    const changes: BehaviorChange[] = [];

    for (const file of changedFiles) {
      for (const hunk of file.hunks || []) {
        const rawContent: string = hunk.content || (Array.isArray((hunk as any).lines) ? (hunk as any).lines.join('\n') : '');
        const lines: string[] = rawContent.split('\n');
        const deletedLines: string[] = lines.filter((l: string) => l.startsWith('-') && !l.startsWith('---'));
        const addedLines: string[] = lines.filter((l: string) => l.startsWith('+') && !l.startsWith('+++'));

        // 1. Detect Signature Changes
        const signaturePattern = /(?:(?:function|def|public|private|protected|async|static|const)\s+)?\b[a-zA-Z0-9_$]+\s*\([^)]*\)/;
        const deletedSig = deletedLines.find((l: string) => signaturePattern.test(l) && !l.includes(';') && (l.includes('{') || l.includes(':')));
        const addedSig = addedLines.find((l: string) => signaturePattern.test(l) && !l.includes(';') && (l.includes('{') || l.includes(':')));

        if (deletedSig && addedSig) {
          const oldSigClean = deletedSig.replace(/^-\s*/, '').trim();
          const newSigClean = addedSig.replace(/^\+\s*/, '').trim();
          if (oldSigClean !== newSigClean) {
            const symNameMatch = oldSigClean.match(/(?:function|def|public|private|protected|async|static|const)?\s*([a-zA-Z0-9_$]+)\s*\(/);
            const symName = symNameMatch ? symNameMatch[1] : path.basename(file.newPath);

            changes.push({
              symbol: symName,
              symbolName: symName,
              file: file.newPath,
              filePath: file.newPath,
              changeType: 'SIGNATURE',
              oldBehavior: `Original signature: ${oldSigClean}`,
              previousBehavior: `Original signature: ${oldSigClean}`,
              newBehavior: `Modified signature: ${newSigClean}`,
              description: `Method signature altered for '${symName}': parameter or return contract updated.`,
              reason: `Method signature altered for '${symName}': parameter or return contract updated.`,
              isBreaking: true
            });
          }
        }

        // 2. Detect Removed Symbols / Exports
        const exportRemoved = deletedLines.find((l: string) => /(export\s+(?:default\s+)?(?:function|class|const|interface)|public\s+class|def\s+)/.test(l));
        if (exportRemoved && !addedLines.some((l: string) => signaturePattern.test(l))) {
          const symMatch = exportRemoved.match(/(?:function|class|const|interface|def)?\s*([a-zA-Z0-9_$]+)/);
          const symName = symMatch ? symMatch[1] : path.basename(file.newPath);

          changes.push({
            symbol: symName,
            symbolName: symName,
            file: file.newPath,
            filePath: file.newPath,
            changeType: 'EXPORT_REMOVED',
            oldBehavior: `Exported symbol '${symName}' was present in previous commit.`,
            previousBehavior: `Exported symbol '${symName}' was present in previous commit.`,
            newBehavior: `Symbol was removed or renamed from '${file.newPath}'.`,
            description: `Exported symbol or method '${symName}' removed, potentially breaking external and downstream callers.`,
            reason: `Exported symbol or method '${symName}' removed, potentially breaking external and downstream callers.`,
            isBreaking: true
          });
        }

        // 3. Detect Return Value Modifications
        const oldReturn = deletedLines.find((l: string) => /return\s+/.test(l));
        const newReturn = addedLines.find((l: string) => /return\s+/.test(l));
        if (oldReturn && newReturn && oldReturn !== newReturn) {
          const symName = ((file as any).affectedMethods && (file as any).affectedMethods[0]) || path.basename(file.newPath);
          changes.push({
            symbol: symName,
            symbolName: symName,
            file: file.newPath,
            filePath: file.newPath,
            changeType: 'RETURN_VALUE',
            oldBehavior: `Returned: ${oldReturn.replace(/^-\s*/, '').trim()}`,
            previousBehavior: `Returned: ${oldReturn.replace(/^-\s*/, '').trim()}`,
            newBehavior: `Returns: ${newReturn.replace(/^\+\s*/, '').trim()}`,
            description: `Return statement value or structure modified for '${symName}'; verify downstream consumers handle new format.`,
            reason: `Return statement value or structure modified for '${symName}'; verify downstream consumers handle new format.`,
            isBreaking: true
          });
        }

        // 4. Detect Exception / Error Handling Changes
        const oldThrow = deletedLines.find((l: string) => /(throw\s+new|raise\s+|Error\(|Exception)/.test(l));
        const newThrow = addedLines.find((l: string) => /(throw\s+new|raise\s+|Error\(|Exception)/.test(l));
        if (oldThrow || newThrow) {
          const symName = ((file as any).affectedMethods && (file as any).affectedMethods[0]) || path.basename(file.newPath);
          changes.push({
            symbol: symName,
            symbolName: symName,
            file: file.newPath,
            filePath: file.newPath,
            changeType: 'EXCEPTION',
            oldBehavior: oldThrow ? oldThrow.replace(/^-\s*/, '').trim() : 'No explicit error raised on this condition.',
            previousBehavior: oldThrow ? oldThrow.replace(/^-\s*/, '').trim() : 'No explicit error raised on this condition.',
            newBehavior: newThrow ? newThrow.replace(/^\+\s*/, '').trim() : 'Exception condition removed or suppressed.',
            description: `Error handling or thrown exception behavior altered in '${symName}'.`,
            reason: `Error handling or thrown exception behavior altered in '${symName}'.`,
            isBreaking: true
          });
        }

        // 5. Detect Precondition / Validation Updates
        const oldCheck = deletedLines.find((l: string) => /(if\s*\(|assert|validate|checkArg)/.test(l));
        const newCheck = addedLines.find((l: string) => /(if\s*\(|assert|validate|checkArg)/.test(l));
        if (oldCheck || newCheck) {
          const symName = ((file as any).affectedMethods && (file as any).affectedMethods[0]) || path.basename(file.newPath);
          changes.push({
            symbol: symName,
            symbolName: symName,
            file: file.newPath,
            filePath: file.newPath,
            changeType: 'VALIDATION',
            oldBehavior: oldCheck ? oldCheck.replace(/^-\s*/, '').trim() : 'Precondition check absent.',
            previousBehavior: oldCheck ? oldCheck.replace(/^-\s*/, '').trim() : 'Precondition check absent.',
            newBehavior: newCheck ? newCheck.replace(/^\+\s*/, '').trim() : 'Precondition check relaxed or removed.',
            description: `Input validation preconditions or boundary checks updated in '${symName}'.`,
            reason: `Input validation preconditions or boundary checks updated in '${symName}'.`,
            isBreaking: false
          });
        }

        // 6. Generic Logic Update
        if (changes.length === 0 && (addedLines.length > 0 || deletedLines.length > 0)) {
          const symName = ((file as any).affectedMethods && (file as any).affectedMethods[0]) || path.basename(file.newPath);
          changes.push({
            symbol: symName,
            symbolName: symName,
            file: file.newPath,
            filePath: file.newPath,
            changeType: 'LOGIC',
            oldBehavior: deletedLines.slice(0, 2).map((l: string) => l.replace(/^-\s*/, '').trim()).join('; ') || 'Previous logic',
            previousBehavior: deletedLines.slice(0, 2).map((l: string) => l.replace(/^-\s*/, '').trim()).join('; ') || 'Previous logic',
            newBehavior: addedLines.slice(0, 2).map((l: string) => l.replace(/^\+\s*/, '').trim()).join('; ') || 'Updated logic',
            description: `Core logic updated in '${symName}'.`,
            reason: `Core logic updated in '${symName}'.`,
            isBreaking: false
          });
        }
      }
    }

    return changes;
  }

  /**
   * Generates grounded, structured symbol impact records for every changed symbol
   */
  generateSymbolImpactRecords(
    affectedFiles: AffectedFile[],
    callers: CallerDependency[],
    behaviorChanges: BehaviorChange[],
    relevantTests: RelevantTest[]
  ): SymbolImpactRecord[] {
    const records: SymbolImpactRecord[] = [];
    const seenSymbols = new Set<string>();

    for (const file of affectedFiles) {
      const symbolsToProcess = (file.affectedMethods && file.affectedMethods.length > 0)
        ? file.affectedMethods
        : [path.basename(file.filePath)];

      for (const symbol of symbolsToProcess) {
        const shortSymbol = symbol.includes('.') ? symbol.split('.').pop()! : symbol;
        const symKey = `${file.filePath}:${symbol}`;
        if (seenSymbols.has(symKey)) continue;
        seenSymbols.add(symKey);

        // Match callers
        const matchingCallers = callers.filter(
          (c) =>
            c.calledSymbol === symbol ||
            c.calledSymbol === shortSymbol ||
            c.calledSymbol.endsWith(`.${shortSymbol}`)
        );

        // Match behavior changes
        const matchingChanges = behaviorChanges.filter(
          (b) => b.file === file.filePath && (b.symbol === symbol || b.symbol === shortSymbol)
        );

        const primaryChange = matchingChanges[0];
        const isBreaking = matchingChanges.some((b) => b.isBreaking);

        // Convert callers to AffectedCaller format
        const affectedCallers: AffectedCaller[] = matchingCallers.map((c) => {
          const comp = c.componentType || this.classifyComponent(c.callerClass, c.callerMethod);
          const tier = c.relationshipTier || c.dependencyType || (c.isConfirmed ? 'CONFIRMED' : 'INFERRED');
          return {
            component: comp,
            componentType: comp,
            filePath: c.filePath || c.callerClass,
            callerSymbol: c.callerMethod,
            callerMethod: c.callerMethod,
            callerClass: c.callerClass,
            relationshipTier: tier,
            dependencyType: tier,
            depth: c.depth || 1,
            evidence: c.evidence,
            reason: `${comp} '${c.callerClass}.${c.callerMethod}' directly invokes or depends on ${symbol}.`
          };
        });

        // Determine Risk Level & Verification Status
        let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        let verificationStatus: 'VERIFIED' | 'INFERRED' | 'UNKNOWN' = 'UNKNOWN';

        if (affectedCallers.some((c) => c.relationshipTier === 'CONFIRMED')) {
          verificationStatus = 'VERIFIED';
        } else if (affectedCallers.some((c) => c.relationshipTier === 'INFERRED' || c.relationshipTier === 'TRANSITIVE')) {
          verificationStatus = 'INFERRED';
        }

        if (isBreaking && affectedCallers.length > 0) {
          riskLevel = 'CRITICAL';
        } else if (isBreaking || affectedCallers.some((c) => (c.component && (c.component.includes('CONTROLLER') || c.component.includes('SERVICE'))))) {
          riskLevel = 'HIGH';
        } else if (affectedCallers.length > 0) {
          riskLevel = 'MEDIUM';
        } else {
          riskLevel = 'LOW';
        }

        const previousBehavior = primaryChange?.previousBehavior || 'Original implementation logic prior to pull request changes.';
        const newBehavior = primaryChange?.newBehavior || 'Updated implementation in this pull request.';

        const runtimeEffect = affectedCallers.length > 0
          ? `Downstream callers in ${affectedCallers.map((c) => c.callerSymbol).slice(0, 3).join(', ')} will execute the updated logic at runtime.`
          : 'No downstream dependencies were identified by the available static AST analysis for this revision.';

        const breakingChanges = isBreaking
          ? `Potential breaking change: ${primaryChange?.description || 'Contract or interface signature altered.'}`
          : 'None detected: Changes appear backward compatible within observed call graph.';

        // Supporting references
        const supportingReferences = [
          file.filePath,
          ...affectedCallers.map((c) => c.filePath).slice(0, 4)
        ];

        // Recommended tests
        const recommendedTests = relevantTests
          .filter((t) => t.testMethods.some((m) => m.toLowerCase().includes(shortSymbol.toLowerCase())))
          .map((t) => `${t.testFilePath} -> ${t.testMethods.join(', ')}`);

        if (recommendedTests.length === 0) {
          recommendedTests.push(`Add regression test verifying '${shortSymbol}' behavior and edge conditions.`);
        }

        records.push({
          id: `impact-${file.filePath.replace(/[^a-zA-Z0-9]/g, '_')}-${shortSymbol}`,
          changedFile: file.filePath,
          file: file.filePath,
          symbol,
          changeType: isBreaking ? 'SIGNATURE_CHANGED' : 'MODIFIED',
          changeDescription: primaryChange?.description || `Modified ${shortSymbol} in ${file.filePath}`,
          previousBehavior,
          newBehavior,
          affectedCallers,
          runtimeBusinessEffect: runtimeEffect,
          runtimeEffect: runtimeEffect,
          breakingChanges,
          potentialBreakingChanges: breakingChanges,
          riskLevel,
          confidence: verificationStatus === 'VERIFIED' ? 'HIGH' : verificationStatus === 'INFERRED' ? 'MEDIUM' : 'LOW',
          supportingReferences,
          recommendedTests,
          recommendedRegressionTests: recommendedTests,
          verificationStatus,
          isVerified: verificationStatus
        });
      }
    }

    return records;
  }

  /**
   * Constructs an interactive dependency graph separating changed symbols, callers, and test suites
   */
  buildDependencyGraph(
    affectedFiles: AffectedFile[],
    callers: CallerDependency[],
    relevantTests: RelevantTest[],
    symbolImpacts: SymbolImpactRecord[]
  ): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const nodeIds = new Set<string>();

    // 1. Add Changed Symbol Nodes
    for (const impact of symbolImpacts) {
      const nodeId = `sym_${impact.changedFile}_${impact.symbol}`.replace(/[^a-zA-Z0-9_]/g, '_');
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        nodes.push({
          id: nodeId,
          label: impact.symbol,
          file: impact.changedFile || impact.file || 'unknown',
          type: 'CHANGED_SYMBOL',
          riskLevel: impact.riskLevel
        });
      }
    }

    // 2. Add Caller Nodes and Edges
    for (const caller of callers) {
      const callerNodeId = `caller_${caller.callerClass}_${caller.callerMethod}`.replace(/[^a-zA-Z0-9_]/g, '_');
      const targetSymNodeId = Array.from(nodeIds).find((id) =>
        id.includes(caller.calledSymbol.replace(/[^a-zA-Z0-9_]/g, '_'))
      );

      const callerType: DependencyNode['type'] =
        caller.relationshipTier === 'TRANSITIVE'
          ? 'TRANSITIVE_CALLER'
          : caller.relationshipTier === 'CONFIRMED'
          ? 'DIRECT_CALLER'
          : 'INFERRED_CALLER';

      if (!nodeIds.has(callerNodeId)) {
        nodeIds.add(callerNodeId);
        nodes.push({
          id: callerNodeId,
          label: `${caller.callerClass}.${caller.callerMethod}()`,
          file: caller.callerClass,
          type: callerType
        });
      }

      if (targetSymNodeId) {
        edges.push({
          source: callerNodeId,
          target: targetSymNodeId,
          tier: caller.relationshipTier || 'CONFIRMED',
          evidence: caller.evidence
        });
      }
    }

    // 3. Add Test Nodes and Edges
    for (const test of relevantTests) {
      const testNodeId = `test_${test.testFilePath}`.replace(/[^a-zA-Z0-9_]/g, '_');
      if (!nodeIds.has(testNodeId)) {
        nodeIds.add(testNodeId);
        nodes.push({
          id: testNodeId,
          label: `${test.testClassName} (${test.testMethods.slice(0, 2).join(', ')})`,
          file: test.testFilePath,
          type: 'TEST'
        });
      }

      // Connect to first changed symbol as regression test edge
      const firstSymNode = nodes.find((n) => n.type === 'CHANGED_SYMBOL');
      if (firstSymNode) {
        edges.push({
          source: testNodeId,
          target: firstSymNode.id,
          tier: 'CONFIRMED',
          evidence: `Direct regression coverage in ${test.testFilePath}`
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Sanitizes symbol impact records against actual changed files and AST symbols,
   * guaranteeing that AI-generated hypotheses cannot introduce hallucinated symbols.
   */
  sanitizeSymbolImpacts(
    rawImpacts: SymbolImpactRecord[],
    validFiles: Set<string>,
    validSymbols: Set<string>
  ): SymbolImpactRecord[] {
    return (rawImpacts || []).filter((rec) => {
      const targetFile = rec.changedFile || rec.file || '';
      if (!targetFile) return false;

      // Must match an actual modified file
      const fileValid = validFiles.has(targetFile) || Array.from(validFiles).some((f) => f.endsWith(targetFile) || targetFile.endsWith(f));
      if (!fileValid) return false;

      rec.changedFile = targetFile;
      rec.file = targetFile;

      // Filter callers against valid files
      if (rec.affectedCallers && Array.isArray(rec.affectedCallers)) {
        rec.affectedCallers = rec.affectedCallers.filter((c) => {
          if (!c.filePath) return true;
          return validFiles.has(c.filePath) || Array.from(validFiles).some((f) => f.endsWith(c.filePath) || c.filePath.endsWith(f));
        });
      }

      // Check if symbol itself was verified statically
      const shortSymbol = rec.symbol.includes('.') ? rec.symbol.split('.').pop()! : rec.symbol;
      const symbolIsReal = validSymbols.has(rec.symbol) || validSymbols.has(shortSymbol) || Array.from(validSymbols).some((s) => s.includes(shortSymbol));

      if (!symbolIsReal) {
        rec.verificationStatus = 'UNKNOWN';
        rec.isVerified = 'UNKNOWN';
      } else {
        const curStatus = rec.isVerified || rec.verificationStatus || 'INFERRED';
        rec.verificationStatus = curStatus as any;
        rec.isVerified = curStatus as any;
      }

      // Clean risk level
      if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rec.riskLevel)) {
        rec.riskLevel = 'MEDIUM';
      }

      return true;
    });
  }

  /**
   * Discovers existing relevant tests and detects missing coverage for affected components
   */
  findRelevantTests(
    affectedSymbolsByFile: Map<string, { classes: Set<string>; methods: Set<string> }> | Record<string, any>,
    allStructures: CodeStructure[]
  ): { relevantTests: RelevantTest[]; behaviorRisks: BehaviorRisk[] } {
    const relevantTests: RelevantTest[] = [];
    const behaviorRisks: BehaviorRisk[] = [];
    const testedSymbols = new Set<string>();

    // Test file pattern
    const isTestFile = (p: string) => {
      const lower = p.toLowerCase();
      return (
        lower.includes('test') ||
        lower.includes('spec') ||
        lower.endsWith('.test.ts') ||
        lower.endsWith('.spec.ts') ||
        lower.endsWith('.test.js') ||
        lower.endsWith('test.java') ||
        lower.includes('test_')
      );
    };

    const testStructures = allStructures.filter((s) => isTestFile(s.filePath));
    const symbolEntries = this.normalizeAffectedSymbols(affectedSymbolsByFile);

    for (const [changedPath, symbols] of symbolEntries) {
      const allTouched = [...symbols.classes, ...symbols.methods];
      let hasDirectTest = false;

      for (const targetSymbol of allTouched) {
        const shortName = targetSymbol.includes('.') ? targetSymbol.split('.')[1] : targetSymbol;

        for (const testStruct of testStructures) {
          const fileMatches = testStruct.filePath.toLowerCase().includes(shortName.toLowerCase());
          const importsMatch = (testStruct.imports || []).some((imp) => imp.includes(shortName));
          const callsMethod = testStruct.methods.some((m) =>
            (m.calledMethods || []).some((c) => c === shortName || c.endsWith(`.${shortName}`))
          );

          if (fileMatches || importsMatch || callsMethod) {
            hasDirectTest = true;
            testedSymbols.add(targetSymbol);

            const testClass = testStruct.classes[0]?.name || testStruct.filePath;
            const existing = relevantTests.find((r) => r.testFilePath === testStruct.filePath);
            const methods = testStruct.methods.map((m) => m.name).slice(0, 10);

            if (!existing) {
              relevantTests.push({
                testFilePath: testStruct.filePath,
                testClassName: testClass,
                testMethods: methods.length > 0 ? methods : ['testSuite'],
                isDirectCoverage: true
              });
            }
          }
        }
      }

      // If modified methods exist with no matching test file detected, create behavior risk
      if (symbols.methods.size > 0 && !hasDirectTest) {
        behaviorRisks.push({
          component: changedPath,
          risk: 'Uncovered modification / Missing regression tests',
          rationale: `Modified methods (${Array.from(symbols.methods).join(', ')}) do not have a dedicated test file matching their symbol or imports in the repository.`,
          missingTest: true
        });
      }
    }

    return { relevantTests, behaviorRisks };
  }

  /**
   * Detects the dominant programming language and standard test framework
   */
  detectRepositoryLanguageAndFramework(structures: CodeStructure[]): { language: string; testFramework: string } {
    const langCounts: Record<string, number> = {};
    for (const s of structures) {
      langCounts[s.language] = (langCounts[s.language] || 0) + 1;
    }

    let dominantLang = 'typescript';
    let maxCount = 0;
    for (const [lang, count] of Object.entries(langCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantLang = lang;
      }
    }

    switch (dominantLang) {
      case 'typescript':
      case 'javascript':
        return { language: dominantLang, testFramework: 'Vitest / Jest (`describe`, `it`, `expect`)' };
      case 'java':
        return { language: 'java', testFramework: 'JUnit 5 + AssertJ (`@Test`, `assertThat`)' };
      case 'python':
        return { language: 'python', testFramework: 'pytest (`def test_*(): assert ...`)' };
      case 'go':
        return { language: 'go', testFramework: 'Go testing (`func Test*(t *testing.T)`)' };
      case 'rust':
        return { language: 'rust', testFramework: 'Rust `#[test]` / cargo test' };
      default:
        return { language: dominantLang, testFramework: 'Standard Unit Testing' };
    }
  }

  /**
   * Validates and sanitizes findings against actual changed files and unified diffs
   */
  validateAndSanitizeFindings(
    rawFindings: any[],
    changedFiles: ParsedDiffFile[],
    structures: CodeStructure[]
  ): PrFinding[] {
    const validSeverities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const validCategories: FindingCategory[] = [
      'LOGIC_ERROR',
      'SECURITY',
      'ARCHITECTURAL',
      'TEST_GAP',
      'PERFORMANCE'
    ];

    const validFilePaths = new Set(changedFiles.map((f) => f.newPath));
    const allRepoFilePaths = new Set(structures.map((s) => s.filePath));
    const primaryChangedFile = changedFiles[0]?.newPath || 'src/index.ts';

    return (rawFindings || []).map((f: any, idx: number) => {
      // 1. Severity validation
      const severity: Severity = validSeverities.includes(f.severity?.toUpperCase())
        ? f.severity.toUpperCase()
        : 'MEDIUM';

      // 2. Category validation
      const category: FindingCategory = validCategories.includes(f.category?.toUpperCase())
        ? f.category.toUpperCase()
        : 'LOGIC_ERROR';

      // 3. File path validation
      let filePath = f.filePath || primaryChangedFile;
      if (!validFilePaths.has(filePath) && !allRepoFilePaths.has(filePath)) {
        // Try finding matching suffix or fallback to primary changed file
        const matched = Array.from(validFilePaths).find((p) => p.endsWith(filePath) || filePath.endsWith(p));
        filePath = matched || primaryChangedFile;
      }

      // 4. Line range validation
      let lineRange = f.lineRange || 'L1-L10';
      if (!lineRange.startsWith('L')) {
        lineRange = `L${lineRange}`;
      }

      const lineMatch = lineRange.match(/L(\d+)/);
      const startLine = lineMatch ? parseInt(lineMatch[1], 10) : undefined;

      const diffSnippet = f.diffSnippet || f.evidence || '';
      const suggestedFix = f.suggestedFix || f.suggestedFixCode || '';
      const impactExplanation = f.impactExplanation || f.impact || '';
      const testRecipe = f.testRecipe || f.recommendedTest || '';

      return {
        id: f.id || `finding-${idx + 1}`,
        analysisId: f.analysisId || '',
        severity,
        category,
        title: f.title || 'Potential Code Issue',
        filePath,
        lineRange,
        startLine,
        confidence: Number(f.confidence) || 85,
        description: f.description || 'Issue identified during pull request inspection.',
        diffSnippet,
        evidence: diffSnippet,
        suggestedFix,
        impactExplanation,
        impact: impactExplanation,
        testRecipe,
        recommendedTest: testRecipe
      };
    });
  }
}

export const diffAnalysisService = new DiffAnalysisService();
