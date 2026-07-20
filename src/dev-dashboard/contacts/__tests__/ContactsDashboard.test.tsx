import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ServiceDirectoryEntry } from '../../../domain/services/types';
import { ContactsDashboard } from '../ContactsDashboard';
import { createLocalService } from '../contactDrafts';
import { validateDashboardContacts } from '../contactsValidation';

const capsService: ServiceDirectoryEntry = {
  id: 'service-caps-centro',
  name: 'CAPS Centro',
  type: 'CAPS',
  badgeTone: 'primary',
  city: 'Canoas',
  state: 'RS',
  address: 'Rua Um, 10',
  phoneDisplay: '(51) 3333-4444',
  phoneHref: 'tel:5133334444',
  hours: 'Segunda a sexta, 8h às 18h',
  notes: 'Atendimento por acolhimento.',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
};

const ubsService: ServiceDirectoryEntry = {
  id: 'service-ubs-norte',
  name: 'UBS Norte',
  type: 'UBS',
  badgeTone: 'secondary',
  city: 'Esteio',
  state: 'RS',
  address: 'Avenida Dois, 20',
  phoneDisplay: '(51) 3222-5555',
  phoneHref: 'tel:5132225555',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
};

const universityService: ServiceDirectoryEntry = {
  id: 'service-university',
  name: 'Clínica Escola',
  type: 'Universidade',
  badgeTone: 'neutral',
  city: 'Porto Alegre',
  state: 'RS',
  address: 'Rua Três, 30',
  phoneDisplay: '(51) 3111-6666',
  phoneHref: 'tel:5131116666',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
};

type ServiceChangeHandler = (index: number, id: string, patch: Partial<ServiceDirectoryEntry>) => void;

function StatefulHarness({
  initialServices,
  onServiceChange,
  onServiceAdd,
  onServiceRemove,
}: {
  initialServices: ServiceDirectoryEntry[];
  onServiceChange: ServiceChangeHandler;
  onServiceAdd: () => void;
  onServiceRemove: (index: number, id: string) => void;
}) {
  const [services, setServices] = useState(initialServices);

  function changeService(index: number, id: string, patch: Partial<ServiceDirectoryEntry>) {
    onServiceChange(index, id, patch);
    setServices((current) =>
      current.map((service, serviceIndex) =>
        serviceIndex === index && service.id === id ? { ...service, ...patch } : service,
      ),
    );
  }

  function addService() {
    const service = createLocalService(services.map(({ id }) => id));
    onServiceAdd();
    setServices((current) => [...current, service]);
    return service.id;
  }

  function removeService(index: number, id: string) {
    onServiceRemove(index, id);
    setServices((current) => current.filter((service, serviceIndex) => serviceIndex !== index || service.id !== id));
  }

  return (
    <ContactsDashboard
      services={services}
      validation={validateDashboardContacts(services)}
      onServiceChange={changeService}
      onServiceAdd={addService}
      onServiceRemove={removeService}
    />
  );
}

function renderDashboard(initialServices: ServiceDirectoryEntry[] = [capsService, ubsService]) {
  const callbacks = {
    onServiceChange: vi.fn<ServiceChangeHandler>(),
    onServiceAdd: vi.fn<() => void>(),
    onServiceRemove: vi.fn<(index: number, id: string) => void>(),
  };

  render(<StatefulHarness initialServices={initialServices} {...callbacks} />);

  return { user: userEvent.setup(), ...callbacks };
}

function serviceButton(name: string) {
  return within(screen.getByRole('list', { name: 'Contatos disponíveis' })).getByRole('button', {
    name: new RegExp(name),
  });
}

