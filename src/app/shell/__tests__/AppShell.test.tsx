import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../AppShell';

describe('AppShell', () => {
  it('shows the test-version warning on site pages', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<main>Conteúdo</main>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Versão de teste - o SeCuida não realiza diagnóstico e não substitui atendimento profissional.'),
    ).toBeInTheDocument();
  });
});
