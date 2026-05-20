import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { restRecoveryFlow } from '../src/content/flows/rest-recovery';
import { workStressFlow } from '../src/content/flows/work-stress';
import { resourcesContent } from '../src/content/resources/resources';
import { parseGuidedFlow } from '../src/domain/flow-engine/parseFlow';
import { validateFlow } from '../src/domain/flow-engine/validateFlow';
import type { ChoiceFlowNode, ResultFlowNode, GuidedFlow } from '../src/domain/flow-engine/types';

export function getRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function loadJsonFlows(rootDir: string): GuidedFlow[] {
  const flowsDir = path.join(rootDir, 'src', 'content', 'flows');
  if (!existsSync(flowsDir)) {
    return [];
  }

  const files = readdirSync(flowsDir).filter((file) => file.endsWith('.json'));
  return files.map((file) => {
    const filePath = path.join(flowsDir, file);
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return parseGuidedFlow(parsed);
  });
}

export function loadRegisteredFlows(rootDir?: string): GuidedFlow[] {
  const resolvedRoot = rootDir ?? getRepoRoot();
  const jsonFlows = loadJsonFlows(resolvedRoot);
  return [workStressFlow, restRecoveryFlow, ...jsonFlows];
}

export function validateRegisteredFlows(flows: GuidedFlow[]): string[] {
  const errors: string[] = [];
  const seenIds = new Map<string, number>();
  const seenPhrases = new Map<string, string>();

  for (const flow of flows) {
    const structuralResult = validateFlow(flow);
    if (!structuralResult.valid) {
      errors.push(...structuralResult.errors);
    }

    const count = seenIds.get(flow.id) ?? 0;
    seenIds.set(flow.id, count + 1);
    if (count > 0) {
      errors.push(`Duplicate flow id "${flow.id}".`);
    }

    for (const phrase of flow.entry.enteringPhrases) {
      const existing = seenPhrases.get(phrase);
      if (existing !== undefined) {
        errors.push(
          `Duplicate entering phrase "${phrase}" used by flows ${existing} and ${flow.id}.`,
        );
      } else {
        seenPhrases.set(phrase, flow.id);
      }
    }
  }

  return errors;
}

export function validateSrq20Contract(flow: GuidedFlow): string[] {
  const errors: string[] = [];

  for (let questionNumber = 1; questionNumber <= 20; questionNumber += 1) {
    const nodeId = `q${questionNumber}`;
    const node = flow.nodes[nodeId];

    if (node === undefined) {
      errors.push(`SRQ-20 must include question node ${nodeId}.`);
      continue;
    }

    if (node.kind !== 'choice') {
      errors.push(`SRQ-20 node ${nodeId} must be a choice node.`);
      continue;
    }

    const choiceNode = node as ChoiceFlowNode;
    const yesOption = choiceNode.options.find((o) => o.id === 'yes');
    const noOption = choiceNode.options.find((o) => o.id === 'no');

    if (!yesOption || !noOption) {
      errors.push(`SRQ-20 node ${nodeId} must include yes and no options.`);
    }

    if (questionNumber === 17 && yesOption) {
      const hasSafetyInterrupt = yesOption.effects?.some(
        (e) =>
          e.kind === 'safety_interrupt' &&
          e.destination === '/apoio' &&
          e.blockResume === true,
      );
      if (!hasSafetyInterrupt) {
        errors.push(
          `SRQ-20 q17 yes option must include a safety_interrupt effect to /apoio with blockResume enabled.`,
        );
      }
    } else if (yesOption && !yesOption.effects?.some((e) => e.kind === 'score' && e.scoreKey === 'srq20')) {
      errors.push(`SRQ-20 ${nodeId} yes option must include a score effect for srq20.`);
    }
  }

  const scoreNode = flow.nodes['srq20-score'];
  if (!scoreNode || scoreNode.kind !== 'score_branch') {
    errors.push('SRQ-20 must include a score_branch node with id srq20-score.');
  }

  return errors;
}

export function validateResourceRecommendations(
  flows: GuidedFlow[],
  resourceIds: string[],
): string[] {
  const errors: string[] = [];
  const resourceSet = new Set(resourceIds);

  for (const flow of flows) {
    for (const node of Object.values(flow.nodes)) {
      if (node.kind === 'result') {
        const resultNode = node as ResultFlowNode;
        if (resultNode.recommendations) {
          for (const recommendation of resultNode.recommendations) {
            if (!resourceSet.has(recommendation)) {
              errors.push(
                `Flow ${flow.id} result node ${resultNode.id} recommends missing resource ${recommendation}.`,
              );
            }
          }
        }
      }
    }
  }

  return errors;
}

export function validateContent(): string[] {
  const rootDir = getRepoRoot();
  const flows = loadRegisteredFlows(rootDir);
  const errors: string[] = [];

  errors.push(...validateRegisteredFlows(flows));

  const srq20Flow = flows.find((f) => f.id === 'srq20');
  if (srq20Flow) {
    errors.push(...validateSrq20Contract(srq20Flow));
  }

  const resourceIds = resourcesContent.resources.map((r) => r.id);
  errors.push(...validateResourceRecommendations(flows, resourceIds));

  return errors;
}

function isMainModule(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return currentFile === executedFile;
}

if (isMainModule()) {
  const errors = validateContent();
  const flows = loadRegisteredFlows();

  if (errors.length > 0) {
    console.error('Flow/content validation failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(`Flow/content validation passed for ${flows.length} flow(s).`);
}
