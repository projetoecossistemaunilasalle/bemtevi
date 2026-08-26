import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BlockingValidationNotice } from '../BlockingValidationNotice';
import type { DashboardValidationResult } from '../../validation/validationTypes';

describe('BlockingValidationNotice', () => {
  it('renders nothing when there are no errors', () => {
    const validation: DashboardValidationResult = { errors: [], warnings: [] };
    const { container } = render(
      <BlockingValidationNotice validation={validation} actionLabel="publicar" onOpenArea={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders error notice and triggers onOpenArea when clicking Revisar buttons', async () => {
    const user = userEvent.setup();
    const onOpenArea = vi.fn();

    const validation: DashboardValidationResult = {
      errors: [
        { level: 'error', area: 'flows', id: 'f1', message: 'Erro no fluxo 1' },
        { level: 'error', area: 'education', id: 'e1', message: 'Erro no material 1' },
        { level: 'error', area: 'education', id: 'e2', message: 'Erro no material 2' },
        { level: 'error', area: 'contacts', id: 'c1', message: 'Erro no contato 1' },
      ],
      warnings: [],
    };

    render(<BlockingValidationNotice validation={validation} actionLabel="publicar" onOpenArea={onOpenArea} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Ainda não é possível publicar')).toBeInTheDocument();
    expect(screen.getByText('Há 4 erros que precisam ser corrigidos. Seu rascunho foi mantido.')).toBeInTheDocument();

    const flowsBtn = screen.getByRole('button', { name: 'Revisar 1 erro em Fluxos' });
    const educationBtn = screen.getByRole('button', { name: 'Revisar 2 erros em Materiais' });
    const contactsBtn = screen.getByRole('button', { name: 'Revisar 1 erro em Contatos' });

    expect(flowsBtn).toBeInTheDocument();
    expect(educationBtn).toBeInTheDocument();
    expect(contactsBtn).toBeInTheDocument();

    await user.click(educationBtn);
    expect(onOpenArea).toHaveBeenCalledWith('education');

    await user.click(contactsBtn);
    expect(onOpenArea).toHaveBeenCalledWith('contacts');

    await user.click(flowsBtn);
    expect(onOpenArea).toHaveBeenCalledWith('flows');
  });
});
