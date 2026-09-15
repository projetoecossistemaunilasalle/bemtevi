import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { getBundledContent } from '../../../app/content/bundledContent';
import { EducationLibraryScreen } from '../EducationLibraryScreen';
import { ResourceDetailScreen } from '../ResourceDetailScreen';
import {
  contentWithoutEducation,
  firstShippedMaterial,
  renderWithContent,
  seedLegacyDashboardDraftBytes,
} from './educationScreensTestUtils';

beforeEach(() => {
  localStorage.clear();
});

describe('EducationLibraryScreen', () => {
  it('renders configured resources and navigates to the detail route', async () => {
    const user = userEvent.setup();
    const resource = firstShippedMaterial();
    const overviewTitle = resource.body?.find((block) => block.kind === 'paragraph')?.title;

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(resource.title)).toBeInTheDocument();
    expect(screen.getByText(resource.description)).toHaveClass('text-justify');

    await user.click(screen.getAllByRole('button', { name: /ver material/i })[0]);

    expect(screen.getByRole('heading', { name: resource.title })).toBeInTheDocument();
    if (overviewTitle) {
      expect(screen.getByText(overviewTitle)).toBeInTheDocument();
    }
  });

  it('ignores populated bemtevi:dev-dashboard:drafts:v1 bytes and renders only published content', () => {
    seedLegacyDashboardDraftBytes();
    const published = getBundledContent();

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      published,
    );

    expect(screen.queryByText('Material adicionado em teste')).not.toBeInTheDocument();
    expect(screen.queryByText(/versão de teste/i)).not.toBeInTheDocument();
    expect(screen.getByText(published.educationMaterials[0]!.title)).toBeInTheDocument();
  });

  it('does not render source badges at the top of library cards', () => {
    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('OMS')).not.toBeInTheDocument();
    expect(screen.queryByText('PARROTT et al.')).not.toBeInTheDocument();
    expect(screen.queryByText('Fontes e referências')).not.toBeInTheDocument();
    expect(screen.queryByText(/Saúde mental e bem-estar/)).not.toBeInTheDocument();
  });

  it('renders named group headings only for groups with resources', () => {
    const resource = firstShippedMaterial();
    const payload = {
      ...getBundledContent(),
      educationMaterials: [{ ...resource, id: 'material-in-group', title: 'Material em grupo', group: 'auto-cuidado' }],
      educationGroups: [
        { id: 'auto-cuidado', title: 'Autocuidado', order: 1 },
        { id: 'unused-group', title: 'Grupo sem recursos', order: 10 },
      ],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    expect(screen.getByRole('heading', { name: 'Autocuidado' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Grupo sem recursos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Grupo sem recursos')).not.toBeInTheDocument();
  });

  it('does not render headings for empty groups', () => {
    const resource = firstShippedMaterial();
    const payload = {
      ...getBundledContent(),
      educationMaterials: [{ ...resource, id: 'material-no-group', title: 'Material sem grupo' }],
      educationGroups: [{ id: 'empty-group', title: 'Grupo Vazio', order: 5 }],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    expect(screen.queryByRole('heading', { name: 'Grupo Vazio' })).not.toBeInTheDocument();
    expect(screen.getByText('Material sem grupo')).toBeInTheDocument();
  });

  it('renders named groups ordered by their order field', () => {
    const resource = firstShippedMaterial();
    const payload = {
      ...contentWithoutEducation(),
      educationMaterials: [
        { ...resource, id: 'mat-z', title: 'Material Z', group: 'group-z', groupOrder: 1 },
        { ...resource, id: 'mat-a', title: 'Material A', group: 'group-a', groupOrder: 1 },
        { ...resource, id: 'mat-m', title: 'Material M', group: 'group-m', groupOrder: 1 },
      ],
      educationGroups: [
        { id: 'group-z', title: 'Grupo Z', order: 30 },
        { id: 'group-a', title: 'Grupo A', order: 10 },
        { id: 'group-m', title: 'Grupo M', order: 20 },
      ],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    const groupHeadings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(groupHeadings).toEqual(['Grupo A', 'Grupo M', 'Grupo Z']);
  });

  it('renders geral section first without a heading', () => {
    const resource = firstShippedMaterial();
    const payload = {
      ...contentWithoutEducation(),
      educationMaterials: [
        { ...resource, id: 'mat-geral', title: 'Material Geral', group: 'geral' },
        { ...resource, id: 'mat-named', title: 'Material Named', group: 'first-group' },
      ],
      educationGroups: [{ id: 'first-group', title: 'Primeiro Grupo', order: 1 }],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    const groupHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(groupHeadings).toHaveLength(1);
    expect(groupHeadings[0].textContent).toBe('Primeiro Grupo');
    expect(screen.getByText('Material Geral')).toBeInTheDocument();
    expect(screen.getByText('Material Named')).toBeInTheDocument();
  });

  it('renders geral according to the default group order', () => {
    const resource = firstShippedMaterial();
    const payload = {
      ...getBundledContent(),
      defaultGroupOrder: 2,
      educationMaterials: [
        { ...resource, id: 'mat-geral', title: 'Material Geral', group: 'geral' },
        { ...resource, id: 'mat-named', title: 'Material Pinned', group: 'first-group' },
      ],
      educationGroups: [{ id: 'first-group', title: 'Primeiro Grupo', order: 1 }],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    const pinnedHeading = screen.getByRole('heading', { name: 'Primeiro Grupo' });
    const pinnedMaterial = screen.getByText('Material Pinned');
    const geralMaterial = screen.getByText('Material Geral');

    expect(pinnedHeading.compareDocumentPosition(pinnedMaterial)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(pinnedMaterial.compareDocumentPosition(geralMaterial)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('separates geral from a previous named group without rendering a geral heading', () => {
    const resource = firstShippedMaterial();
    const payload = {
      ...contentWithoutEducation(),
      defaultGroupOrder: 2,
      educationMaterials: [
        { ...resource, id: 'mat-autocuidado', title: 'Material Autocuidado', group: 'auto-group' },
        { ...resource, id: 'mat-geral', title: 'Material Geral', group: 'geral' },
      ],
      educationGroups: [{ id: 'auto-group', title: 'Autocuidado', order: 1 }],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    const separator = screen.getByRole('separator', { name: 'Separador entre grupos de materiais' });
    const autocuidadoHeading = screen.getByRole('heading', { name: 'Autocuidado' });
    const geralMaterial = screen.getByText('Material Geral');

    expect(separator).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Geral' })).not.toBeInTheDocument();
    expect(autocuidadoHeading.compareDocumentPosition(separator)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(separator.compareDocumentPosition(geralMaterial)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('sorts resources within groups by groupOrder with stable tie-breaking', () => {
    const resource = firstShippedMaterial();
    const payload = {
      ...contentWithoutEducation(),
      educationMaterials: [
        { ...resource, id: 'mat-3', title: 'Terceiro', group: 'geral', groupOrder: 3 },
        { ...resource, id: 'mat-1', title: 'Primeiro', group: 'geral', groupOrder: 1 },
        { ...resource, id: 'mat-2', title: 'Segundo', group: 'geral', groupOrder: 2 },
        { ...resource, id: 'mat-undefined', title: 'Sem order', group: 'geral', groupOrder: undefined },
      ],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    const resourceTitles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(resourceTitles).toEqual(['Primeiro', 'Segundo', 'Terceiro', 'Sem order']);
  });

  it('falls back dangling group references to geral', () => {
    const resource = firstShippedMaterial();
    const payload = {
      ...getBundledContent(),
      educationMaterials: [{ ...resource, id: 'mat-dangling', title: 'Material Órfão', group: 'non-existent-group' }],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    expect(screen.getByText('Material Órfão')).toBeInTheDocument();
  });
});
