import { useRef, useState, type ChangeEvent } from 'react';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { parseGuidedFlow } from '../../domain/flow-engine/parseFlow';
import { validateFlow } from '../../domain/flow-engine/validateFlow';

export function useFlowImport(onFlowImport?: (flow: GuidedFlow) => void, onImported?: (flowId: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onFlowImport) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const flow = parseGuidedFlow(JSON.parse(String(reader.result ?? '')) as unknown);
        const result = validateFlow(flow);
        if (!result.valid) throw new Error(result.errors.join(' '));
        onFlowImport(flow);
        onImported?.(flow.id);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Não foi possível importar o fluxo JSON.');
      }
    };
    reader.onerror = () => setError('Não foi possível ler o arquivo do fluxo.');
    reader.readAsText(file);
  }

  return { inputRef, error, openFilePicker, handleFile };
}
