/**
 * Architecture gate — import-boundary module.
 *
 * Owns the forbidden-import matrix (content-core, content-mcp, frontend) and
 * the TypeScript-powered import specifier extraction. No file discovery, no
 * size rules.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getTypescript } from './architecture-file-scanner.mjs';

const CORE_FORBIDDEN =
  'src|packages/content-mcp|react|react-dom|@neondatabase|@modelcontextprotocol|@bemtevi/content-mcp|node'.split('|');
const MCP_FORBIDDEN =
  'src|../src|../../src|scripts/content-agent|../scripts/content-agent|../../scripts/content-agent|scripts/agent-bridge|../scripts/agent-bridge|../../scripts/agent-bridge|src/dev-dashboard|child_process|node:child_process|fs|node:fs|git|node:git'.split(
    '|',
  );
const FRONTEND_FORBIDDEN =
  '@bemtevi/content-mcp|packages/content-mcp|../packages/content-mcp|scripts/content-agent|../scripts/content-agent|scripts/agent-bridge|../scripts/agent-bridge'.split(
    '|',
  );

export function extractImports(source, fileName) {
  const ts = getTypescript();
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, scriptKind);
  const specs = [];
  let hasComputed = false;
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      const arg = node.arguments[0];
      const expr = node.expression;
      const isImport = expr.kind === ts.SyntaxKind.ImportKeyword;
      const name = ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.getText() : '';
      const isRequireLike = isImport || name === 'require' || name.endsWith('require');
      if (isRequireLike && arg && !ts.isStringLiteral(arg) && !ts.isNoSubstitutionTemplateLiteral(arg))
        hasComputed = true;
      else if (arg && ts.isStringLiteral(arg) && isRequireLike) specs.push(arg.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { specs, hasComputed };
}

function matchesPrefix(spec, prefix) {
  const p = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return spec === p || spec.startsWith(`${p}/`) || spec.startsWith(`${p}\\`);
}

function matchesAny(spec, list) {
  return list.some((prefix) => matchesPrefix(spec, prefix) || (!prefix.includes('/') && spec.startsWith(`${prefix}:`)));
}

function isGeneratedCorpus(spec) {
  return [
    'src/content/generated/',
    '../src/content/generated/',
    '../../src/content/generated/',
    '../../../src/content/generated/',
  ].some((p) => matchesPrefix(spec, p));
}

export function findForbiddenImports(relPath, specifiers, hasComputed = false) {
  const posix = relPath.replace(/\\/g, '/');
  const isCore = posix.startsWith('packages/content-core/');
  const isMcp = posix.startsWith('packages/content-mcp/');
  const isFrontend = posix.startsWith('src/') && !posix.startsWith('src/content/generated/');
  const isRuntime = !/\.test\.|\/__tests__\//.test(posix) && !posix.endsWith('.mjs');
  const violations = [];
  if ((isCore || isMcp) && isRuntime && hasComputed) {
    violations.push({ file: relPath, specifier: '<computed>', rule: 'computed-import-rejected' });
  }
  for (const spec of specifiers) {
    if (isCore && isRuntime && (matchesAny(spec, CORE_FORBIDDEN) || isGeneratedCorpus(spec))) {
      violations.push({ file: relPath, specifier: spec, rule: 'core-forbidden-import' });
    }
    if (isMcp && isRuntime && (matchesAny(spec, MCP_FORBIDDEN) || isGeneratedCorpus(spec))) {
      violations.push({ file: relPath, specifier: spec, rule: 'mcp-forbidden-import' });
    }
    if (isFrontend && isRuntime && matchesAny(spec, FRONTEND_FORBIDDEN)) {
      violations.push({ file: relPath, specifier: spec, rule: 'frontend-forbidden-import' });
    }
  }
  return violations;
}

export function checkImports(rootDir, files) {
  const errors = [];
  for (const rel of files) {
    const { specs, hasComputed } = extractImports(readFileSync(path.join(rootDir, rel), 'utf8'), rel);
    for (const v of findForbiddenImports(rel, specs, hasComputed)) {
      errors.push(`FORBIDDEN_IMPORT ${v.file} imports '${v.specifier}' (${v.rule})`);
    }
  }
  return errors;
}
