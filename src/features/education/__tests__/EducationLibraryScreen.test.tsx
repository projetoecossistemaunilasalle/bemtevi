import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { getBundledContent } from '../../../app/content/bundledContent';
import { EducationLibraryScreen } from '../EducationLibraryScreen';
import { ResourceDetailScreen } from '../ResourceDetailScreen';
import {
  contentWithoutEducation,
  createDraftState,
  firstShippedMaterial,
  renderWithContent,
  shippedMaterialSourceIndex,
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

  it('does not render source badges at the top of library cards', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          educationMaterialPatches: [
            {
              id: resource.id,
              sourceIndex: shippedMaterialSourceIndex(resource.id),
              patch: {
                source:
                  'ORGANIZAÇÃO MUNDIAL DA SAÚDE (OMS). Saúde mental e bem-estar. / PARROTT, E. et al. The Role of Teachers.',
              },
            },
          ],
        }),
      ),
    );

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

  it('shows the preview warning when at least one material was actually added', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            {
              ...resource,
              id: 'preview-added-material',
              title: 'Material adicionado em teste',
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/versão de teste/i)).toBeInTheDocument();
    expect(screen.getByText('Material adicionado em teste')).toBeInTheDocument();
  });

  it('renders named group headings only for groups with resources', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [{ id: 'unused-group', title: 'Grupo sem recursos', order: 10 }],
          addedEducationMaterials: [
            {
              ...resource,
              id: 'material-in-group',
              title: 'Material em grupo',
              group: 'auto-cuidado',
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Autocuidado' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Grupo sem recursos' })).not.toBeInTheDocument();
    expect(screen.queryByText('Grupo sem recursos')).not.toBeInTheDocument();
  });

  it('does not render headings for empty groups', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [{ id: 'empty-group', title: 'Grupo Vazio', order: 5 }],
          addedEducationMaterials: [
            {
              ...resource,
              id: 'material-no-group',
              title: 'Material sem grupo',
            },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', { name: 'Grupo Vazio' })).not.toBeInTheDocument();
    expect(screen.getByText('Material sem grupo')).toBeInTheDocument();
  });

  it('renders named groups ordered by their order field', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [
            { id: 'group-z', title: 'Grupo Z', order: 30 },
            { id: 'group-a', title: 'Grupo A', order: 10 },
            { id: 'group-m', title: 'Grupo M', order: 20 },
          ],
          addedEducationMaterials: [
            { ...resource, id: 'mat-z', title: 'Material Z', group: 'group-z', groupOrder: 1 },
            { ...resource, id: 'mat-a', title: 'Material A', group: 'group-a', groupOrder: 1 },
            { ...resource, id: 'mat-m', title: 'Material M', group: 'group-m', groupOrder: 1 },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      contentWithoutEducation(),
    );

    const groupHeadings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(groupHeadings).toEqual(['Grupo A', 'Grupo M', 'Grupo Z']);
  });

  it('renders geral section first without a heading', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedGroups: [{ id: 'first-group', title: 'Primeiro Grupo', order: 1 }],
          addedEducationMaterials: [
            { ...resource, id: 'mat-geral', title: 'Material Geral', group: 'geral' },
            { ...resource, id: 'mat-named', title: 'Material Named', group: 'first-group' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      contentWithoutEducation(),
    );

    const groupHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(groupHeadings).toHaveLength(1);
    expect(groupHeadings[0].textContent).toBe('Primeiro Grupo');
    expect(screen.getByText('Material Geral')).toBeInTheDocument();
    expect(screen.getByText('Material Named')).toBeInTheDocument();
  });

  it('renders geral according to the default group order', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          defaultGroupOrder: 2,
          addedGroups: [{ id: 'first-group', title: 'Primeiro Grupo', order: 1 }],
          addedEducationMaterials: [
            { ...resource, id: 'mat-geral', title: 'Material Geral', group: 'geral' },
            { ...resource, id: 'mat-named', title: 'Material Pinned', group: 'first-group' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const pinnedHeading = screen.getByRole('heading', { name: 'Primeiro Grupo' });
    const pinnedMaterial = screen.getByText('Material Pinned');
    const geralMaterial = screen.getByText('Material Geral');

    expect(pinnedHeading.compareDocumentPosition(pinnedMaterial)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(pinnedMaterial.compareDocumentPosition(geralMaterial)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('separates geral from a previous named group without rendering a geral heading', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          defaultGroupOrder: 2,
          addedGroups: [{ id: 'auto-group', title: 'Autocuidado', order: 1 }],
          addedEducationMaterials: [
            { ...resource, id: 'mat-autocuidado', title: 'Material Autocuidado', group: 'auto-group' },
            { ...resource, id: 'mat-geral', title: 'Material Geral', group: 'geral' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      contentWithoutEducation(),
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
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            { ...resource, id: 'mat-3', title: 'Terceiro', group: 'geral', groupOrder: 3 },
            { ...resource, id: 'mat-1', title: 'Primeiro', group: 'geral', groupOrder: 1 },
            { ...resource, id: 'mat-2', title: 'Segundo', group: 'geral', groupOrder: 2 },
            { ...resource, id: 'mat-undefined', title: 'Sem order', group: 'geral' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      contentWithoutEducation(),
    );

    const baseTitles = new Set(getBundledContent().educationMaterials.map((r) => r.title));
    const resourceTitles = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
      .filter((t): t is string => t !== null && !baseTitles.has(t));
    expect(resourceTitles).toEqual(['Primeiro', 'Segundo', 'Terceiro', 'Sem order']);
  });

  it('falls back dangling group references to geral', () => {
    const resource = firstShippedMaterial();
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify(
        createDraftState({
          addedEducationMaterials: [
            { ...resource, id: 'mat-dangling', title: 'Material Órfão', group: 'non-existent-group' },
          ],
        }),
      ),
    );

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Material Órfão')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading');
    expect(headings.every((h) => h.textContent !== 'Material Órfão')).toBe(false);
  });
});
