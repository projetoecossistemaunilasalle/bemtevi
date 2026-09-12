import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { EducationLibraryScreen } from '../EducationLibraryScreen';
import { ResourceDetailScreen } from '../ResourceDetailScreen';
import { buildDatabaseEducationPayload, renderWithContent } from './educationScreensTestUtils';

describe('published content provider', () => {
  it('renders published education resources and groups', () => {
    const payload = buildDatabaseEducationPayload();
    renderWithContent(
      <MemoryRouter initialEntries={['/educacao']}>
        <Routes>
          <Route path="/educacao" element={<EducationLibraryScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    expect(screen.getByText('Recurso do Banco de Dados')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grupo do Banco de Dados' })).toBeInTheDocument();
  });

  it('resolves published resource details by route id', () => {
    const payload = buildDatabaseEducationPayload();
    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/db-recurso']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
      payload,
    );

    expect(screen.getByRole('heading', { name: 'Recurso do Banco de Dados' })).toBeInTheDocument();
  });

  it('renders paragraph blocks and descriptions preserving line breaks with whitespace-pre-line', () => {
    const payload = buildDatabaseEducationPayload();
    const multilineResource = {
      ...payload.educationMaterials[0],
      id: 'multiline-resource',
      title: 'Material com Parágrafos Múltiplos',
      description: 'Primeira linha da descrição.\nSegunda linha da descrição.',
      body: [
        {
          id: 'p1',
          kind: 'paragraph' as const,
          title: 'Bloco de Texto',
          text: 'Primeiro parágrafo do conteúdo.\nSegundo parágrafo após enter.',
        },
      ],
    };
    const testPayload = {
      ...payload,
      educationMaterials: [multilineResource],
    };

    renderWithContent(
      <MemoryRouter initialEntries={['/educacao/multiline-resource']}>
        <Routes>
          <Route path="/educacao/:resourceId" element={<ResourceDetailScreen />} />
        </Routes>
      </MemoryRouter>,
      testPayload,
    );

    const descriptionEl = screen.getByText(/Primeira linha da descrição/);
    expect(descriptionEl).toHaveClass('whitespace-pre-line');

    const paragraphEl = screen.getByText(/Primeiro parágrafo do conteúdo/);
    expect(paragraphEl).toHaveClass('whitespace-pre-line');
  });
});
