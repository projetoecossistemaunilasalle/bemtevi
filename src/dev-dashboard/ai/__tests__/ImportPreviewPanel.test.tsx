import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { conformanceBasePayload } from '@bemtevi/content-core';
import { ExportColumn, ImportPreviewPanel, type ReadyPreview } from '../ImportPreviewPanel';

const preview: ReadyPreview = {
  kind: 'ready',
  fileName: 'resposta.json',
  candidate: conformanceBasePayload,
  changes: [],
  issues: [],
  operationsCount: 2,
};

describe('ImportPreviewPanel', () => {
  it('renders the review state and keeps apply/discard explicit', async () => {
    const onApply = vi.fn();
    const onDiscard = vi.fn();
    render(<ImportPreviewPanel preview={preview} onApply={onApply} onDiscard={onDiscard} />);

    expect(screen.getByRole('heading', { name: /resposta\.json.*2 operação/i })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Aplicar ao rascunho' }));
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('keeps the exact image handoff copy in the export column', () => {
    render(<ExportColumn working={false} onExport={vi.fn()} />);

    expect(screen.getByText('images/').parentElement).toHaveTextContent('images/. A IA');
  });
});