describe('ContactsDashboard', () => {
  it('selects the first contact by default and switches the focused editor from the accessible list', async () => {
    const { user } = renderDashboard();

    expect(screen.getByRole('heading', { level: 2, name: 'Contatos' })).toBeInTheDocument();
    expect(screen.getByText('Edite os serviços que aparecem na rede de apoio.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Contatos disponíveis' })).toBeInTheDocument();
    expect(serviceButton('CAPS Centro')).toHaveAttribute('aria-pressed', 'true');
    expect(serviceButton('UBS Norte')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS Centro');

    await user.click(serviceButton('UBS Norte'));

    expect(serviceButton('CAPS Centro')).toHaveAttribute('aria-pressed', 'false');
    expect(serviceButton('UBS Norte')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('UBS Norte');
    expect(screen.getByRole('heading', { level: 3, name: 'Editar UBS Norte' })).toBeInTheDocument();
  });

  it('sends edits with the selected contact index and stable id', async () => {
    const { user, onServiceChange } = renderDashboard();
    await user.click(serviceButton('UBS Norte'));

    const name = screen.getByRole('textbox', { name: 'Nome' });
    await user.clear(name);
    await user.type(name, 'UBS Harmonia');

    expect(onServiceChange).toHaveBeenLastCalledWith(1, 'service-ubs-norte', { name: 'UBS Harmonia' });
    expect(name).toHaveValue('UBS Harmonia');
  });

  it('targets the selected index when contacts share the same id', async () => {
    const duplicateIdService = { ...ubsService, id: capsService.id };
    const { user, onServiceChange, onServiceRemove } = renderDashboard([capsService, duplicateIdService]);

    await user.click(serviceButton('UBS Norte'));
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('UBS Norte');

    const name = screen.getByRole('textbox', { name: 'Nome' });
    await user.clear(name);
    await user.type(name, 'UBS Duplicada');
    expect(onServiceChange).toHaveBeenLastCalledWith(1, capsService.id, { name: 'UBS Duplicada' });

    await user.click(screen.getByRole('button', { name: 'Remover contato UBS Duplicada' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar: Remover contato UBS Duplicada' }));
    expect(onServiceRemove).toHaveBeenCalledWith(1, capsService.id);
  });

  it('offers common service suggestions and derives the badge tone when type changes', async () => {
    const { user, onServiceChange } = renderDashboard();
    const type = screen.getByRole('combobox', { name: 'Tipo de serviço' });

    expect(type).toHaveAttribute('list', 'contact-service-type-suggestions');
    await user.clear(type);
    await user.type(type, 'UBS');

    expect(onServiceChange).toHaveBeenLastCalledWith(0, 'service-caps-centro', {
      type: 'UBS',
      badgeTone: 'secondary',
    });
  });

  it('keeps phone formatting visible and derives its tel href on every change', async () => {
    const { user, onServiceChange } = renderDashboard();
    const phone = screen.getByRole('textbox', { name: 'Telefone' });

    await user.clear(phone);
    await user.type(phone, '(51) 99999-8888');

    expect(phone).toHaveValue('(51) 99999-8888');
    expect(onServiceChange).toHaveBeenLastCalledWith(0, 'service-caps-centro', {
      phoneDisplay: '(51) 99999-8888',
      phoneHref: 'tel:51999998888',
    });
  });

  it('uppercases the state and limits it to two characters', async () => {
    const { user, onServiceChange } = renderDashboard();
    const state = screen.getByRole('textbox', { name: 'Estado' });

    expect(state).toHaveAttribute('maxlength', '2');
    await user.clear(state);
    await user.type(state, 'rjs');

    expect(state).toHaveValue('RJ');
    expect(onServiceChange).toHaveBeenLastCalledWith(0, 'service-caps-centro', { state: 'RJ' });
  });

  it('adds a contact and immediately selects the stable id returned by the parent', async () => {
    const { user, onServiceAdd } = renderDashboard();

    await user.click(screen.getByRole('button', { name: 'Novo contato' }));

    expect(onServiceAdd).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Novo contato');
    expect(serviceButton('Novo contato')).toHaveAttribute('aria-pressed', 'true');
  });

  it('requires confirmation before removing and selects the next contact first', async () => {
    const { user, onServiceRemove } = renderDashboard([capsService, ubsService, universityService]);
    await user.click(serviceButton('UBS Norte'));

    await user.click(screen.getByRole('button', { name: 'Remover contato UBS Norte' }));
    expect(onServiceRemove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmar: Remover contato UBS Norte' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('min-h-11');

    await user.click(screen.getByRole('button', { name: 'Confirmar: Remover contato UBS Norte' }));

    expect(onServiceRemove).toHaveBeenCalledWith(1, 'service-ubs-norte');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Clínica Escola');
    expect(serviceButton('Clínica Escola')).toHaveAttribute('aria-pressed', 'true');
  });

  it('requires a fresh confirmation after switching contacts', async () => {
    const { user, onServiceRemove } = renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Remover contato CAPS Centro' }));

    await user.click(serviceButton('UBS Norte'));

    expect(screen.getByRole('button', { name: 'Remover contato UBS Norte' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover contato UBS Norte' }));
    expect(onServiceRemove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmar: Remover contato UBS Norte' })).toBeInTheDocument();
  });

  it('cancels an armed removal when focus moves outside the confirmation controls', async () => {
    const { user, onServiceRemove } = renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Remover contato CAPS Centro' }));
    expect(screen.getByRole('button', { name: 'Confirmar: Remover contato CAPS Centro' })).toBeInTheDocument();

    await user.click(screen.getByRole('textbox', { name: 'Nome' }));

    expect(screen.queryByRole('button', { name: 'Confirmar: Remover contato CAPS Centro' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover contato CAPS Centro' })).toBeInTheDocument();
    expect(onServiceRemove).not.toHaveBeenCalled();
  });

  it('selects the previous contact when removing the last item', async () => {
    const { user } = renderDashboard();
    await user.click(serviceButton('UBS Norte'));
    await user.click(screen.getByRole('button', { name: 'Remover contato UBS Norte' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar: Remover contato UBS Norte' }));

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('CAPS Centro');
    expect(serviceButton('CAPS Centro')).toHaveAttribute('aria-pressed', 'true');
  });

  it('moves focus to the neighboring contact after removal', async () => {
    const { user } = renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Remover contato CAPS Centro' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar: Remover contato CAPS Centro' }));

    expect(serviceButton('UBS Norte')).toHaveFocus();
  });

  it('moves focus to the add action after removing the only contact', async () => {
    const { user } = renderDashboard([capsService]);
    await user.click(screen.getByRole('button', { name: 'Remover contato CAPS Centro' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar: Remover contato CAPS Centro' }));

    expect(screen.getByRole('button', { name: 'Novo contato' })).toHaveFocus();
  });

  it('shows a calm empty state while keeping the add action available', () => {
    renderDashboard([]);

    expect(screen.getByText('Nenhum contato cadastrado ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo contato' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nome' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Validação' })).toBeInTheDocument();
  });

  it('wires a required-field issue to the visible input and invalid styling', () => {
    renderDashboard([{ ...capsService, name: '' }]);
    const name = screen.getByRole('textbox', { name: 'Nome' });
    const describedBy = name.getAttribute('aria-describedby');

    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAttribute('data-invalid', 'true');
    expect(name).toHaveClass('border-error');
    expect(describedBy).toBeTruthy();
    expect(name).toHaveAccessibleDescription(/O nome do contato é obrigatório./);
  });

  it('surfaces a hidden phoneHref mismatch on the visible phone field', () => {
    renderDashboard([{ ...capsService, phoneHref: 'tel:00000000' }]);
    const phone = screen.getByRole('textbox', { name: 'Telefone' });
    const describedBy = phone.getAttribute('aria-describedby');

    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(describedBy).toBeTruthy();
    expect(phone).toHaveAccessibleDescription(/link do telefone precisa corresponder/i);
  });
});
